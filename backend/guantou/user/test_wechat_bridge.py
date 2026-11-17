import re
from datetime import timedelta
from unittest.mock import patch

from django.contrib.auth.models import User
from django.core.cache import cache
from django.test import TestCase, override_settings
from django.utils import timezone

from user.models import UserInfo, WechatLoginRequest
from user.tokens import token_user
from user.view.wechat_bridge import OpenId
from user.wechat_launch import WechatLaunchUnavailable, launch_url, mini_program_code

BASE_URL = "/login/wechat/bridge/"
LAUNCH_URL = "https://wxaurl.cn/test-ticket"
QR_IMAGE = "data:image/png;base64,AA=="


@override_settings(
    WECHAT_BRIDGE_WEB_ENABLED=True,
    WECHAT_BRIDGE_APP_ENABLED=True,
    APP_ID="configured-mini-program",
    APP_SECRET="configured-secret",
)
class WechatBridgeTests(TestCase):
    def setUp(self):
        cache.clear()

    def start(self, channel="web"):
        with (
            patch("user.view.wechat_bridge.launch_url", return_value=LAUNCH_URL),
            patch("user.view.wechat_bridge.mini_program_code", return_value=QR_IMAGE),
        ):
            response = self.client.post(
                BASE_URL + "start",
                {"channel": channel},
                content_type="application/json",
            )
        self.assertEqual(response.status_code, 201, response.content)
        self.assertIn("no-store", response["Cache-Control"])
        return response.json()

    def post(self, action, **kwargs):
        return self.client.post(
            BASE_URL + action, kwargs, content_type="application/json"
        )

    def confirm(self, attempt, openid):
        with patch.object(OpenId, "get_openid", return_value=openid):
            return self.post(
                "confirm", request_id=attempt["request_id"], jscode="wx-code"
            )

    def redeem(self, attempt):
        return self.post(
            "exchange",
            request_id=attempt["request_id"],
            exchange_key=attempt["exchange_key"],
        )

    def test_existing_binding_is_reused_and_only_the_initiator_can_redeem(self):
        user = User.objects.create_user(username="existing")
        UserInfo.objects.create(user=user, wechat="already-linked")
        attempt = self.start("app")
        self.assertEqual(attempt["launch_url"], LAUNCH_URL)
        self.assertNotIn(attempt["exchange_key"], attempt["launch_url"])
        login = WechatLoginRequest.objects.get(pk=attempt["request_id"])
        self.assertNotEqual(login.exchange_digest, attempt["exchange_key"])
        response = self.client.get(BASE_URL + "details", {"request_id": login.pk})
        self.assertEqual(
            response.json(), {"channel": "app", "reference": attempt["reference"]}
        )
        self.assertEqual(self.redeem(attempt).status_code, 202)

        self.assertEqual(self.confirm(attempt, "already-linked").status_code, 200)
        self.assertEqual(self.post("exchange", request_id=login.pk).status_code, 410)
        self.assertEqual(
            self.post(
                "exchange", request_id=login.pk, exchange_key="x" * 43
            ).status_code,
            410,
        )
        response = self.redeem(attempt)
        self.assertEqual(response.status_code, 200)
        payload = response.json()
        self.assertEqual(payload["id"], user.pk)
        self.assertFalse(payload["isNew"])
        self.assertEqual(token_user(payload["token"]), user)
        self.assertEqual(self.redeem(attempt).status_code, 410)

    def test_first_confirmation_creates_one_account_across_web_app_and_qr(self):
        qr_attempt = self.start("web_qr")
        self.assertEqual(qr_attempt["qr_image"], QR_IMAGE)
        self.assertTrue(re.fullmatch("[0-9a-f]{32}", qr_attempt["request_id"]))
        self.assertEqual(self.confirm(qr_attempt, "new-openid").status_code, 200)
        self.assertEqual(self.confirm(qr_attempt, "different-openid").status_code, 410)
        new = self.redeem(qr_attempt).json()
        self.assertTrue(new["isNew"])
        self.assertFalse(User.objects.get(pk=new["id"]).has_usable_password())
        for channel in ("web", "app"):
            with self.subTest(channel=channel):
                attempt = self.start(channel)
                self.assertEqual(self.confirm(attempt, "new-openid").status_code, 200)
                existing = self.redeem(attempt).json()
                self.assertEqual(existing["id"], new["id"])
                self.assertFalse(existing["isNew"])
        self.assertEqual(User.objects.count(), 1)

    def test_cancel_and_expiry_invalidate_requests_before_registration(self):
        attempt = self.start()
        self.post("cancel", request_id=attempt["request_id"], exchange_key="x" * 43)
        self.assertEqual(self.redeem(attempt).status_code, 202)
        self.post(
            "cancel",
            request_id=attempt["request_id"],
            exchange_key=attempt["exchange_key"],
        )
        self.assertEqual(self.confirm(attempt, "new-openid").status_code, 410)
        self.assertEqual(self.redeem(attempt).status_code, 410)

        another = self.start()
        WechatLoginRequest.objects.filter(pk=another["request_id"]).update(
            expires_at=timezone.now() - timedelta(seconds=1)
        )
        self.assertEqual(self.confirm(another, "new-openid").status_code, 410)
        self.assertEqual(self.redeem(another).status_code, 410)
        self.assertFalse(User.objects.exists())

    def test_rejects_approval_if_binding_was_removed_before_exchange(self):
        user = User.objects.create_user(username="existing")
        info = UserInfo.objects.create(user=user, wechat="already-linked")
        attempt = self.start()
        self.assertEqual(self.confirm(attempt, info.wechat).status_code, 200)
        info.wechat = ""
        info.save(update_fields=["wechat"])
        self.assertEqual(self.redeem(attempt).status_code, 410)

    @override_settings(WECHAT_BRIDGE_WEB_ENABLED=False)
    def test_flags_are_independent(self):
        flags = self.client.get(BASE_URL + "availability")
        self.assertEqual(flags.json(), {"web": False, "app": True})
        self.assertEqual(self.post("start", channel="web").status_code, 503)
        self.assertEqual(self.post("start", channel="web_qr").status_code, 503)
        self.assertEqual(self.start("app")["launch_url"], LAUNCH_URL)

    def test_wechat_launch_failure_leaves_no_usable_request(self):
        with patch(
            "user.view.wechat_bridge.launch_url", side_effect=WechatLaunchUnavailable
        ):
            response = self.post("start", channel="web")
        self.assertEqual(response.status_code, 502)
        self.assertIn("无法打开微信小程序", response.json()["message"])
        self.assertFalse(WechatLoginRequest.objects.exists())

    def test_uses_wechat_link_and_qr_apis_with_the_public_request_id(self):
        request_id = "9" * 32
        with patch("user.wechat_launch.requests.post") as post:
            token, link, qr = [post.return_value] * 3
            token.json.side_effect = [
                {"access_token": "test-access-token", "expires_in": 7200},
                {"url_link": LAUNCH_URL},
            ]
            qr.content = b"\xff\xd8\xffdummy-jpeg"
            expires = timezone.now() + timedelta(minutes=5)
            self.assertEqual(launch_url(request_id, expires), LAUNCH_URL)
            self.assertTrue(
                mini_program_code(request_id).startswith("data:image/jpeg;base64,")
            )

        token_call, link_call, qr_call = post.call_args_list
        self.assertTrue(token_call.args[0].endswith("/cgi-bin/stable_token"))
        self.assertEqual(token_call.kwargs["json"]["appid"], "configured-mini-program")
        self.assertTrue(link_call.args[0].endswith("/wxa/generate_urllink"))
        self.assertEqual(link_call.kwargs["json"]["query"], f"request_id={request_id}")
        self.assertEqual(
            link_call.kwargs["json"]["expire_time"], int(expires.timestamp())
        )
        self.assertTrue(qr_call.args[0].endswith("/wxa/getwxacodeunlimit"))
        self.assertEqual(qr_call.kwargs["json"]["scene"], request_id)
        self.assertEqual(
            qr_call.kwargs["json"]["page"], link_call.kwargs["json"]["path"]
        )
