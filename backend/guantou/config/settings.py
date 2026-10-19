import os
import time

import environ
from django.core.exceptions import ImproperlyConfigured

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PROJECT_ROOT = os.path.dirname(os.path.dirname(BASE_DIR))

env = environ.Env()
explicit_env_file = os.environ.get("ENV_FILE")
if explicit_env_file:
    environ.Env.read_env(explicit_env_file)
else:
    # Keep direct ``manage.py`` invocations and repository-root launches in
    # agreement. Real environment variables always win over either file.
    environ.Env.read_env(os.path.join(PROJECT_ROOT, ".env"))
    environ.Env.read_env(os.path.join(BASE_DIR, ".env"))

ENVIRONMENT = env.str("ENVIRONMENT", "development").strip().lower()
# Resolve writable defaults before this module creates the log directory.
DEFAULT_DATA_DIR = "/data" if ENVIRONMENT == "production" else BASE_DIR

# Quick-start development settings - unsuitable for production
# See https://docs.djangoproject.com/en/3.0/howto/deployment/checklist/

# SECURITY WARNING: keep the secret key used in production secret!
SECRET_KEY = env.str("SECRET_KEY", "DEFAULT_SECRET_KEY")

# Throttle anonymous-visitor last_seen_at refreshes to reduce SQLite write
# lock contention when many requests reuse one visitor id.
AUDIT_VISITOR_LAST_SEEN_THROTTLE_SECONDS = env.int(
    "AUDIT_VISITOR_LAST_SEEN_THROTTLE_SECONDS", 60
)

# SECURITY WARNING: don't run with debug turned on in production!
DEBUG = env.bool("DEBUG", False)

# The current public build is an intentionally passwordless demo.  Keep the
# verification code visible until an SMS provider is configured, then set this
# to false before accepting real user phone numbers.
PHONE_CODE_DEMO_MODE = env.bool("PHONE_CODE_DEMO_MODE", True)
PHONE_CODE_TTL_SECONDS = env.int("PHONE_CODE_TTL_SECONDS", 300)
PHONE_CODE_THROTTLE_SECONDS = env.int("PHONE_CODE_THROTTLE_SECONDS", 60)

ALLOWED_HOSTS = ["*"]

# Application definition

INSTALLED_APPS = [
    "simpleui",
    "django.contrib.admin",
    "django.contrib.auth",
    "django.contrib.contenttypes",
    "django.contrib.sessions",
    "django.contrib.messages",
    "django.contrib.staticfiles",
    "rest_framework",
    "announcements",
    "user",
    "guantou",
    "audit",
    "siteconfig",
    "files",
    "inbox",
    "themes",
    "productanalytics",
    "corsheaders",
]

PRODUCT_EVENT_RETENTION_DAYS = env.int("PRODUCT_EVENT_RETENTION_DAYS", 90)
if not 1 <= PRODUCT_EVENT_RETENTION_DAYS <= 90:
    raise ImproperlyConfigured("PRODUCT_EVENT_RETENTION_DAYS must be between 1 and 90")

MIDDLEWARE = [
    "django.middleware.security.SecurityMiddleware",
    "django.contrib.sessions.middleware.SessionMiddleware",
    "corsheaders.middleware.CorsMiddleware",
    "django.middleware.common.CommonMiddleware",
    "django.middleware.csrf.CsrfViewMiddleware",
    "django.contrib.auth.middleware.AuthenticationMiddleware",
    "django.contrib.messages.middleware.MessageMiddleware",
    "django.middleware.clickjacking.XFrameOptionsMiddleware",
    "utils.exceptions.middleware.ExceptionMiddleware",
    "audit.middleware.VisitorTrackingMiddleware",
]

ROOT_URLCONF = "config.urls"

TEMPLATES = [
    {
        "BACKEND": "django.template.backends.django.DjangoTemplates",
        "DIRS": [],
        "APP_DIRS": True,
        "OPTIONS": {
            "context_processors": [
                "django.template.context_processors.debug",
                "django.template.context_processors.request",
                "django.contrib.auth.context_processors.auth",
                "django.contrib.messages.context_processors.messages",
            ],
        },
    },
]

