from concurrent.futures import ThreadPoolExecutor
from threading import Event
from unittest.mock import patch

from django.db import DatabaseError, close_old_connections, transaction
from django.test import TestCase, TransactionTestCase, skipUnlessDBFeature

from .models import (
    CurationAction,
    EntrySense,
    EntryWriting,
    Recording,
    RecordingEntryLink,
    WritingForm,
)
from . import tests_v2_provenance as provenance
from . import v2_governance


class DependentScopeTests(TestCase):
    setUp = provenance.CurationProvenanceTests.setUp
    issue = provenance.CurationProvenanceTests.issue
    client_for = provenance.CurationProvenanceTests.client_for
    narrow = provenance.CurationProvenanceTests.narrow

    def set_draft(self):
        self.entry.status = "draft"
        self.entry.save()

    def assert_blocked(self, path, target):
        count = CurationAction.objects.count()
        for user in (self.owner, self.staff):
            for method in ("patch", "put"):
                with self.subTest(user=user.username, method=method):
                    response = getattr(self.client_for(user), method)(
                        path, {"usage_dialect_id": self.local.id}, format="json"
                    )
                    if isinstance(target, Recording) and method == "put":
                        self.assertEqual(response.status_code, 405, response.data)
                        continue
                    self.assertEqual(response.status_code, 400, response.data)
                    self.assertIn("usage_dialect_id", response.data["data"])
        target.refresh_from_db()
        self.assertEqual(target.usage_dialect_id, self.root.id)
        self.assertEqual(CurationAction.objects.count(), count)

    def review(self, kind, target, status):
        response = self.client_for(self.staff).post(
            "/curation/actions/",
            {
                "action_type": "review",
                "target_type": kind,
                "target_id": target.id,
                "reason": "Review dependent content",
                "changes": {"status": status},
            },
            format="json",
        )
        self.assertEqual(response.status_code, 201, response.data)
        return response.data

    def test_reviewed_sense_protects_draft_parent_and_governance_still_works(self):
        self.set_draft()
        sense = EntrySense.objects.create(entry=self.entry, gloss="sense")
        self.review("sense", sense, "reviewed")
        self.assert_blocked(f"/entries/{self.entry.id}/", self.entry)
        result = self.narrow()
        self.assertEqual(result.status_code, 201, result.data)
        self.assertEqual(
            result.data["before_snapshot"]["usage_dialect"]["id"], self.root.id
        )
        self.assertEqual(
            result.data["after_snapshot"]["usage_dialect"]["id"], self.local.id
        )

    def test_sense_history_protects_even_after_status_reset(self):
        self.set_draft()
        sense = EntrySense.objects.create(entry=self.entry, gloss="sense")
        self.review("sense", sense, "reviewed")
        EntrySense.objects.filter(pk=sense.pk).update(status="draft")
        self.assert_blocked(f"/entries/{self.entry.id}/", self.entry)

    def test_historical_writing_decision_protects_draft_parent(self):
        self.set_draft()
        writing = EntryWriting.objects.create(
            entry=self.entry, writing=WritingForm.objects.create(text="test")
        )
        self.review("writing", writing, "reviewed")
        EntryWriting.objects.filter(pk=writing.pk).update(
            status="draft", is_current=False
        )
        self.assert_blocked(f"/entries/{self.entry.id}/", self.entry)

    def test_legacy_reviewed_children_without_action_also_protect(self):
        self.set_draft()
        for kind in ("sense", "writing"):
            with self.subTest(kind=kind):
                if kind == "sense":
                    child = EntrySense.objects.create(
                        entry=self.entry, gloss="old", status="reviewed"
                    )
                else:
                    child = EntryWriting.objects.create(
                        entry=self.entry,
                        writing=WritingForm.objects.create(text="old"),
                        status="reviewed",
                        is_current=False,
                    )
                self.assert_blocked(f"/entries/{self.entry.id}/", self.entry)
                child.delete()

    def make_recording(self):
        return Recording.objects.create(
            original_gloss="clip",
            audio_url="https://example.test/a.wav",
            recorder=self.owner,
            usage_dialect=self.root,
            status="draft",
        )

    def test_versioned_link_review_protects_recording(self):
        recording = self.make_recording()
        link = RecordingEntryLink.objects.create(recording=recording, entry=self.entry)
        action = self.review("recording_link", link, "accepted")
        link.refresh_from_db()
        self.assertFalse(link.is_current)
        # Both versions can look unreviewed now; the old target's history remains binding.
        RecordingEntryLink.objects.filter(recording=recording).update(
            status="suggested", reviewed_at=None, reviewed_by=None
        )
        self.assertEqual(action["target_id"], link.id)
        self.assert_blocked(f"/recordings/{recording.id}/", recording)
        result = self.narrow(target=recording, target_type="recording")
        self.assertEqual(result.status_code, 201, result.data)

    def test_legacy_link_status_protects_recording(self):
        recording = self.make_recording()
        RecordingEntryLink.objects.create(
            recording=recording, entry=self.entry, status="accepted", is_current=False
        )
        self.assert_blocked(f"/recordings/{recording.id}/", recording)

    def test_unrelated_decisions_and_uncurated_children_do_not_block(self):
        self.set_draft()
        EntrySense.objects.create(entry=self.entry, gloss="draft")
        EntryWriting.objects.create(
            entry=self.entry, writing=WritingForm.objects.create(text="draft")
        )
        CurationAction.objects.create(
            actor=self.staff,
            action_type="review",
            target_type="sense",
            target_id=999999,
            reason="Unrelated decision",
        )
        response = self.client_for(self.owner).patch(
            f"/entries/{self.entry.id}/",
            {"usage_dialect_id": self.local.id},
            format="json",
        )
        self.assertEqual(response.status_code, 200, response.data)
        recording = self.make_recording()
        RecordingEntryLink.objects.create(recording=recording, entry=self.entry)
        response = self.client_for(self.owner).patch(
            f"/recordings/{recording.id}/",
            {"usage_dialect_id": self.local.id},
            format="json",
        )
        self.assertEqual(response.status_code, 200, response.data)

    def test_same_scope_and_unrelated_edit_remain_allowed_with_reviewed_child(self):
        self.set_draft()
        EntrySense.objects.create(entry=self.entry, gloss="reviewed", status="reviewed")
        response = self.client_for(self.owner).patch(
            f"/entries/{self.entry.id}/",
            {"usage_dialect_id": self.root.id, "summary": "Updated summary"},
            format="json",
        )
        self.assertEqual(response.status_code, 200, response.data)

    def test_initial_authored_link_allows_draft_edit_until_actual_review(self):
        response = self.client_for(self.owner).post(
            "/recordings/",
            {
                "original_gloss": "clip",
                "usage_dialect_id": self.root.id,
                "audio_url": "https://example.test/a.wav",
            },
            format="json",
        )
        self.assertEqual(response.status_code, 201, response.data)
        recording = Recording.objects.get(pk=response.data["id"])
        link = recording.entry_links.get()
        self.assertEqual(link.review_reason, "录制者初始著录")
        response = self.client_for(self.owner).patch(
            f"/recordings/{recording.id}/",
            {"usage_dialect_id": self.local.id},
            format="json",
        )
        self.assertEqual(response.status_code, 200, response.data)
        self.review("recording_link", link, "accepted")
        response = self.client_for(self.owner).patch(
            f"/recordings/{recording.id}/",
            {"usage_dialect_id": self.root.id},
            format="json",
        )
        self.assertEqual(response.status_code, 400, response.data)

    def test_owner_supplemental_authored_link_is_not_review(self):
        recording = self.make_recording()
        response = self.client_for(self.owner).post(
            "/recording-entry-links/",
            {
                "recording_id": recording.id,
                "entry_id": self.entry.id,
                "role": "primary",
            },
            format="json",
        )
        self.assertEqual(response.status_code, 201, response.data)
        response = self.client_for(self.owner).patch(
            f"/recordings/{recording.id}/",
            {"usage_dialect_id": self.local.id},
            format="json",
        )
        self.assertEqual(response.status_code, 200, response.data)


