"""Production settings for the shared HTTPS gateway; no embedded credentials."""

import copy
import re
from urllib.parse import urlsplit

from django.core.exceptions import ImproperlyConfigured

from .settings import *  # noqa: F403,F401

if ENVIRONMENT != "production":
    raise ImproperlyConfigured("Production settings require ENVIRONMENT=production")
if DEBUG or PHONE_CODE_DEMO_MODE or EMAIL_CODE_DEMO_MODE or WECHAT_BIND_DEMO_MODE:
    raise ImproperlyConfigured("Production cannot enable debug or demo authentication")
for name, value in (("SECRET_KEY", SECRET_KEY), ("JWT_KEY", JWT_KEY)):
    if len(value) < 50 or value.startswith(("dev-", "ci-", "DEFAULT_")):
        raise ImproperlyConfigured(f"{name} requires a dedicated random production key")

origin = urlsplit(PUBLIC_BACKEND_URL)
if (
    origin.scheme != "https"
    or not origin.hostname
    or origin.username
    or origin.password
    or origin.path not in ("", "/")
    or origin.query
    or origin.fragment
    or origin.port not in (None, 443)
):
    raise ImproperlyConfigured("PUBLIC_BACKEND_URL must be an HTTPS origin")
PUBLIC_BACKEND_URL = f"https://{origin.hostname}"
ALLOWED_HOSTS = [origin.hostname, "127.0.0.1", "localhost"]
CORS_ALLOW_ALL_ORIGINS = False
CORS_ALLOWED_ORIGINS = [PUBLIC_BACKEND_URL]
CSRF_TRUSTED_ORIGINS = [PUBLIC_BACKEND_URL]
# The application has no host port; only the shared gateway supplies this header.
SECURE_PROXY_SSL_HEADER = ("HTTP_X_FORWARDED_PROTO", "https")
USE_X_FORWARDED_HOST = False
SECURE_SSL_REDIRECT = True
SECURE_REDIRECT_EXEMPT = [r"^site-settings/capabilities$"]
SECURE_HSTS_SECONDS = 31536000
SECURE_HSTS_INCLUDE_SUBDOMAINS = False
SECURE_HSTS_PRELOAD = False
SESSION_COOKIE_SECURE = True
CSRF_COOKIE_SECURE = True
SESSION_COOKIE_NAME = "xiangsheng_box_sessionid"
CSRF_COOKIE_NAME = "xiangsheng_box_csrftoken"
SESSION_COOKIE_DOMAIN = None
CSRF_COOKIE_DOMAIN = None

COS_KEY_PREFIX = env.str("COS_KEY_PREFIX", "")
if not re.fullmatch(r"[A-Za-z0-9][A-Za-z0-9_-]{0,62}", COS_KEY_PREFIX):
    raise ImproperlyConfigured("Production requires a dedicated COS_KEY_PREFIX")

MIDDLEWARE = list(MIDDLEWARE)
MIDDLEWARE.insert(
    MIDDLEWARE.index("django.middleware.security.SecurityMiddleware") + 1,
    "whitenoise.middleware.WhiteNoiseMiddleware",
)


class ValidateHostMiddleware:
    """Validate even exempt health paths before any response short-circuit."""

    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        request.get_host()
        return self.get_response(request)


MIDDLEWARE.insert(0, "config.production.ValidateHostMiddleware")
STORAGES = {
    "default": {"BACKEND": "django.core.files.storage.FileSystemStorage"},
    "staticfiles": {
        "BACKEND": "whitenoise.storage.CompressedStaticFilesStorage",
    },
}
DATABASES = copy.deepcopy(DATABASES)
DATABASES["default"]["OPTIONS"] = {"timeout": 20}
# Keep logs in the bounded Docker logging pipeline, rather than daily files.
LOGGING = {
    "version": 1,
    "disable_existing_loggers": False,
    "formatters": {
        "standard": {"format": "%(levelname)s %(name)s:%(lineno)d %(message)s"}
    },
    "handlers": {
        "console": {
            "class": "logging.StreamHandler",
            "formatter": "standard",
        }
    },
    "root": {"handlers": ["console"], "level": "INFO"},
    "loggers": {
        "django": {"handlers": ["console"], "level": "INFO", "propagate": False},
        "log": {"handlers": ["console"], "level": "INFO", "propagate": False},
    },
}