WSGI_APPLICATION = "config.wsgi.application"

# Database
# https://docs.djangoproject.com/en/3.0/ref/settings/#databases

DATABASES = {
    "default": {
        "ENGINE": "django.db.backends.sqlite3",
        "NAME": env.str("SQLITE_PATH", os.path.join(DEFAULT_DATA_DIR, "db.sqlite3")),
    }
}

# Password validation
# https://docs.djangoproject.com/en/3.0/ref/settings/#auth-password-validators

AUTH_PASSWORD_VALIDATORS = [
    {
        "NAME": "django.contrib.auth.password_validation.UserAttributeSimilarityValidator",
    },
    {
        "NAME": "django.contrib.auth.password_validation.MinimumLengthValidator",
        "OPTIONS": {"min_length": 6},
    },
    {
        "NAME": "django.contrib.auth.password_validation.CommonPasswordValidator",
    },
    {
        "NAME": "django.contrib.auth.password_validation.NumericPasswordValidator",
    },
]

# Internationalization
# https://docs.djangoproject.com/en/3.0/topics/i18n/

LANGUAGE_CODE = "zh-hans"

TIME_ZONE = "Asia/Shanghai"

USE_I18N = True

USE_TZ = False

STATIC_URL = "/static/"
STATIC_ROOT = os.path.join(BASE_DIR, "staticfiles")

LOGIN_REDIRECT_URL = "/home/"
LOGIN_URL = "/login"
EMAIL_HOST = env.str("EMAIL_HOST", "DEFAULT_EMAIL_HOST")
EMAIL_HOST_USER = env.str("EMAIL_HOST_USER", "DEFAULT_EMAIL_HOST_USER")
EMAIL_HOST_PASSWORD = env.str("EMAIL_HOST_PASSWORD", "DEFAULT_EMAIL_HOST_PASSWORD")
EMAIL_PORT = env.int("EMAIL_PORT", 465)
EMAIL_USE_SSL = env.bool("EMAIL_USE_SSL", True)
EMAIL_USE_TLS = env.bool("EMAIL_USE_TLS", False)
DEFAULT_FROM_EMAIL = env.str("DEFAULT_FROM_EMAIL", "DEFAULT_DEFAULT_FROM_EMAIL")
EMAIL_CODE_TTL_SECONDS = env.int("EMAIL_CODE_TTL_SECONDS", 600)
EMAIL_CODE_THROTTLE_SECONDS = env.int("EMAIL_CODE_THROTTLE_SECONDS", 60)
EMAIL_CODE_MAX_ATTEMPTS = env.int("EMAIL_CODE_MAX_ATTEMPTS", 5)
DEFAULT_AVATAR_URL = env.str(
    "DEFAULT_AVATAR_URL",
    "https://cos.edialect.top/website/默认头像.jpg",
)
# EMAIL_BACKEND = 'django.core.mail.backends.console.EmailBackend'

# 媒体图片下载到media/下
MEDIA_URL = "/media/"
MEDIA_ROOT = env.str("MEDIA_ROOT", os.path.join(DEFAULT_DATA_DIR, "media"))
# Public origin used to build local file URLs when COS is not configured.
PUBLIC_BACKEND_URL = env.str("PUBLIC_BACKEND_URL", "http://localhost:8000")


# 跨域访问设置
CORS_ALLOW_ALL_ORIGINS = True

APPEND_SLASH = False

CORS_ALLOW_CREDENTIALS = True
CORS_ALLOWED_ORIGINS = (
    "http://127.0.0.1:*",
    "https://api.pxm.edialect.top:*",
    "https://pxm.edialect.top:*",
    "https://localhost:*",
)
CORS_ALLOW_METHODS = (
    "DELETE",
    "GET",
    "OPTIONS",
    "PATCH",
    "POST",
    "PUT",
    "VIEW",
)
CORS_ALLOW_HEADERS = (
    "XMLHttpRequest",
    "X_FILENAME",
    "accept-encoding",
    "authorization",
    "content-type",
    "dnt",
    "origin",
    "user-agent",
    "x-csrftoken",
    "x-requested-with",
    "x-visitor-id",
    "Pragma",
)

