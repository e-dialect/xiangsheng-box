from datetime import timedelta
from unittest.mock import patch

from django.db import connection
from django.db.migrations.executor import MigrationExecutor
from django.test import TestCase, TransactionTestCase
from .models import Collection, CollectionEntry, CollectionRecording
from .tests_restoration import RestorationTests


class CollectionTimestampTests(TestCase):
    setUp = RestorationTests.setUp

    def test_timestamps_are_read_only_and_membership_retries_preserve_time(self):
        original = Collection.objects.get(pk=self.box).updated_at
        later = original + timedelta(days=1)
        with patch("django.utils.timezone.now", return_value=later):
            response = self.client.post(
                self.url + "recordings/",
                {
                    "recording_id": self.recording.pk,
                    "entry_id": self.entry.pk,
                    "created_at": "2000-01-01T00:00:00Z",
                },
            )
        self.assertEqual(response.status_code, 200)
        section = CollectionEntry.objects.get(collection_id=self.box)
        item = CollectionRecording.objects.get(collection_id=self.box)
        self.assertEqual(section.created_at, later)
        self.assertEqual(item.created_at, later)
        self.assertEqual(Collection.objects.get(pk=self.box).updated_at, later)
        with patch("django.utils.timezone.now", return_value=later + timedelta(days=1)):
            self.client.post(
                self.url + "recordings/",
                {
                    "recording_id": self.recording.pk,
                    "entry_id": self.entry.pk,
                },
            )
            self.client.post(self.url + "entries/", {"entry_id": self.entry.pk})
            self.client.post(self.url + "order/", {"ids": [section.pk]}, format="json")
        self.assertEqual(Collection.objects.get(pk=self.box).updated_at, later)
        item.refresh_from_db()
        self.assertEqual(item.created_at, later)
        data = self.client.get(self.url).data
        self.assertIsNotNone(data["updated_at"])
        self.assertIsNotNone(data["sections"][0]["created_at"])
        self.assertIsNotNone(data["sections"][0]["recordings"][0]["created_at"])
        self.client.patch(
            self.url,
            {"title": "改盒签", "updated_at": "2000-01-01T00:00:00Z"},
            format="json",
        )
        self.assertNotEqual(Collection.objects.get(pk=self.box).updated_at.year, 2000)

    def test_reorder_remove_and_failed_writes(self):
        first = self.client.post(
            self.url + "entries/", {"entry_id": self.entry.pk}
        ).data["id"]
        second = self.client.post(
            self.url + "entries/", {"entry_id": self.second.pk}
        ).data["id"]
        before = Collection.objects.get(pk=self.box).updated_at
        later = before + timedelta(days=1)
        with patch("django.utils.timezone.now", return_value=later):
            self.assertEqual(
                self.client.post(
                    self.url + "order/", {"ids": [second, first]}, format="json"
                ).status_code,
                200,
            )
        self.assertEqual(Collection.objects.get(pk=self.box).updated_at, later)
        self.assertEqual(
            self.client.post(
                self.url + "order/", {"ids": []}, format="json"
            ).status_code,
            400,
        )
        self.client.force_authenticate(self.other)
        self.assertIn(
            self.client.delete(self.url + f"entries/{first}/").status_code, (403, 404)
        )
        self.assertEqual(Collection.objects.get(pk=self.box).updated_at, later)
        self.client.force_authenticate(self.user)
        with patch("django.utils.timezone.now", return_value=later + timedelta(days=1)):
            self.assertEqual(
                self.client.delete(self.url + f"entries/{first}/").status_code, 204
            )
        self.assertEqual(
            Collection.objects.get(pk=self.box).updated_at, later + timedelta(days=1)
        )

    def test_pending_organization_and_removal_touch_collection(self):
        self.link.delete()
        response = self.client.post(
            self.url + "recordings/", {"recording_id": self.recording.pk}
        )
        pending = CollectionRecording.objects.get(pk=response.data["id"])
        before = Collection.objects.get(pk=self.box).updated_at
        from .models import RecordingEntryLink

        RecordingEntryLink.objects.create(
            recording=self.recording, entry=self.entry, role="primary"
        )
        later = before + timedelta(days=1)
        with patch("django.utils.timezone.now", return_value=later):
            response = self.client.post(
                self.url + "recordings/",
                {"recording_id": self.recording.pk, "entry_id": self.entry.pk},
            )
        self.assertFalse(CollectionRecording.objects.filter(pk=pending.pk).exists())
        self.assertEqual(Collection.objects.get(pk=self.box).updated_at, later)
        with patch("django.utils.timezone.now", return_value=later + timedelta(days=1)):
            self.assertEqual(
                self.client.delete(
                    self.url + f"recordings/{response.data['id']}/"
                ).status_code,
                204,
            )
        self.assertEqual(
            Collection.objects.get(pk=self.box).updated_at, later + timedelta(days=1)
        )

    def test_sort_order_gaps_do_not_refresh_timestamps(self):
        self.client.post(
            self.url + "recordings/",
            {"recording_id": self.recording.pk, "entry_id": self.entry.pk},
        )
        section = CollectionEntry.objects.get(collection_id=self.box)
        item = CollectionRecording.objects.get(collection_id=self.box)
        CollectionEntry.objects.filter(pk=section.pk).update(sort_order=7)
        CollectionRecording.objects.filter(pk=item.pk).update(sort_order=9)
        before = Collection.objects.get(pk=self.box).updated_at
        with patch("django.utils.timezone.now", return_value=before + timedelta(days=1)):
            for payload in (
                {"ids": [section.pk]},
                {"ids": [item.pk], "section_id": section.pk},
            ):
                response = self.client.post(self.url + "order/", payload, format="json")
                self.assertEqual(response.status_code, 200, response.data)
                self.assertEqual(Collection.objects.get(pk=self.box).updated_at, before)

    def test_unknown_historical_timestamps_remain_null_in_api(self):
        self.link.delete()
        self.client.post(self.url + "recordings/", {"recording_id": self.recording.pk})
        Collection.objects.filter(pk=self.box).update(updated_at=None)
        CollectionRecording.objects.filter(collection_id=self.box).update(
            created_at=None
        )
        data = self.client.get(self.url).data
        self.assertIsNone(data["updated_at"])
        self.assertIsNone(data["pending"][0]["created_at"])


