import demjson3
import requests
from urllib.parse import urlparse
from django.conf import settings
from django.db import IntegrityError, transaction
from django.http import JsonResponse
from django.utils import timezone
from django.views import View

from user.forms import UserFormByWechat
from user.models import UserInfo
from user.passwords import validate_password_policy
from user.avatar import upload_avatar
from utils.exceptions.types.not_found import (
    NotBoundWechat,
    NotFoundException,
)
from utils.exceptions.types.forbidden import ForbiddenException
from user.tokens import generate_token, check_request_user
from user.dto.user_all import user_all


class OpenId:
    """
    微信小程序登录凭证校验
    用于获取用户的 openid 和 session_key
    """

    def __init__(self, jscode):
        self.url = "https://api.weixin.qq.com/sns/jscode2session"
        self.app_id = settings.APP_ID
        self.app_secret = settings.APP_SECRET
        self.jscode = jscode
        # Cache the API response to avoid multiple requests with same jscode
        self.response_data = None

    def _fetch_data(self):
        """
        Fetch data from WeChat API if not already fetched
        Caches the response to avoid redundant API calls
        """
        if self.response_data is None:
            if not self.app_id or self.app_id.startswith("DEFAULT_"):
                raise NotFoundException("微信小程序尚未配置")
            if not self.app_secret or self.app_secret.startswith("DEFAULT_"):
                raise NotFoundException("微信小程序尚未配置")
            try:
                res = requests.get(
                    self.url,
                    params={
                        "appid": self.app_id,
                        "secret": self.app_secret,
                        "js_code": self.jscode,
                        "grant_type": "authorization_code",
                    },
                    timeout=8,
                )
                res.raise_for_status()
                data = res.json()
            except (requests.RequestException, ValueError) as exc:
                raise NotFoundException("微信登录服务暂时不可用") from exc
            if "errcode" in data:
                raise NotFoundException("微信登录凭证无效或已过期")
            if not str(data.get("openid", "")).strip():
                raise NotFoundException("微信登录响应缺少用户标识")
            self.response_data = data

    def get_openid(self) -> str:
        self._fetch_data()
        return self.response_data["openid"].strip()

    def get_session_key(self) -> str:
        """Get session_key for decrypting phone number and other sensitive data"""
        self._fetch_data()
        return self.response_data.get("session_key", "")


class WechatLogin(View):
    # LG0102 微信登录
    def post(self, request):
        body = demjson3.decode(request.body)
        jscode = body["jscode"]
        openid = OpenId(jscode).get_openid()
        user_info = UserInfo.objects.filter(wechat=openid)
        if not user_info.exists():
            raise NotFoundException("当前微信未绑定账号")
        user = user_info[0].user
        user.last_login = timezone.now()
        user.save()
        return JsonResponse({"token": generate_token(user), "id": user.id}, status=200)


class WechatRegister(View):
    # US0102 新建用户（微信）
    def post(self, request):
        body = demjson3.decode(request.body)
        user_form = UserFormByWechat(body)
        jscode = body["jscode"]
        #   获取微信信息
        openid = OpenId(jscode).get_openid()
        user_info = UserInfo.objects.filter(wechat=openid)
        if user_info.exists():  # 微信号有记录了
            return JsonResponse({"msg": "该微信已绑定账户"}, status=409)
        if not user_form.is_valid():
            if user_form["username"].errors:
                return JsonResponse({"msg": "用户名重复"}, status=409)
            else:
                # Provide more detailed error information
                error_details = []
                for field, errors in user_form.errors.items():
                    error_details.append(f"{field}: {', '.join(errors)}")
                return JsonResponse(
                    {"msg": "表单验证失败", "errors": error_details}, status=400
                )
        else:
            user = user_form.save(commit=False)
            user.set_unusable_password()
            # Set empty email for WeChat-only registration
            if not user.email:
                user.email = ""
            try:
                with transaction.atomic():
                    user.save()
                    user_info = UserInfo(
                        user=user,
                        wechat=openid,
                        nickname=body.get("nickname", user.username),
                        telephone=body.get("telephone", ""),
                    )
                    if "avatar" in body:
                        user_info.avatar = upload_avatar(
                            user.id, body["avatar"], suffix="png"
                        )
                    user_info.save()
            except IntegrityError:
                if UserInfo.objects.filter(wechat=openid).exists():
                    return JsonResponse({"msg": "该微信已绑定账户"}, status=409)
                raise
            return JsonResponse(
                {"id": user.id, "token": generate_token(user)}, status=200
            )


