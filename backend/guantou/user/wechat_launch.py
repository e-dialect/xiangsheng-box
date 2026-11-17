import base64
import hashlib
import logging
from urllib.parse import urlsplit

import requests
from django.conf import settings
from django.core.cache import cache

logger = logging.getLogger(__name__)
API_ROOT = "https://api.weixin.qq.com"
CONFIRM_PAGE = "pages/login/wechat-confirm"


class WechatLaunchUnavailable(Exception):
    pass


def _post(endpoint, payload, *, params=None):
    try:
        response = requests.post(
            API_ROOT + endpoint,
            params=params,
            json=payload,
            timeout=8,
            allow_redirects=False,
        )
        response.raise_for_status()
        return response
    except requests.RequestException:
        raise WechatLaunchUnavailable from None


def _json(response):
    try:
        data = response.json()
    except ValueError:
        raise WechatLaunchUnavailable from None
    if not isinstance(data, dict):
        raise WechatLaunchUnavailable
    return data


def _access_token():
    credentials = f"{settings.APP_ID}:{settings.APP_SECRET}"
    key = f"wechat:stable-token:{hashlib.sha256(credentials.encode()).hexdigest()}"
    token = cache.get(key)
    if token:
        return token
    data = _json(
        _post(
            "/cgi-bin/stable_token",
            {
                "grant_type": "client_credential",
                "appid": settings.APP_ID,
                "secret": settings.APP_SECRET,
                "force_refresh": False,
            },
        )
    )
    token = data.get("access_token")
    expires_in = data.get("expires_in")
    if not isinstance(token, str) or not token or not isinstance(expires_in, int):
        logger.warning("wechat_bridge stable_token errcode=%s", data.get("errcode"))
        raise WechatLaunchUnavailable
    cache.set(key, token, max(1, expires_in - 60))
    return token


def _wechat_request(endpoint, payload):
    return _post(endpoint, payload, params={"access_token": _access_token()})


def launch_url(request_id, expires_at):
    data = _json(
        _wechat_request(
            "/wxa/generate_urllink",
            {
                "path": CONFIRM_PAGE,
                "query": f"request_id={request_id}",
                "env_version": "release",
                "is_expire": True,
                "expire_type": 0,
                "expire_time": int(expires_at.timestamp()),
            },
        )
    )
    url = data.get("url_link")
    if isinstance(url, str):
        try:
            parsed = urlsplit(url)
            if parsed.scheme == "https" and parsed.netloc in {
                "wxaurl.cn",
                "wxmpurl.cn",
            }:
                return url
        except ValueError:
            pass
    logger.warning("wechat_bridge generate_urllink errcode=%s", data.get("errcode"))
    raise WechatLaunchUnavailable


def mini_program_code(request_id):
    response = _wechat_request(
        "/wxa/getwxacodeunlimit",
        {
            "page": CONFIRM_PAGE,
            "scene": request_id,
            "width": 360,
            "check_path": True,
            "env_version": "release",
        },
    )
    image = response.content
    if len(image) > 512 * 1024:
        raise WechatLaunchUnavailable
    if image.startswith(b"\x89PNG\r\n\x1a\n"):
        mime = "image/png"
    elif image.startswith(b"\xff\xd8\xff"):
        mime = "image/jpeg"
    else:
        logger.warning(
            "wechat_bridge getwxacodeunlimit errcode=%s", _json(response).get("errcode")
        )
        raise WechatLaunchUnavailable
    return f"data:{mime};base64,{base64.b64encode(image).decode('ascii')}"