CORS_EXPOSE_HEADERS = (
    "X-Request-ID",
    "X-Visitor-ID",
)

CSRF_TRUSTED_ORIGINS = [
    "http://127.0.0.1:*",
    "https://api.pxm.edialect.top",
    "https://api.pxm.test.edialect.top",
    "https://pxm.edialect.top:*",
    "https://localhost:*",
]

# parameter of Tencent cos
COS_SECRET_ID = env.str(
    "COS_SECRET_ID", "DEFAULT_COS_SECRET_ID"
)  # 替换为用户的 secretId
COS_SECRET_KEY = env.str(
    "COS_SECRET_KEY", "DEFAULT_COS_SECRET_KEY"
)  # 替换为用户的 secretKey
COS_BUCKET = env.str("COS_BUCKET", "DEFAULT_COS_BUCKET")  # BucketName-APPID
COS_REGION = env.str("COS_REGION", "DEFAULT_COS_REGION")

# parameter of wechat login
# 小程序 AppID and Secret
APP_ID = env.str("APP_ID", "DEFAULT_APP_ID")
APP_SECRET = env.str("APP_SECRET", env.str("APP_SECRECT", "DEFAULT_APP_SECRET"))
# Backward-compatible alias for old code paths and old local env files.
APP_SECRECT = APP_SECRET

# Web OAuth credentials are a different WeChat application identity. Never
# silently reuse mini-program credentials for web authorization.
WEB_APP_ID = env.str("WEB_APP_ID", "")
WEB_APP_SECRET = env.str("WEB_APP_SECRET", "")

# parameter of jwt
JWT_KEY = env.str("JWT_KEY", "DEFAULT_JWT_KEY")


def _is_placeholder(value):
    return not str(value).strip() or str(value).startswith("DEFAULT_")


# Keep the code visible until a real SMTP host is configured, matching
# PHONE_CODE_DEMO_MODE. Production already rejects placeholder EMAIL_HOST.
EMAIL_CODE_DEMO_MODE = env.bool(
    "EMAIL_CODE_DEMO_MODE",
    _is_placeholder(EMAIL_HOST),
)
WECHAT_BIND_DEMO_MODE = env.bool(
    "WECHAT_BIND_DEMO_MODE",
    _is_placeholder(APP_ID),
)


if EMAIL_USE_SSL and EMAIL_USE_TLS:
    raise ImproperlyConfigured("EMAIL_USE_SSL and EMAIL_USE_TLS cannot both be true")
if (
    min(
        EMAIL_CODE_TTL_SECONDS,
        EMAIL_CODE_THROTTLE_SECONDS,
        EMAIL_CODE_MAX_ATTEMPTS,
    )
    <= 0
):
    raise ImproperlyConfigured("Email verification limits must be positive")

if ENVIRONMENT == "production":
    required_secrets = {
        "SECRET_KEY": SECRET_KEY,
        "JWT_KEY": JWT_KEY,
        "EMAIL_HOST": EMAIL_HOST,
        "EMAIL_HOST_USER": EMAIL_HOST_USER,
        "EMAIL_HOST_PASSWORD": EMAIL_HOST_PASSWORD,
        "DEFAULT_FROM_EMAIL": DEFAULT_FROM_EMAIL,
        "COS_SECRET_ID": COS_SECRET_ID,
        "COS_SECRET_KEY": COS_SECRET_KEY,
        "COS_BUCKET": COS_BUCKET,
        "COS_REGION": COS_REGION,
        "APP_ID": APP_ID,
        "APP_SECRET": APP_SECRET,
    }
    missing = [
        name for name, value in required_secrets.items() if _is_placeholder(value)
    ]
    if missing:
        raise ImproperlyConfigured(
            "Missing production settings: " + ", ".join(sorted(missing))
        )