class BindWechat(View):
    # US0304 绑定微信
    def put(self, request, id) -> JsonResponse:
        user = check_request_user(request, id)
        body = demjson3.decode(request.body)
        if body.get("demo"):
            if not getattr(settings, "WECHAT_BIND_DEMO_MODE", False):
                return JsonResponse(
                    {"msg": "微信绑定只能在微信小程序中完成"}, status=400
                )
            openid = f"demo-wechat-{user.id}"
        else:
            jscode = body["jscode"]
            openid = OpenId(jscode).get_openid()
        if UserInfo.objects.filter(wechat=openid).exclude(user=user).exists():
            return JsonResponse({"msg": "该微信已绑定其他账号"}, status=409)
        if len(user.user_info.wechat):
            if not body.get("overwrite"):
                return JsonResponse({"msg": "该账户已绑定微信"}, status=409)
        user.user_info.wechat = openid
        user.user_info.save()
        return JsonResponse({}, status=200)

    # US0305 取消绑定微信
    def delete(self, request, id) -> JsonResponse:
        user = check_request_user(request, id)
        if not len(user.user_info.wechat):
            raise NotBoundWechat(user.user_info.nickname)
        if not len(user.email) and not getattr(
            settings, "WECHAT_BIND_DEMO_MODE", False
        ):
            return JsonResponse({"msg": "未绑定邮箱，无法解绑微信"}, status=403)
        user.user_info.wechat = ""
        user.user_info.save()
        return JsonResponse({}, status=200)


class WechatManage(View):
    # US0307 微信更新用户密码
    def post(self, request, id) -> JsonResponse:
        #    基于token获取的用户
        user = check_request_user(request, id)
        if user.id != id:
            raise ForbiddenException
        body = demjson3.decode(request.body)
        jscode = body["jscode"]
        openid = OpenId(jscode).get_openid()
        #   基于jscode获取的用户
        user_info = UserInfo.objects.filter(wechat=openid)
        if user_info[0].user != user:
            raise ForbiddenException
        validate_password_policy(body["newpassword"])
        user.set_password(body["newpassword"])
        user.save()
        return JsonResponse(
            {
                "user": user_all(user, private=True),
                "token": generate_token(user),
            },
            status=200,
        )


class WechatWebAuth:
    """Handle Web/H5 WeChat OAuth authentication"""

    def __init__(self, code):
        self.code = code
        self.app_id = settings.WEB_APP_ID
        self.app_secret = settings.WEB_APP_SECRET
        self.response_data = None

    def _fetch_access_token(self):
        """Fetch access token from WeChat Web OAuth API"""
        if self.response_data is None:
            if not self.app_id or not self.app_secret:
                raise NotFoundException("微信网页授权尚未配置")
            try:
                res = requests.get(
                    "https://api.weixin.qq.com/sns/oauth2/access_token",
                    params={
                        "appid": self.app_id,
                        "secret": self.app_secret,
                        "code": self.code,
                        "grant_type": "authorization_code",
                    },
                    timeout=8,
                )
                res.raise_for_status()
                data = res.json()
            except (requests.RequestException, ValueError) as exc:
                raise NotFoundException("微信网页授权服务暂时不可用") from exc
            if "errcode" in data:
                raise NotFoundException("微信网页授权失败或已过期")
            if not data.get("openid") or not data.get("access_token"):
                raise NotFoundException("微信网页授权响应不完整")
            self.response_data = data

    def get_openid(self) -> str:
        """Get user's openid from WeChat Web OAuth"""
        self._fetch_access_token()
        return self.response_data["openid"].strip()

    def get_user_info(self) -> dict:
        """Get user info including nickname, avatar, etc."""
        self._fetch_access_token()
        access_token = self.response_data["access_token"]
        openid = self.response_data["openid"]
        try:
            res = requests.get(
                "https://api.weixin.qq.com/sns/userinfo",
                params={
                    "access_token": access_token,
                    "openid": openid,
                    "lang": "zh_CN",
                },
                timeout=8,
            )
            res.raise_for_status()
            user_info = res.json()
        except (requests.RequestException, ValueError) as exc:
            raise NotFoundException("微信用户信息服务暂时不可用") from exc
        if "errcode" in user_info:
            raise NotFoundException("获取微信用户信息失败")
        return user_info


