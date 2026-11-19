from datetime import date
from unittest.mock import patch

from django.contrib.auth.models import User
from django.test import TestCase
from rest_framework.test import APIClient

from .models import Dialect, Entry, Recording, RecordingMedia


class DailyEntryTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.region = Dialect.objects.create(name="莆仙", code="puxian")
        self.local = Dialect.objects.create(
            name="城里", code="city", parent=self.region
        )
        self.other = Dialect.objects.create(name="其他地区", code="other")

    def test_choices_are_stable_through_refresh_and_change_the_next_day(self):
        first = Entry.objects.create(usage_dialect=self.local, summary="第一词")
        second = Entry.objects.create(usage_dialect=self.local, summary="第二词")
        Entry.objects.create(usage_dialect=self.other, summary="其他地区的词")
        params = {"dialect_id": self.region.pk, "dialect_scope": "subtree"}

        with patch(
            "guantou.v2_views.timezone.localdate", return_value=date(2026, 11, 19)
        ):
            selected = self.client.get("/entries/daily/", params)
            self.assertEqual(selected.status_code, 200)
            self.assertIn(selected.data["id"], {first.pk, second.pk})
            self.assertEqual(
                self.client.get("/entries/daily/", params).data, selected.data
            )
            self.assertEqual(
                self.client.get(f'/entries/{selected.data["id"]}/').status_code, 200
            )

        with patch(
            "guantou.v2_views.timezone.localdate", return_value=date(2026, 11, 20)
        ):
            tomorrow = self.client.get("/entries/daily/", params)
            self.assertNotEqual(tomorrow.data["id"], selected.data["id"])

    def test_exact_scope_does_not_fall_back_to_other_regions_or_nonpublic_entries(self):
        outside = Entry.objects.create(usage_dialect=self.other, summary="外地词")
        Entry.objects.create(usage_dialect=self.local, summary="子地区词")
        Entry.objects.create(usage_dialect=self.region)
        Entry.objects.create(
            usage_dialect=self.region, summary="私有词", visibility=False
        )
        Entry.objects.create(
            usage_dialect=self.region,
            summary="已合并词",
            status=Entry.Status.REDIRECTED,
            canonical_entry=outside,
        )
        generated = Entry.objects.create(
            usage_dialect=self.region, summary="未公开录音生成的词"
        )
        media = RecordingMedia.objects.create(
            generated_entry=generated, content=b"fake", duration_ms=100
        )
        Recording.objects.create(
            usage_dialect=self.region,
            media=media,
            publication_consent="public-display-v1",
            visibility=False,
        )
        staff = User.objects.create_user("daily_admin", is_staff=True)
        params = {"dialect_id": self.region.pk}

        self.assertEqual(self.client.get("/entries/daily/", params).status_code, 204)
        self.client.force_authenticate(staff)
        self.assertEqual(self.client.get("/entries/daily/", params).status_code, 204)

    def test_invalid_dialect_returns_a_bad_request(self):
        for dialect in ("non-numeric", "0", "999999999999999999999999999", "999999"):
            with self.subTest(dialect=dialect):
                response = self.client.get("/entries/daily/", {"dialect_id": dialect})
                self.assertEqual(response.status_code, 400)