class CollectionTimestampMigrationTests(TransactionTestCase):
    def test_existing_rows_are_unknown_and_new_rows_receive_timestamps(self):
        old = [("guantou", "0027_curationaction_authority_snapshot")]
        new = [("guantou", "0028_collection_timestamps")]
        executor = MigrationExecutor(connection)
        executor.migrate(old)
        try:
            apps = executor.loader.project_state(old).apps
            user = apps.get_model("auth", "User").objects.create(
                username="migration-collector"
            )
            entry = apps.get_model("guantou", "Entry").objects.create(summary="测试")
            box = apps.get_model("guantou", "Collection").objects.create(
                owner_id=user.pk, title="历史集盒"
            )
            section = apps.get_model("guantou", "CollectionEntry").objects.create(
                collection_id=box.pk, entry_id=entry.pk
            )
            executor = MigrationExecutor(connection)
            executor.migrate(new)
            self.assertIsNone(Collection.objects.get(pk=box.pk).updated_at)
            self.assertIsNone(CollectionEntry.objects.get(pk=section.pk).created_at)
            fresh = Collection.objects.create(owner_id=user.pk, title="新集盒")
            self.assertIsNotNone(fresh.updated_at)
            self.assertIsNotNone(
                CollectionEntry.objects.create(
                    collection=fresh, entry_id=entry.pk
                ).created_at
            )
        finally:
            executor = MigrationExecutor(connection)
            executor.migrate(executor.loader.graph.leaf_nodes())