log_path = env.str("LOG_DIR", os.path.join(DEFAULT_DATA_DIR, "logs"))
os.makedirs(log_path, exist_ok=True)

LOGGING = {
    "version": 1,
    "disable_existing_loggers": False,
    "formatters": {
        "standard": {
            "format": "[%(asctime)s] [%(levelname)s] : "
            "[%(filename)s:%(lineno)d] [%(module)s:%(funcName)s] "
            "- %(message)s"
        },
        "simple": {"format": "%(levelname)s %(module)s %(lineno)d %(message)s"},
        "verbose": {
            "format": "%(levelname)s %(asctime)s %(module)s %(lineno)d %(message)s"
        },
    },
    "filters": {"require_debug_true": {"()": "django.utils.log.RequireDebugTrue"}},
    "handlers": {
        "console": {
            "class": "logging.StreamHandler",
            "level": "DEBUG",
            "formatter": "simple",
            "filters": ["require_debug_true"],
        },
        # 默认记录所有日志
        "default": {
            "level": "INFO",
            "class": "logging.handlers.RotatingFileHandler",
            "filename": os.path.join(
                log_path, "all-{}.log".format(time.strftime("%Y-%m-%d"))
            ),
            "maxBytes": 1024 * 1024 * 5,  # 文件大小
            "backupCount": 5,  # 备份数
            "formatter": "standard",  # 输出格式
            "encoding": "utf-8",  # 设置默认编码，否则打印出来汉字乱码
        },
        # 输出错误日志
        "error": {
            "level": "ERROR",
            "class": "logging.handlers.RotatingFileHandler",
            "filename": os.path.join(
                log_path, "error-{}.log".format(time.strftime("%Y-%m-%d"))
            ),
            "maxBytes": 1024 * 1024 * 5,  # 文件大小
            "backupCount": 5,  # 备份数
            "formatter": "standard",  # 输出格式
            "encoding": "utf-8",  # 设置默认编码
        },
        # 输出info日志
        "info": {
            "level": "INFO",
            "class": "logging.handlers.RotatingFileHandler",
            "filename": os.path.join(
                log_path, "info-{}.log".format(time.strftime("%Y-%m-%d"))
            ),
            "maxBytes": 1024 * 1024 * 5,
            "backupCount": 5,
            "formatter": "standard",
            "encoding": "utf-8",  # 设置默认编码
        },
    },
    # 配置日志处理器
    "loggers": {
        "django": {
            "handlers": ["default", "console"],
            "level": "INFO",  # 日志器接收的最低日志级别
            "propagate": True,
        },
        # log 调用时需要当作参数传入
        "log": {
            "handlers": ["error", "info", "console", "default"],
            "level": "INFO",
            "propagate": True,
        },
    },
}
DATA_UPLOAD_MAX_NUMBER_FIELDS = 10240

REST_FRAMEWORK = {
    "EXCEPTION_HANDLER": "utils.exceptions.handler.drf_exception_handler",
    "DEFAULT_AUTHENTICATION_CLASSES": [
        "guantou.authentication.BearerTokenAuthentication",
        "rest_framework.authentication.SessionAuthentication",
    ],
    "DEFAULT_PERMISSION_CLASSES": [
        "rest_framework.permissions.IsAuthenticatedOrReadOnly",
    ],
    "DEFAULT_PAGINATION_CLASS": "guantou.pagination.ApiPageNumberPagination",
    "PAGE_SIZE": 15,
}

# 保存的拼音语料.mp3
# 分为submit和combine两个文件夹
SAVED_PINYIN = os.path.join(BASE_DIR, "material", "audio")
TIME_ZONE = "Asia/Shanghai"
USE_TZ = True
CACHES = {
    "default": {
        "BACKEND": "django.core.cache.backends.locmem.LocMemCache",
        "LOCATION": "default_cache_table",
    },
}
SIMPLEUI_LOGO = ""
SIMPLEUI_HOME_INFO = False
SIMPLEUI_HOME_ACTION = False
SIMPLEUI_ANALYSIS = False
DEFAULT_AUTO_FIELD = "django.db.models.AutoField"
