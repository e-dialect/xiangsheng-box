import re
from urllib.parse import urlsplit

from django.core.exceptions import ImproperlyConfigured

PROFILE_KEY = re.compile(r"[a-z][a-z0-9-]{0,39}")
DEFAULT_ORIGINS = {
    "https://box.test.edialect.top": "box",
    "https://pxm.test.edialect.top": "pxm",
}


def product_profile_origins(origins, *, production=False):
    if origins is None:
        return {} if production else DEFAULT_ORIGINS
    if not isinstance(origins, dict):
        raise ImproperlyConfigured(
            "BOX_PRODUCT_PROFILE_ORIGINS must be an origin-to-profile JSON object"
        )
    for origin, key in origins.items():
        try:
            url = urlsplit(origin)
            port = url.port
        except (TypeError, ValueError) as error:
            raise ImproperlyConfigured("Invalid site origin") from error
        local = url.hostname in {"localhost", "127.0.0.1"} or (
            url.hostname and url.hostname.endswith(".localhost")
        )
        scheme_allowed = url.scheme == "https" or (
            not production and local and url.scheme == "http"
        )
        if (
            not scheme_allowed
            or not url.hostname
            or not re.fullmatch(r"[a-z0-9.-]+", url.hostname)
            or port == {"http": 80, "https": 443}.get(url.scheme)
            or url.netloc != f"{url.hostname}{f':{port}' if port else ''}"
            or origin != f"{url.scheme}://{url.netloc}"
            or not isinstance(key, str)
            or not PROFILE_KEY.fullmatch(key)
        ):
            raise ImproperlyConfigured(f"Invalid site origin mapping: {origin!r}")
    return origins