class WechatWebLogin(View):
    """Web/H5 WeChat OAuth login"""

    def post(self, request):
        body = demjson3.decode(request.body)
        code = body["code"]
        wechat_auth = WechatWebAuth(code)
        openid = wechat_auth.get_openid()
        user_info = UserInfo.objects.filter(wechat=openid)
        if not user_info.exists():
            raise NotFoundException("当前微信未绑定账号")
        user = user_info[0].user
        user.last_login = timezone.now()
        user.save()
        return JsonResponse({"token": generate_token(user), "id": user.id}, status=200)


class WechatWebRegister(View):
    """Web/H5 WeChat OAuth registration with one-click"""

    @staticmethod
    def _is_valid_url(url: str) -> bool:
        """Check if a string is a valid HTTP/HTTPS URL"""
        try:
            result = urlparse(url)
            return all([result.scheme in ["http", "https"], result.netloc])
        except Exception:
            return False

    def post(self, request):
        body = demjson3.decode(request.body)
        code = body["code"]
        wechat_auth = WechatWebAuth(code)
        openid = wechat_auth.get_openid()

        # Check if WeChat already bound
        user_info = UserInfo.objects.filter(wechat=openid)
        if user_info.exists():
            return JsonResponse({"msg": "该微信已绑定账户"}, status=409)

        # Get WeChat user info for nickname and avatar
        try:
            wechat_user_info = wechat_auth.get_user_info()
        except Exception as e:
            # If WeChat API fails, continue with empty user info
            # User can still complete registration without WeChat data
            wechat_user_info = {}

        # Validate required fields
        user_form = UserFormByWechat(body)
        if not user_form.is_valid():
            if user_form["username"].errors:
                return JsonResponse({"msg": "用户名重复"}, status=409)
            else:
                error_details = []
                for field, errors in user_form.errors.items():
                    error_details.append(f"{field}: {', '.join(errors)}")
                return JsonResponse(
                    {"msg": "表单验证失败", "errors": error_details}, status=400
                )

        # Create user
        user = user_form.save(commit=False)
        user.set_unusable_password()
        if not user.email:
            user.email = ""

        # Save user first
        user.save()

        # Create user info with WeChat data
        nickname = (
            body.get("nickname") or wechat_user_info.get("nickname") or user.username
        )
        avatar = body.get("avatar") or wechat_user_info.get("headimgurl") or ""

        user_info = UserInfo.objects.create(user=user, nickname=nickname)
        user_info.wechat = openid

        if avatar:
            # Validate if avatar is a URL
            if self._is_valid_url(avatar):
                user_info.avatar = avatar
            else:
                # Assume it's base64 encoded image data
                user_info.avatar = upload_avatar(user.id, avatar, suffix="png")

        if "telephone" in body:
            user_info.telephone = body["telephone"]

        user_info.save()
        return JsonResponse({"id": user.id, "token": generate_token(user)}, status=200)


class BindWechatWeb(View):
    """Bind Web/H5 WeChat OAuth to existing account"""

    def put(self, request, id) -> JsonResponse:
        user = check_request_user(request, id)
        body = demjson3.decode(request.body)
        code = body["code"]
        wechat_auth = WechatWebAuth(code)
        openid = wechat_auth.get_openid()

        if UserInfo.objects.filter(wechat=openid).exists():
            return JsonResponse({"msg": "该微信已绑定其他账号"}, status=409)
        if len(user.user_info.wechat):
            if not body.get("overwrite", False):
                return JsonResponse({"msg": "该账户已绑定微信"}, status=409)

        user.user_info.wechat = openid
        user.user_info.save()
        return JsonResponse({}, status=200)
