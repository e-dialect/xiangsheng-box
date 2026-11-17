import hashlib
import json
import logging
import re
import secrets
from datetime import timedelta

from django.conf import settings
from django.contrib.auth.models import User
from django.core.cache import cache
from django.db import transaction
from django.http import JsonResponse
from django.utils import timezone
from django.views.decorators.cache import never_cache
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_GET, require_POST

from user.models import UserInfo, WechatLoginRequest
from user.tokens import generate_token
from user.view.wechat import OpenId
from user.wechat_launch import WechatLaunchUnavailable, launch_url, mini_program_code
from utils.exceptions.payload import api_error_payload, request_id as api_request_id
from utils.exceptions.types.not_found import NotFoundException

logger = logging.getLogger(__name__)
Channel = WechatLoginRequest.Channel
Status = WechatLoginRequest.Status
REQUEST_ID = re.compile(r"[0-9a-f]{32}")
EXCHANGE_KEY = re.compile(r"[A-Za-z0-9_-]{43}")


def _enabled(channel):
    flag = (
        settings.WECHAT_BRIDGE_APP_ENABLED
        if channel == Channel.APP
        else settings.WECHAT_BRIDGE_WEB_ENABLED
    )
    return flag and all(
        value and not value.startswith("DEFAULT_")
        for value in (settings.APP_ID, settings.APP_SECRET)
    )


def _body(request):
    if len(request.body) <= 2048 and request.content_type == "application/json":
        try:
            data = json.loads(request.body)
        except (UnicodeDecodeError, ValueError):
            return {}
        if isinstance(data, dict):
            return data
    return {}


def _digest(value):
    return hashlib.sha256(value.encode()).hexdigest()


def _error(request, message, status):
    response = JsonResponse(
        api_error_payload(message, status, rid=api_request_id(request)), status=status
    )
    response.safe_public_error = True
    return response


def _active(request_id):
    if not isinstance(request_id, str) or not REQUEST_ID.fullmatch(request_id):
        return WechatLoginRequest.objects.none()
    return WechatLoginRequest.objects.filter(
        pk=request_id, expires_at__gt=timezone.now()
    )


def _authorized(data):
    key = data.get("exchange_key")
    if not isinstance(key, str) or not EXCHANGE_KEY.fullmatch(key):
        return WechatLoginRequest.objects.none()
    return _active(data.get("request_id")).filter(exchange_digest=_digest(key))


def _reference(request_id):
    return f"{int(request_id[:8], 16) % 1000000:06d}"


def _start_limited(now):
    # Bound calls to the upstream API even when requests omit client identifiers.
    bucket = f"wechat-bridge-start:{int(now.timestamp()) // 60}"
    cache.add(bucket, 0, timeout=120)
    return cache.incr(bucket) > 60


@never_cache
@require_GET
def availability(request):
    return JsonResponse({"web": _enabled(Channel.WEB), "app": _enabled(Channel.APP)})


@never_cache
@csrf_exempt
@require_POST
def start(request):
    channel = _body(request).get("channel")
    if channel not in Channel.values:
        return _error(request, "无效的登录入口", 400)
    if not _enabled(channel):
        return _error(request, "微信登录暂未开放", 503)

    now = timezone.now()
    if _start_limited(now):
        return _error(request, "微信登录请求较多，请稍后重试", 429)
    request_id = secrets.token_hex(16)
    exchange_key = secrets.token_urlsafe(32)
    expires_at = now + timedelta(minutes=5)
    try:
        transport = (
            {"qr_image": mini_program_code(request_id)}
            if channel == Channel.WEB_QR
            else {"launch_url": launch_url(request_id, expires_at)}
        )
    except WechatLaunchUnavailable:
        return _error(request, "暂时无法打开微信小程序，请重试", 502)

    WechatLoginRequest.objects.filter(expires_at__lte=now).delete()
    WechatLoginRequest.objects.create(
        id=request_id,
        channel=channel,
        exchange_digest=_digest(exchange_key),
        expires_at=expires_at,
    )
    return JsonResponse(
        {
            "request_id": request_id,
            "exchange_key": exchange_key,
            "expires_at": expires_at.isoformat(),
            "reference": _reference(request_id),
            **transport,
        },
        status=201,
    )


