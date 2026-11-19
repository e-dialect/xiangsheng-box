import json
import logging

from django.core.exceptions import PermissionDenied
from django.core.paginator import EmptyPage
from django.http import JsonResponse
from django.middleware.common import MiddlewareMixin

from .payload import api_error_payload, request_id
from .types.bad_request import BadRequestException
from .types.common import CommonException

logger = logging.getLogger("log")


class ExceptionMiddleware(MiddlewareMixin):
    """统一异常处理中间件"""

    def process_request(self, request):
        request_id(request)

    def process_response(self, request, response):
        rid = request_id(request)
        if rid:
            response["X-Request-ID"] = rid
        if response.status_code >= 400 and not hasattr(response, "data"):
            content_type = response.get("Content-Type", "")
            payload = {}
            if "application/json" in content_type:
                try:
                    payload = json.loads(response.content.decode(response.charset))
                except (ValueError, UnicodeDecodeError):
                    payload = {}
            already_normalized = isinstance(payload, dict) and (
                payload.get("code") == response.status_code
                and set(("message", "data", "request_id")).issubset(payload)
            )
            safe_public_error = bool(
                already_normalized and getattr(response, "safe_public_error", False)
            )
            if response.status_code >= 500 and not safe_public_error:
                if payload.get("message") != "服务器内部错误":
                    logger.error(
                        "Non-DRF server error response path=%s status=%s request_id=%s",
                        request.path,
                        response.status_code,
                        rid,
                    )
                response.content = json.dumps(
                    api_error_payload(
                        "服务器内部错误", response.status_code, data={}, rid=rid
                    ),
                    ensure_ascii=False,
                ).encode(response.charset)
                response["Content-Type"] = "application/json"
            elif not already_normalized:
                message = (
                    (
                        payload.get("message")
                        or payload.get("msg")
                        or payload.get("detail")
                    )
                    if isinstance(payload, dict)
                    else None
                ) or response.reason_phrase
                extra = (
                    {
                        key: value
                        for key, value in payload.items()
                        if key not in {"message", "msg", "detail", "code", "request_id"}
                    }
                    if isinstance(payload, dict)
                    else {}
                )
                response.content = json.dumps(
                    api_error_payload(
                        message, response.status_code, data=extra, rid=rid
                    ),
                    ensure_ascii=False,
                ).encode(response.charset)
                response["Content-Type"] = "application/json"
        return response

    def process_exception(self, request, exception) -> JsonResponse | None:
        """
        统一异常处理
        :param request: 请求对象
        :param exception: 异常对象
        :return:
        """
        # Let Django render permission refusals from the admin with its normal 403.
        if (
            isinstance(exception, PermissionDenied)
            and getattr(request.resolver_match, "app_name", None) == "admin"
        ):
            return None
        if isinstance(exception, EmptyPage):
            return BadRequestException(str(exception)).response(request)
        if isinstance(exception, KeyError):
            return BadRequestException("缺少必要参数").response(request)
        if isinstance(exception, ValueError):
            return BadRequestException("参数值异常").response(request)
        if isinstance(exception, CommonException):
            return exception.response(request)
        logger.exception("Unhandled request exception")
        return CommonException(exception).response(request)
