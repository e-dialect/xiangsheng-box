import os
import random
import re
from urllib.parse import unquote, urlsplit

import requests
from django.conf import settings
from django.core.exceptions import ImproperlyConfigured
from qcloud_cos import CosConfig, CosS3Client


def random_str(length=6, digit_only=False):
    chars = (
        "1234567890"
        if digit_only
        else "1234567890abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ"
    )
    return "".join(random.choice(chars) for _ in range(length))


def _is_placeholder(value):
    return not str(value or "").strip() or str(value).startswith("DEFAULT_")


def cos_is_configured():
    region = str(getattr(settings, "COS_REGION", "") or "")
    secret_id = str(getattr(settings, "COS_SECRET_ID", "") or "")
    bucket = str(getattr(settings, "COS_BUCKET", "") or "")
    if _is_placeholder(region) or not re.fullmatch(r"[0-9A-Za-z-]+", region):
        return False
    if _is_placeholder(secret_id) or _is_placeholder(bucket):
        return False
    return True


def _key_prefix():
    """Return the validated optional object-key namespace for this app."""
    raw_prefix = getattr(
        settings, "COS_KEY_PREFIX", os.environ.get("COS_KEY_PREFIX", "")
    )
    prefix = str(raw_prefix or "")
    if not prefix:
        return ()
    segments = prefix.split("/")
    if (
        prefix.startswith("/")
        or prefix.endswith("/")
        or any(not segment or segment in {".", ".."} for segment in segments)
        or any(not re.fullmatch(r"[A-Za-z0-9._-]+", segment) for segment in segments)
    ):
        raise ImproperlyConfigured(
            "COS_KEY_PREFIX must be a relative slash-separated object-key prefix"
        )
    return tuple(segments)


def _logical_key_segments(key):
    if not isinstance(key, str) or not key or "\\" in key or "%" in key:
        raise ValueError("Invalid file object key")
    segments = key.split("/")
    if (
        len(segments) != 7
        or segments[0] != "files"
        or any(not segment or segment in {".", ".."} for segment in segments)
        or any("\x00" in segment or ":" in segment for segment in segments)
        or not re.fullmatch(r"[A-Za-z0-9_-]+", segments[1])
        or not re.fullmatch(r"[0-9]+", segments[2])
        or not re.fullmatch(r"[0-9]{4}", segments[3])
        or not re.fullmatch(r"[0-9]{2}", segments[4])
        or not re.fullmatch(r"[0-9]{2}", segments[5])
        or not re.fullmatch(r"[A-Za-z0-9._-]+", segments[6])
    ):
        raise ValueError("Invalid file object key")
    if segments[6] in {".", ".."}:
        raise ValueError("Invalid file object key")
    return tuple(segments)


def _cos_key(logical_key):
    return "/".join((*_key_prefix(), *_logical_key_segments(logical_key)))


def logical_key_from_url(url):
    """Validate an uploaded file URL and return its unprefixed app key.

    COS URLs must use the public domain selected by the configured bucket and,
    when configured, carry this app's exact key prefix. Local media URLs must
    match PUBLIC_BACKEND_URL. Query strings, fragments and encoded separators
    are rejected to keep URL parsing unambiguous.
    """
    if not isinstance(url, str) or not url:
        raise ValueError("Invalid file URL")
    parsed = urlsplit(url)
    if (
        parsed.scheme not in {"http", "https"}
        or not parsed.netloc
        or parsed.username is not None
        or parsed.password is not None
        or parsed.query
        or parsed.fragment
        or "%" in parsed.path
    ):
        raise ValueError("Invalid file URL")

    base_path = ""
    hostname = (parsed.hostname or "").lower()
    cos_host = (
        "cos.test.edialect.top"
        if "test" in str(getattr(settings, "COS_BUCKET", ""))
        else "cos.edialect.top"
    )
    is_cos_url = (
        parsed.scheme == "https" and hostname == cos_host and parsed.port is None
    )
    if not is_cos_url:
        public_base = urlsplit(
            str(getattr(settings, "PUBLIC_BACKEND_URL", "http://localhost:8000"))
        )
        if (
            public_base.scheme not in {"http", "https"}
            or not public_base.netloc
            or public_base.username is not None
            or public_base.password is not None
            or parsed.scheme.lower() != public_base.scheme.lower()
            or parsed.netloc.lower() != public_base.netloc.lower()
        ):
            raise ValueError("File URL host is not allowed")
        base_path = public_base.path.rstrip("/")
        if base_path and not parsed.path.startswith(base_path + "/"):
            raise ValueError("File URL path is outside the public backend")

    path = parsed.path[len(base_path) :] if base_path else parsed.path
    if not path.startswith("/") or "//" in path:
        raise ValueError("Invalid file URL path")
    object_key = unquote(path[1:])
    prefix = _key_prefix()
    if is_cos_url and prefix:
        object_segments = tuple(object_key.split("/"))
        if object_segments[: len(prefix)] != prefix:
            raise ValueError("File URL is outside this app's COS namespace")
        object_key = "/".join(object_segments[len(prefix) :])
    segments = _logical_key_segments(object_key)
    return "/".join(segments)


def public_file_url(key):
    base = str(getattr(settings, "PUBLIC_BACKEND_URL", "") or "http://localhost:8000")
    return f"{base.rstrip('/')}/{str(key).lstrip('/')}"


def upload_file(path, key):
    if not cos_is_configured():
        return public_file_url(key)
    object_key = _cos_key(key)
    client = cos_client()
    client.upload_file(Bucket=settings.COS_BUCKET, LocalFilePath=path, Key=object_key)
    if settings.COS_BUCKET.find("test") != -1:
        return f"https://cos.test.edialect.top/{object_key}"
    return f"https://cos.edialect.top/{object_key}"


def delete_file(key):
    if not cos_is_configured():
        return
    cos_client().delete_object(Bucket=settings.COS_BUCKET, Key=_cos_key(key))


def download_file(url, file_type, user_id, filename):
    try:
        folder = os.path.join(settings.MEDIA_ROOT, file_type, user_id)
        os.makedirs(folder, exist_ok=True)
        path = os.path.join(folder, filename)
        response = requests.get(url, timeout=30)
        response.raise_for_status()
        with open(path, "wb") as f:
            f.write(response.content)
        key = f'files/{file_type}/{user_id}/{filename.replace("_", "/")}'
        return upload_file(path, key)
    except Exception as exc:
        print(f"download_file failed: {exc}")
        return None


def cos_client():
    config = CosConfig(
        Region=settings.COS_REGION,
        SecretId=settings.COS_SECRET_ID,
        SecretKey=settings.COS_SECRET_KEY,
    )
    return CosS3Client(config)