@never_cache
@require_GET
def details(request):
    login = _active(request.GET.get("request_id")).filter(status=Status.PENDING).first()
    if login is None or not _enabled(login.channel):
        return _error(request, "登录请求已失效，请重新发起", 410)
    return JsonResponse({"channel": login.channel, "reference": _reference(login.pk)})


@never_cache
@csrf_exempt
@require_POST
def confirm(request):
    data = _body(request)
    pending = _active(data.get("request_id")).filter(status=Status.PENDING)
    login = pending.first()
    if login is None or not _enabled(login.channel):
        return _error(request, "登录请求已失效，请重新发起", 410)
    code = data.get("jscode")
    if not isinstance(code, str) or not code.strip() or len(code) > 256:
        return _error(request, "缺少有效的微信登录凭证", 400)
    try:
        openid = OpenId(code).get_openid()
    except NotFoundException:
        return _error(request, "微信登录验证失败，请重试", 400)

    with transaction.atomic():
        # Update first to acquire SQLite's writer lock before reading the binding.
        claimed = pending.filter(expires_at__gt=timezone.now()).update(
            status=Status.CONFIRMED
        )
        if not claimed:
            return _error(request, "登录请求已失效，请重新发起", 410)
        info = UserInfo.objects.select_related("user").filter(wechat=openid).first()
        if info is None:
            user = User(username=f"wx_{secrets.token_hex(16)}")
            user.set_unusable_password()
            user.save()
            UserInfo.objects.create(user=user, wechat=openid, nickname=user.username)
        elif not info.user.is_active:
            transaction.set_rollback(True)
            return _error(request, "此账号无法登录", 403)
        else:
            user = info.user
        WechatLoginRequest.objects.filter(pk=login.pk).update(
            user=user, openid_digest=_digest(openid), is_new=info is None
        )

    logger.info("wechat_bridge confirmed channel=%s", login.channel)
    return JsonResponse({"status": Status.CONFIRMED})


@never_cache
@csrf_exempt
@require_POST
def exchange(request):
    authorized = _authorized(_body(request))
    login = authorized.first()
    if login is None or not _enabled(login.channel):
        return _error(request, "登录请求已失效，请重新发起", 410)
    if login.status == Status.PENDING:
        return JsonResponse({"status": Status.PENDING}, status=202)
    if login.status != Status.CONFIRMED:
        return _error(request, "登录请求已失效，请重新发起", 410)

    with transaction.atomic():
        claimed = authorized.filter(
            status=Status.CONFIRMED, expires_at__gt=timezone.now()
        ).update(status=Status.REDEEMED)
        if not claimed:
            return _error(request, "登录请求已失效，请重新发起", 410)
        info = UserInfo.objects.select_related("user").filter(pk=login.user_id).first()
        if (
            info is None
            or not info.user.is_active
            or not secrets.compare_digest(_digest(info.wechat), login.openid_digest)
        ):
            return _error(request, "微信账号绑定已变化，请重新发起登录", 410)
        user = info.user
        user.last_login = timezone.now()
        user.save(update_fields=["last_login"])
        result = {"id": user.pk, "token": generate_token(user), "isNew": login.is_new}

    logger.info("wechat_bridge redeemed channel=%s", login.channel)
    return JsonResponse(result)


@never_cache
@csrf_exempt
@require_POST
def cancel(request):
    _authorized(_body(request)).filter(
        status__in=[Status.PENDING, Status.CONFIRMED]
    ).update(status=Status.CANCELLED)
    return JsonResponse({"status": Status.CANCELLED})
