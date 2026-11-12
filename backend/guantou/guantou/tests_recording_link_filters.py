from django.contrib.auth.models import User
from django.test import TestCase
from rest_framework.test import APIClient

from .models import Dialect, Entry, Recording, RecordingEntryLink


class RecordingLinkFilterTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.owner = User.objects.create_user(username="recording-filter-owner")
        self.dialect = Dialect.objects.create(name="筛选地区", code="filter-test")
        self.entry = Entry.objects.create(summary="甲", visibility=True)
        self.other_entry = Entry.objects.create(summary="乙", visibility=True)

    def recording(self, **kwargs):
        return Recording.objects.create(
            audio_url="https://example.test/audio.mp3",
            usage_dialect=self.dialect,
            recorder=self.owner,
            **{"visibility": True, **kwargs},
        )

    def link(self, recording, **kwargs):
        return RecordingEntryLink.objects.create(
            recording=recording,
            **{
                "entry": self.entry,
                "role": RecordingEntryLink.Role.MENTION,
                "status": RecordingEntryLink.Status.ACCEPTED,
                **kwargs,
            },
        )

    def assert_recordings(self, params, expected):
        response = self.client.get("/recordings/", params)
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["count"], len(expected))
        self.assertEqual(
            {item["id"] for item in response.data["results"]},
            {recording.id for recording in expected},
        )

    def test_entry_and_role_must_match_the_same_link(self):
        crossed = self.recording()
        self.link(crossed, role=RecordingEntryLink.Role.PRIMARY)
        self.link(crossed, entry=self.other_entry)
        matching = self.recording()
        self.link(matching)

        self.assert_recordings(
            {"entry_id": self.entry.id, "role": "mention"}, [matching]
        )
        self.assert_recordings({"entry_id": self.entry.id}, [crossed, matching])
        self.assert_recordings({"role": "mention"}, [crossed, matching])

    def test_rejected_link_does_not_match_any_link_filter(self):
        rejected = self.recording()
        self.link(rejected, status=RecordingEntryLink.Status.REJECTED)
        # A valid link elsewhere must not make the rejected link eligible.
        self.link(
            rejected, entry=self.other_entry, role=RecordingEntryLink.Role.PRIMARY
        )
        matching = self.recording()
        self.link(matching)

        for params in (
            {"entry_id": self.entry.id},
            {"role": "mention"},
            {"entry_id": self.entry.id, "role": "mention"},
        ):
            with self.subTest(params=params):
                self.assert_recordings(params, [matching])

    def test_historical_link_does_not_match_any_link_filter(self):
        historical = self.recording()
        self.link(historical, is_current=False)
        self.link(
            historical, entry=self.other_entry, role=RecordingEntryLink.Role.PRIMARY
        )
        for params in (
            {"entry_id": self.entry.id},
            {"role": "mention"},
            {"entry_id": self.entry.id, "role": "mention"},
        ):
            with self.subTest(params=params):
                self.assert_recordings(params, [])

    def test_non_rejected_statuses_remain_eligible_without_duplicates(self):
        expected = []
        for status in (
            RecordingEntryLink.Status.ACCEPTED,
            RecordingEntryLink.Status.SUGGESTED,
            RecordingEntryLink.Status.DISPUTED,
        ):
            recording = self.recording()
            self.link(recording, status=status)
            self.link(recording, entry=self.other_entry, status=status)
            expected.append(recording)
        self.assert_recordings({"role": "mention"}, expected)
        self.assert_recordings({"entry_id": self.entry.id, "role": "mention"}, expected)

    def test_unfiltered_results_and_recording_visibility_are_preserved(self):
        unlinked = self.recording()
        rejected_only = self.recording()
        self.link(rejected_only, status=RecordingEntryLink.Status.REJECTED)
        private = self.recording(visibility=False)
        self.link(private)
        self.assert_recordings({}, [unlinked, rejected_only])
        self.assert_recordings({"entry_id": self.entry.id}, [])
        self.client.force_authenticate(self.owner)
        self.assert_recordings({"entry_id": self.entry.id}, [private])
