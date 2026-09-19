from django.contrib.auth.models import User
from django.test import Client, TestCase

from user.models import UserInfo
from user.tokens import generate_token

from .models import Notification
from .services import send_event_notification, send_notification


def bearer(user):
    return f"Bearer {generate_token(user)}"


class InboxApiTests(TestCase):
    def setUp(self):
        self.sender = User.objects.create_user(username="sender", password="pw")
        self.recipient = User.objects.create_user(username="recipient", password="pw")
        UserInfo.objects.create(user=self.sender, nickname="发送者")
        UserInfo.objects.create(user=self.recipient, nickname="接收者")
        self.client = Client()

    def test_send_list_detail_and_mark_read(self):
        response = self.client.post(
            "/notifications",
            data='{"recipients": [%d], "title": "通知", "content": "内容"}'
            % self.recipient.id,
            content_type="application/json",
            HTTP_AUTHORIZATION=bearer(self.sender),
        )
        self.assertEqual(response.status_code, 200)
        notification_id = response.json()["notifications"][0]

        response = self.client.get(
            "/notifications",
            HTTP_AUTHORIZATION=bearer(self.recipient),
        )
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["total"], 1)
        self.assertEqual(response.json()["notifications"][0]["title"], "通知")
        self.assertEqual(
            response.json()["notifications"][0]["verb"],
            Notification.Verb.SYSTEM,
        )

        response = self.client.get(
            f"/notifications/{notification_id}",
            HTTP_AUTHORIZATION=bearer(self.recipient),
        )
        self.assertEqual(response.status_code, 200)
        self.assertFalse(response.json()["unread"])

    def post_mail(self, recipients):
        return self.client.post(
            "/notifications",
            data={"recipients": recipients, "title": "咨询", "content": "请帮助"},
            content_type="application/json",
            HTTP_AUTHORIZATION=bearer(self.sender),
        )

    def test_direct_mail_rejects_ineligible_and_malformed_targets_atomically(self):
        admin = User.objects.create_user(username="admin", is_superuser=True)
        inactive = User.objects.create_user(username="inactive", is_active=False)
        UserInfo.objects.create(user=admin, nickname="管理员")
        UserInfo.objects.create(user=inactive, nickname="停用用户")
        for recipients in (
            [self.sender.id],
            [admin.id],
            [inactive.id],
            [2147483647],
            [self.recipient.id, inactive.id],
            [],
            ["-1", self.recipient.id],
            [True],
            [1.5],
            ["bad"],
            ["9" * 100],
            ["--1"],
            None,
            "1",
        ):
            with self.subTest(recipients=recipients):
                self.assertEqual(self.post_mail(recipients).status_code, 400)
                self.assertFalse(Notification.objects.exists())

    def test_delivery_rechecks_recipient_after_search(self):
        for field in ("is_active", "is_superuser"):
            with self.subTest(field=field):
                self.recipient.is_active = True
                self.recipient.is_superuser = False
                self.recipient.save()
                response = self.client.get(
                    f"/users?search={self.recipient.id}",
                    HTTP_AUTHORIZATION=bearer(self.sender),
                )
                self.assertEqual(response.json()["users"][0]["id"], self.recipient.id)
                setattr(self.recipient, field, field == "is_superuser")
                self.recipient.save()
                self.assertEqual(
                    self.post_mail([str(self.recipient.id)]).status_code, 400
                )
                self.assertFalse(Notification.objects.exists())

    def test_administrator_mail_delivers_string_and_integer_sentinel_with_real_actor(
        self,
    ):
        admins = [
            User.objects.create_user(username=f"admin-{i}", is_superuser=True)
            for i in range(2)
        ]
        User.objects.create_user(
            username="inactive-admin", is_superuser=True, is_active=False
        )
        for sentinel in ("-1", -1):
            with self.subTest(sentinel=sentinel):
                response = self.post_mail([sentinel])
                self.assertEqual(response.status_code, 200)
                delivered = Notification.objects.filter(
                    id__in=response.json()["notifications"]
                )
                self.assertEqual(
                    set(delivered.values_list("recipient_id", flat=True)),
                    {admin.id for admin in admins},
                )
                self.assertEqual(
                    set(delivered.values_list("actor_id", flat=True)), {self.sender.id}
                )
        response = self.client.post(
            "/notifications",
            data={"recipients": [str(self.sender.id)], "content": "回复"},
            content_type="application/json",
            HTTP_AUTHORIZATION=bearer(admins[0]),
        )
        self.assertEqual(response.status_code, 200)
        reply = Notification.objects.get(id=response.json()["notifications"][0])
        self.assertEqual(reply.recipient_id, self.sender.id)
        self.assertEqual(reply.actor_id, admins[0].id)

    def test_administrator_service_preserves_sender(self):
        admin = User.objects.create_user(username="admin", is_superuser=True)
        ids = send_notification(self.sender, None, "咨询")
        notification = Notification.objects.get(id=ids[0])
        self.assertEqual(notification.actor_id, self.sender.id)
        self.assertEqual(notification.recipient_id, admin.id)

    def test_administrator_mail_without_active_administrators_fails(self):
        User.objects.create_user(
            username="inactive-admin", is_superuser=True, is_active=False
        )
        self.assertEqual(self.post_mail(["-1"]).status_code, 400)
        self.assertFalse(Notification.objects.exists())

    def test_direct_mail_accepts_frontend_string_ids_without_duplicate_delivery(self):
        response = self.post_mail([str(self.recipient.id), self.recipient.id])
        self.assertEqual(response.status_code, 200)
        self.assertEqual(len(response.json()["notifications"]), 1)

    def test_event_notification_exposes_stable_verb_and_target(self):
        notification = send_event_notification(
            actor=self.sender,
            recipient=self.recipient,
            verb=Notification.Verb.USAGE_ATTESTATION,
            description="为你的词条补充了地区使用证据",
            metadata={
                "target_type": "entry",
                "target_id": 42,
                "target_url": "/pages/entries/details?id=42",
            },
        )

        response = self.client.get(
            "/notifications",
            HTTP_AUTHORIZATION=bearer(self.recipient),
        )

        self.assertEqual(response.status_code, 200)
        item = response.json()["notifications"][0]
        self.assertEqual(item["id"], notification.id)
        self.assertEqual(item["verb"], Notification.Verb.USAGE_ATTESTATION)
        self.assertEqual(
            item["target"],
            {"type": "entry", "id": 42, "url": "/pages/entries/details?id=42"},
        )

    def test_list_filters_by_verb(self):
        send_event_notification(
            actor=self.sender,
            recipient=self.recipient,
            verb=Notification.Verb.RECORDING_LIKE,
            description="赞了你的录音",
        )
        send_event_notification(
            actor=self.sender,
            recipient=self.recipient,
            verb=Notification.Verb.ENTRY_BOOKMARK,
            description="收藏了你的词条",
        )

        response = self.client.get(
            "/notifications",
            {"verb": "recording.like"},
            HTTP_AUTHORIZATION=bearer(self.recipient),
        )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["total"], 1)
        self.assertEqual(
            response.json()["notifications"][0]["verb"],
            Notification.Verb.RECORDING_LIKE,
        )

    def test_event_notification_suppresses_self_notifications(self):
        result = send_event_notification(
            actor=self.sender,
            recipient=self.sender,
            verb=Notification.Verb.ENTRY_BOOKMARK,
        )

        self.assertIsNone(result)
        self.assertFalse(Notification.objects.exists())
