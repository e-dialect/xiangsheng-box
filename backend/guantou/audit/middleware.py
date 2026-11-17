import hashlib
import logging
import time
import uuid

from django.conf import settings
from django.contrib.auth.models import AnonymousUser
from django.db import IntegrityError, OperationalError
from django.middleware.common import MiddlewareMixin
from django.utils import timezone

from utils.exceptions.payload import request_id

from .context import reset_current_request, set_current_request
from .models import AnonymousVisitor, VisitorEvent

logger = logging.getLogger(__name__)

VISITOR_HEADER = "X-Visitor-ID"
VISITOR_META_HEADER = "HTTP_X_VISITOR_ID"
VISITOR_LOCK_RETRY_ATTEMPTS = 3
VISITOR_LOCK_RETRY_BASE_DELAY = 0.05


def client_ip(request):
    forwarded_for = request.META.get("HTTP_X_FORWARDED_FOR", "")
    if forwarded_for:
        return forwarded_for.split(",", 1)[0].strip()
    return request.META.get("REMOTE_ADDR", "")


def hash_ip(ip):
    if not ip:
        return ""
    salt = getattr(settings, "SECRET_KEY", "")
    return hashlib.sha256(f"{salt}:{ip}".encode("utf-8")).hexdigest()


def user_agent(request):
    return request.META.get("HTTP_USER_AGENT", "")[:255]


def visitor_id_from_request(request):
    raw = request.META.get(VISITOR_META_HEADER, "")
    try:
        return uuid.UUID(str(raw))
    except (TypeError, ValueError):
        return uuid.uuid4()


def should_track_visitor(request):
    if request.method == "OPTIONS":
        return False
    path = request.path or ""
    skipped_prefixes = (
        "/admin",
        "/static",
        "/media",
        "/product-events/",
        "/site-settings/capabilities",
        "/login/wechat/bridge/",
    )
    return not path.startswith(skipped_prefixes)


def authenticated_user(request):
    user = getattr(request, "user", None)
    if not user or isinstance(user, AnonymousUser) or not user.is_authenticated:
        return None
    return user


def _is_sqlite_lock(exc):
    if isinstance(exc, OperationalError):
        return "locked" in str(exc).lower()
    return False


def persist_anonymous_visitor(visitor_id, *, user_agent_value, ip_hash_value):
    """Create or refresh an anonymous visitor while throttling writes.

    Writing ``last_seen_at`` on every request causes SQLite write-lock
    contention when several requests share one visitor id.  We only refresh
    the row when the visitor is new, the observed user agent or IP hash
    changed, or the previous refresh is older than the throttle window.
    """
    now = timezone.now()
    visitor = AnonymousVisitor.objects.filter(id=visitor_id).first()

    if visitor is None:
        try:
            return AnonymousVisitor.objects.create(
                id=visitor_id,
                user_agent=user_agent_value,
                ip_hash=ip_hash_value,
            )
        except IntegrityError:
            # Another concurrent request already created this visitor.
            visitor = AnonymousVisitor.objects.filter(id=visitor_id).first()
            if visitor is None:
                raise

    changed = visitor.user_agent != user_agent_value or visitor.ip_hash != ip_hash_value
    throttle = getattr(settings, "AUDIT_VISITOR_LAST_SEEN_THROTTLE_SECONDS", 60)
    stale = (
        visitor.last_seen_at is None
        or (now - visitor.last_seen_at).total_seconds() >= throttle
    )
    if changed or stale:
        AnonymousVisitor.objects.filter(id=visitor_id).update(
            user_agent=user_agent_value,
            ip_hash=ip_hash_value,
            last_seen_at=now,
        )
        visitor.user_agent = user_agent_value
        visitor.ip_hash = ip_hash_value
        visitor.last_seen_at = now
    return visitor


def _persist_visitor_with_retry(visitor_id, *, user_agent_value, ip_hash_value):
    for attempt in range(VISITOR_LOCK_RETRY_ATTEMPTS):
        try:
            return persist_anonymous_visitor(
                visitor_id,
                user_agent_value=user_agent_value,
                ip_hash_value=ip_hash_value,
            )
        except OperationalError as exc:
            if not _is_sqlite_lock(exc) or attempt == VISITOR_LOCK_RETRY_ATTEMPTS - 1:
                raise
            time.sleep(VISITOR_LOCK_RETRY_BASE_DELAY * (attempt + 1))
    return None


class VisitorTrackingMiddleware(MiddlewareMixin):
    def process_request(self, request):
        request._audit_started_at = time.monotonic()
        request._audit_context_token = set_current_request(request)
        if not should_track_visitor(request):
            return
        visitor_id = visitor_id_from_request(request)
        request._visitor_id = visitor_id
        try:
            request.visitor = _persist_visitor_with_retry(
                visitor_id,
                user_agent_value=user_agent(request),
                ip_hash_value=hash_ip(client_ip(request)),
            )
        except Exception:
            # 审计是旁路能力；SQLite 写锁或审计表异常不能把正常业务请求变成 500。
            request.visitor = None
            logger.exception("Failed to persist anonymous visitor")

    def process_response(self, request, response):
        visitor = getattr(request, "visitor", None)
        visitor_id = getattr(request, "_visitor_id", None)
        if visitor_id:
            response[VISITOR_HEADER] = str(visitor_id)

        if visitor and should_track_visitor(request):
            started_at = getattr(request, "_audit_started_at", None)
            duration_ms = 0
            if started_at is not None:
                duration_ms = max(int((time.monotonic() - started_at) * 1000), 0)
            try:
                VisitorEvent.objects.create(
                    visitor=visitor,
                    user=authenticated_user(request),
                    method=request.method,
                    path=(request.path or "")[:512],
                    status_code=getattr(response, "status_code", 0) or 0,
                    request_id=request_id(request),
                    duration_ms=duration_ms,
                )
            except Exception:
                # 响应已经由业务层生成；事件落库失败只记录诊断信息。
                logger.exception("Failed to persist visitor event")

        token = getattr(request, "_audit_context_token", None)
        if token is not None:
            reset_current_request(token)
        return response
