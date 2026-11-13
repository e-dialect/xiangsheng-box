from django.contrib.auth.models import User
from django.test import TestCase
from rest_framework.test import APIClient

from .models import (
    Dialect,
    Entry,
    PronunciationVariant,
    Recording,
    RecordingEntryLink,
    UsageAttestation,
)


class EntryRegionLinkTests(TestCase):
    def setUp(self):
        self.owner = User.objects.create_user(username="region-owner")
        self.stranger = User.objects.create_user(username="region-stranger")
        self.root = Dialect.objects.create(name="测试闽语", code="test-min")
        self.local = Dialect.objects.create(
            name="测试城里", code="city", parent=self.root
        )
        self.other = Dialect.objects.create(name="测试粤语", code="test-yue")
        self.client = APIClient()

    def entry(self, dialect=None):
        return Entry.objects.create(
            summary="行", usage_dialect=dialect or self.other, created_by=self.owner
        )

    def link(self, entry, *, current=True, status="accepted", public=True):
        recording = Recording.objects.create(
            audio_url="https://example.test/region.mp3",
            usage_dialect=self.local,
            recorder=self.owner,
            original_gloss="行",
            visibility=public,
        )
        return RecordingEntryLink.objects.create(
            recording=recording,
            entry=entry,
            created_by=self.owner,
            is_current=current,
            status=status,
        )

    def results(self, dialect=None, scope="exact"):
        response = self.client.get(
            "/entries/",
            {"dialect_id": (dialect or self.local).id, "dialect_scope": scope},
        )
        self.assertEqual(response.status_code, 200)
        return [entry["id"] for entry in response.data["results"]]

    def test_historical_and_rejected_links_do_not_cross_language_boundary(self):
        historical = self.entry()
        rejected = self.entry()
        self.link(historical, current=False)
        self.link(rejected, status="rejected")
        for dialect, scope in ((self.local, "exact"), (self.root, "subtree")):
            with self.subTest(scope=scope):
                self.assertEqual(self.results(dialect, scope), [])

    def test_current_allowed_statuses_and_scope_are_preserved_without_duplicates(self):
        entries = []
        for status in ("suggested", "accepted", "disputed"):
            entry = self.entry()
            entries.append(entry.id)
            self.link(entry, status=status)
            self.link(entry, status=status)
        self.assertCountEqual(self.results(), entries)
        self.assertCountEqual(self.results(self.root, "subtree"), entries)
        self.assertEqual(self.results(self.root, "exact"), [])

    def test_private_recording_visibility_matches_existing_link_visibility(self):
        entry = self.entry()
        self.link(entry, public=False)
        self.assertEqual(self.results(), [])
        self.client.force_authenticate(self.stranger)
        self.assertEqual(self.results(), [])
        self.client.force_authenticate(self.owner)
        self.assertEqual(self.results(), [entry.id])

    def test_other_regional_discovery_paths_survive_invalid_recording_links(self):
        direct = self.entry(self.local)
        pronunciation = self.entry()
        attested = self.entry()
        inactive_attested = self.entry()
        PronunciationVariant.objects.create(
            entry=pronunciation, dialect=self.local, ipa="hiŋ", created_by=self.owner
        )
        UsageAttestation.objects.create(
            entry=attested, dialect=self.local, attester=self.owner
        )
        UsageAttestation.objects.create(
            entry=inactive_attested,
            dialect=self.local,
            attester=self.owner,
            active=False,
        )
        for entry in (direct, pronunciation, attested, inactive_attested):
            self.link(entry, current=False)
        self.assertCountEqual(
            self.results(), [direct.id, pronunciation.id, attested.id]
        )
        self.assertCountEqual(
            self.results(self.root, "subtree"),
            [direct.id, pronunciation.id, attested.id],
        )
        self.assertEqual(self.results(self.root, "exact"), [])

    def test_unfiltered_search_keeps_entries_with_only_historical_links(self):
        entry = self.entry()
        self.link(entry, current=False)
        response = self.client.get("/entries/", {"search": "行"})
        self.assertEqual(response.status_code, 200)
        self.assertIn(entry.id, [item["id"] for item in response.data["results"]])