@skipUnlessDBFeature("has_select_for_update_nowait")
class ScopeOwnerLockTests(TransactionTestCase):
    setUp = provenance.CurationProvenanceTests.setUp
    issue = provenance.CurationProvenanceTests.issue

    def test_child_review_locks_parent_before_decision(self):
        sense = EntrySense.objects.create(entry=self.entry, gloss="sense")
        writing = EntryWriting.objects.create(
            entry=self.entry, writing=WritingForm.objects.create(text="lock test")
        )
        recording = Recording.objects.create(
            original_gloss="clip",
            audio_url="https://example.test/a.wav",
            recorder=self.owner,
            usage_dialect=self.root,
            status="draft",
        )
        link = RecordingEntryLink.objects.create(recording=recording, entry=self.entry)
        original_choice = v2_governance._choice
        for kind, child, parent, status in (
            ("sense", sense, self.entry, "reviewed"),
            ("writing", writing, self.entry, "reviewed"),
            ("recording_link", link, recording, "accepted"),
        ):
            with self.subTest(kind=kind):
                reached = Event()
                release = Event()

                def pause_choice(*args, **kwargs):
                    reached.set()
                    if not release.wait(10):
                        raise AssertionError(
                            "Timed out waiting for competing parent lock"
                        )
                    return original_choice(*args, **kwargs)

                def review_in_connection():
                    close_old_connections()
                    try:
                        return v2_governance.perform_curation_action(
                            self.staff,
                            {
                                "action_type": "review",
                                "target_type": kind,
                                "target_id": child.id,
                                "reason": "Concurrent decision",
                                "changes": {"status": status},
                            },
                        ).id
                    finally:
                        close_old_connections()

                with patch.object(v2_governance, "_choice", side_effect=pause_choice):
                    with ThreadPoolExecutor(max_workers=1) as executor:
                        future = executor.submit(review_in_connection)
                        try:
                            self.assertTrue(reached.wait(10))
                            # A second connection cannot acquire the same parent row:
                            # ordinary scope updates lock this row before checking history.
                            with self.assertRaises(DatabaseError):
                                with transaction.atomic():
                                    type(parent).objects.select_for_update(
                                        nowait=True
                                    ).get(pk=parent.pk)
                        finally:
                            release.set()
                        self.assertIsInstance(future.result(timeout=10), int)
