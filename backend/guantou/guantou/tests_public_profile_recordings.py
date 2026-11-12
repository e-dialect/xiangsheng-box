from django.contrib.auth.models import User
from django.test import TestCase
from rest_framework.test import APIClient

from .models import Dialect, Recording


class PublicProfileRecordingTests(TestCase):
    @classmethod
    def setUpTestData(cls):
        cls.author = User.objects.create_user(username="profile-author")
        cls.other = User.objects.create_user(username="profile-other")
        cls.staff = User.objects.create_user(username="profile-staff", is_staff=True)
        dialect = Dialect.objects.create(name="示例方言", code="profile-test")
        cls.older = Recording.objects.create(
            audio_url="https://example.test/older.mp3",
            usage_dialect=dialect,
            recorder=cls.author,
            original_gloss="较早的问候",
            visibility=True,
        )
        cls.newer = Recording.objects.create(
            audio_url="https://example.test/newer.mp3",
            usage_dialect=dialect,
            recorder=cls.author,
            original_gloss="最近的问候",
            visibility=True,
        )
        Recording.objects.create(
            audio_url="https://example.test/private.mp3",
            usage_dialect=dialect,
            recorder=cls.author,
            original_gloss="私人录音",
            visibility=False,
        )
        Recording.objects.create(
            audio_url="https://example.test/other.mp3",
            usage_dialect=dialect,
            recorder=cls.other,
            original_gloss="其他贡献者的录音",
            visibility=True,
        )

    def test_profile_filter_returns_public_recordings_to_every_viewer(self):
        for viewer in (None, self.author, self.other, self.staff):
            with self.subTest(viewer=viewer):
                client = APIClient()
                client.force_authenticate(viewer)
                query = {"recorder_id": self.author.id, "page_size": 1}
                first = client.get("/recordings/", query)
                second = client.get("/recordings/", {**query, "page": 2})

                self.assertEqual(first.status_code, 200)
                self.assertEqual(first.data["count"], 2)
                self.assertTrue(first.data["next"])
                self.assertEqual(first.data["results"][0]["id"], self.newer.id)
                self.assertEqual(second.status_code, 200)
                self.assertEqual(second.data["results"][0]["id"], self.older.id)

    def test_invalid_recorder_filter_does_not_fall_back_to_the_full_feed(self):
        for value in ("", "invalid", "0", "-1", "9223372036854775808"):
            with self.subTest(value=value):
                response = self.client.get("/recordings/", {"recorder_id": value})
                self.assertEqual(response.status_code, 400)
