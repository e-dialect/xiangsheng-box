from datetime import timedelta

from django.contrib.auth.models import User
from django.test import TestCase
from django.utils import timezone
from rest_framework.test import APIClient

from .models import (
    Concept,
    CuratorGrant,
    Dialect,
    DialectCircle,
    Entry,
    EntrySense,
    EntrySenseConcept,
    EntryWriting,
    EvidenceLink,
    EvidenceRecord,
    LegacyReviewCandidate,
    PronunciationVariant,
    Recording,
    RecordingEntryLink,
    UsageAttestation,
    WritingForm,
)


class EntryFirstApiTests(TestCase):
    def setUp(self):
        DialectCircle.objects.all().delete()
        Dialect.objects.all().delete()
        self.owner = User.objects.create_user(username="owner", password="pw")
        self.other = User.objects.create_user(username="other", password="pw")
        self.root = Dialect.objects.create(name="闽语", code="闽")
        self.group = Dialect.objects.create(
            name="莆仙方言", code="莆仙", parent=self.root
        )
        self.city = Dialect.objects.create(name="城里", code="城里", parent=self.group)
        self.client = APIClient()
        self.client.force_authenticate(self.owner)

    def make_entry(self, summary, writing, *, dialect=None, owner=None):
        entry = Entry.objects.create(
            summary=summary,
            identity_note=summary,
            usage_dialect=dialect or self.group,
            created_by=owner or self.owner,
        )
        sense = EntrySense.objects.create(
            entry=entry,
            gloss=summary,
            created_by=owner or self.owner,
        )
        form = WritingForm.objects.create(
            text=writing,
            normalized_text=writing,
            form_type=WritingForm.FormType.ORTHOGRAPHIC,
        )
        EntryWriting.objects.create(
            entry=entry,
            writing=form,
            relation_type=EntryWriting.RelationType.PRIMARY,
            created_by=owner or self.owner,
        )
        return entry, sense

    def test_search_keeps_homographs_separate_and_supports_advanced_filters(self):
        walking, walking_sense = self.make_entry("行走的行", "行")
        banking, _ = self.make_entry("银行的行", "行")
        walk = Concept.objects.create(code="WALK", label="步行")
        EntrySenseConcept.objects.create(
            sense=walking_sense,
            concept=walk,
            created_by=self.owner,
        )
        PronunciationVariant.objects.create(
            entry=walking,
            dialect=self.city,
            ipa="hiŋ2",
            surface_romanization="hing2",
            created_by=self.owner,
        )
        recording = Recording.objects.create(
            audio_url="https://example.test/walk.mp3",
            usage_dialect=self.city,
            recorder=self.owner,
            original_gloss="行走",
            visibility=True,
        )
        RecordingEntryLink.objects.create(
            recording=recording,
            entry=walking,
            role=RecordingEntryLink.Role.PRIMARY,
            status=RecordingEntryLink.Status.ACCEPTED,
            created_by=self.owner,
        )
        evidence = EvidenceRecord.objects.create(
            source_type=EvidenceRecord.SourceType.BOOK,
            original_writing="行",
            citation="方言词典",
            contributor=self.owner,
        )
        EvidenceLink.objects.create(evidence=evidence, entry=banking)

        response = self.client.get("/entries/", {"search": "行"})

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["count"], 2)
        self.assertEqual(
            {item["summary"] for item in response.data["results"]},
            {"行走的行", "银行的行"},
        )
        self.assertEqual(
            {item["id"] for item in response.data["results"]},
            {walking.id, banking.id},
        )
        walk_result = next(
            item for item in response.data["results"] if item["id"] == walking.id
        )
        bank_result = next(
            item for item in response.data["results"] if item["id"] == banking.id
        )
        self.assertFalse(walk_result["needs_audio"])
        self.assertTrue(bank_result["needs_audio"])

        cases = (
            ({"concept": "WALK"}, {walking.id}),
            ({"ipa": "hiŋ"}, {walking.id}),
            ({"romanization": "hing"}, {walking.id}),
            ({"source_type": "book"}, {banking.id}),
            ({"source": "方言词典"}, {banking.id}),
            ({"has_recording": "false"}, {banking.id}),
            (
                {"dialect_id": self.city.id, "dialect_scope": "exact"},
                {walking.id},
            ),
            (
                {"dialect_id": self.group.id, "dialect_scope": "exact"},
                {walking.id, banking.id},
            ),
            (
                {"dialect_id": self.group.id, "dialect_scope": "subtree"},
                {walking.id, banking.id},
            ),
        )
        for params, expected in cases:
            with self.subTest(params=params):
                filtered = self.client.get("/entries/", params)
                self.assertEqual(filtered.status_code, 200)
                self.assertEqual(
                    {item["id"] for item in filtered.data["results"]}, expected
                )

    def test_concepts_find_related_entries_without_merging_them(self):
        walking, walking_sense = self.make_entry("步行", "行")
        running, running_sense = self.make_entry("奔跑", "走")
        walk = Concept.objects.create(code="WALK", label="步行")
        run = Concept.objects.create(code="RUN", label="奔跑")
        EntrySenseConcept.objects.create(sense=walking_sense, concept=walk)
        EntrySenseConcept.objects.create(sense=running_sense, concept=run)

        walk_response = self.client.get("/entries/", {"concept": "WALK"})
        run_response = self.client.get("/entries/", {"concept": "RUN"})

        self.assertEqual(walk_response.data["results"][0]["id"], walking.id)
        self.assertEqual(run_response.data["results"][0]["id"], running.id)
        self.assertNotEqual(walking.id, running.id)

    def test_progressive_entry_and_pronunciation_submission_keep_identity(self):
        first = self.client.post(
            "/entries/",
            {
                "summary": " 行走的行 ",
                "initial_writing": " 行 ",
                "usage_dialect_id": self.group.id,
            },
            format="json",
        )
        second = self.client.post(
            "/entries/",
            {
                "summary": "银行的行",
                "initial_writing": "行",
                "usage_dialect_id": self.group.id,
            },
            format="json",
        )

        self.assertEqual(first.status_code, 201, first.data)
        self.assertEqual(second.status_code, 201, second.data)
        self.assertNotEqual(first.data["id"], second.data["id"])
        self.assertEqual(first.data["summary"], "行走的行")
        self.assertEqual(first.data["evidence_count"], 1)
        self.assertTrue(first.data["needs_audio"])
        walk = Concept.objects.create(code="WALK", label="步行")
        sense = self.client.post(
            "/entry-senses/",
            {
                "entry_id": first.data["id"],
                "sense_number": 2,
                "gloss": "可以通往",
                "concept_ids": [walk.id],
            },
            format="json",
        )
        pronunciation = self.client.post(
            "/pronunciation-variants/",
            {
                "entry_id": first.data["id"],
                "dialect_id": self.city.id,
                "ipa": "hiŋ2",
                "surface_romanization": "hing2",
            },
            format="json",
        )

        self.assertEqual(sense.status_code, 201, sense.data)
        self.assertEqual(sense.data["concepts"][0]["code"], "WALK")
        self.assertEqual(pronunciation.status_code, 201, pronunciation.data)
        self.assertEqual(pronunciation.data["entry"]["id"], first.data["id"])
        self.assertEqual(
            Entry.objects.filter(entry_writings__writing__text="行").count(), 2
        )

    def test_recording_minimum_submission_creates_draft_entry_link_and_evidence(self):
        response = self.client.post(
            "/recordings/",
            {
                "audio_url": "https://example.test/fear.mp3",
                "usage_dialect_id": self.group.id,
                "original_gloss": " 表示害怕的意思 ",
                "original_writing": " 惊 ",
                "original_pronunciation": " kiaⁿ2 ",
            },
            format="json",
        )

        self.assertEqual(response.status_code, 201, response.data)
        self.assertEqual(response.data["evidence_count"], 1)
        recording = Recording.objects.get(pk=response.data["id"])
        link = recording.entry_links.get()
        entry = link.entry
        self.assertEqual(recording.original_gloss, "表示害怕的意思")
        self.assertEqual(entry.summary, "表示害怕的意思")
        self.assertEqual(entry.entry_writings.get().writing.text, "惊")
        self.assertEqual(link.role, RecordingEntryLink.Role.PRIMARY)
        self.assertEqual(link.status, RecordingEntryLink.Status.ACCEPTED)
        evidence = EvidenceRecord.objects.get(contributor=self.owner)
        self.assertEqual(evidence.original_gloss, " 表示害怕的意思 ")
        self.assertEqual(evidence.original_writing, " 惊 ")
        self.assertEqual(evidence.original_pronunciation, " kiaⁿ2 ")
        self.assertNotIn("location", recording.metadata)
        self.assertNotIn("device_location", recording.metadata)

    def test_recording_can_link_mentions_and_competing_entries(self):
        primary, _ = self.make_entry("走", "行")
        mentioned, _ = self.make_entry("回家", "归")
        competing, _ = self.make_entry("跑", "走")
        recording = Recording.objects.create(
            audio_url="https://example.test/go-home.mp3",
            usage_dialect=self.city,
            recorder=self.owner,
            original_gloss="走回家",
            visibility=True,
        )
        RecordingEntryLink.objects.create(
            recording=recording,
            entry=primary,
            role=RecordingEntryLink.Role.PRIMARY,
            status=RecordingEntryLink.Status.ACCEPTED,
            created_by=self.owner,
        )

        mention = self.client.post(
            "/recording-entry-links/",
            {
                "recording_id": recording.id,
                "entry_id": mentioned.id,
                "role": "mention",
            },
            format="json",
        )
        competing_response = self.client.post(
            "/recording-entry-links/",
            {
                "recording_id": recording.id,
                "entry_id": competing.id,
                "role": "competing",
            },
            format="json",
        )
        second_primary = self.client.post(
            "/recording-entry-links/",
            {
                "recording_id": recording.id,
                "entry_id": competing.id,
                "role": "primary",
            },
            format="json",
        )

        self.assertEqual(mention.status_code, 201, mention.data)
        self.assertEqual(competing_response.status_code, 201, competing_response.data)
        self.assertEqual(second_primary.status_code, 400)
        self.assertEqual(
            set(recording.entry_links.values_list("role", flat=True)),
            {"primary", "mention", "competing"},
        )

    def test_attestation_keeps_selected_parent_scope_and_soft_deactivates(self):
        entry, _ = self.make_entry("害怕", "惊", dialect=None)
        created = self.client.post(
            "/usage-attestations/",
            {"entry_id": entry.id, "dialect_id": self.group.id},
            format="json",
        )
        self.assertEqual(created.status_code, 201, created.data)
        attestation = UsageAttestation.objects.get()
        self.assertEqual(attestation.dialect, self.group)
        self.assertNotEqual(attestation.dialect, self.city)

        deleted = self.client.delete(f"/usage-attestations/{attestation.id}/")

        self.assertEqual(deleted.status_code, 204)
        attestation.refresh_from_db()
        self.assertFalse(attestation.active)

    def test_private_objects_are_visible_only_to_owner_or_curator(self):
        private, _ = self.make_entry("私有词", "隐", owner=self.owner)
        private.visibility = False
        private.save(update_fields=["visibility"])

        anonymous = APIClient()
        public_result = anonymous.get("/entries/", {"search": "私有"})
        owner_result = self.client.get("/entries/", {"search": "私有"})
        self.assertEqual(public_result.data["count"], 0)
        self.assertEqual(owner_result.data["count"], 1)

        other_client = APIClient()
        other_client.force_authenticate(self.other)
        denied = other_client.patch(
            f"/entries/{private.id}/", {"summary": "越权修改"}, format="json"
        )
        self.assertEqual(denied.status_code, 404)

        CuratorGrant.objects.create(
            user=self.other,
            role=CuratorGrant.Role.LEXICAL,
            valid_until=timezone.now() + timedelta(days=30),
            granted_by=self.owner,
            reason="测试整理权限",
        )
        allowed = other_client.patch(
            f"/entries/{private.id}/", {"summary": "整理员修订"}, format="json"
        )
        self.assertEqual(allowed.status_code, 200, allowed.data)

    def test_curation_summary_and_legacy_candidates_require_active_grant(self):
        entry, _ = self.make_entry("待整理", "候")
        candidate = LegacyReviewCandidate.objects.create(
            source_system="legacy",
            candidate_key="word:1",
            candidate_type=LegacyReviewCandidate.CandidateType.SENSE_SEGMENTATION,
            primary_entry=entry,
            source_ids=[1],
            payload={"original_definition": "①一。②二。"},
            fingerprint="abc",
        )
        candidate.entries.add(entry)

        denied = self.client.get("/curation/")
        self.assertEqual(denied.status_code, 403)

        CuratorGrant.objects.create(
            user=self.owner,
            role=CuratorGrant.Role.LEXICAL,
            valid_until=timezone.now() + timedelta(days=30),
            granted_by=self.other,
            reason="测试整理权限",
        )
        summary = self.client.get("/curation/")
        candidates = self.client.get("/curation/legacy-candidates/")

        self.assertEqual(summary.status_code, 200, summary.data)
        self.assertEqual(summary.data["pending"]["legacy_candidates"], 1)
        self.assertEqual(candidates.status_code, 200, candidates.data)
        self.assertEqual(candidates.data["results"][0]["id"], candidate.id)

    def test_regional_curator_sees_only_private_records_in_granted_subtree(self):
        sibling = Dialect.objects.create(name="枫亭", code="枫亭", parent=self.group)
        city_entry, _ = self.make_entry("城里争议词", "城")
        sibling_entry, _ = self.make_entry("枫亭争议词", "枫", dialect=sibling)
        city_entry.status = Entry.Status.DISPUTED
        city_entry.visibility = False
        city_entry.save(update_fields=["status", "visibility"])
        sibling_entry.status = Entry.Status.DISPUTED
        sibling_entry.visibility = False
        sibling_entry.save(update_fields=["status", "visibility"])
        city_recording = Recording.objects.create(
            audio_url="https://example.test/city-private.mp3",
            usage_dialect=self.city,
            recorder=self.owner,
            original_gloss="城里",
            status=Recording.Status.DISPUTED,
            visibility=False,
        )
        sibling_recording = Recording.objects.create(
            audio_url="https://example.test/sibling-private.mp3",
            usage_dialect=sibling,
            recorder=self.owner,
            original_gloss="枫亭",
            status=Recording.Status.DISPUTED,
            visibility=False,
        )
        RecordingEntryLink.objects.create(
            recording=city_recording,
            entry=city_entry,
            role=RecordingEntryLink.Role.PRIMARY,
            status=RecordingEntryLink.Status.DISPUTED,
        )
        RecordingEntryLink.objects.create(
            recording=sibling_recording,
            entry=sibling_entry,
            role=RecordingEntryLink.Role.PRIMARY,
            status=RecordingEntryLink.Status.DISPUTED,
        )
        CuratorGrant.objects.create(
            user=self.other,
            role=CuratorGrant.Role.REGIONAL,
            dialect=self.city,
            valid_until=timezone.now() + timedelta(days=30),
            granted_by=self.owner,
            reason="只整理城里",
        )
        regional = APIClient()
        regional.force_authenticate(self.other)

        recordings = regional.get("/recordings/")
        curation = regional.get("/curation/")
        legacy_candidates = regional.get("/curation/legacy-candidates/")

        self.assertEqual(recordings.status_code, 200, recordings.data)
        self.assertEqual(
            {item["id"] for item in recordings.data["results"]},
            {city_recording.id},
        )
        self.assertEqual(curation.data["pending"]["disputed_entries"], 1)
        self.assertEqual(curation.data["pending"]["disputed_recordings"], 1)
        self.assertEqual(curation.data["pending"]["disputed_recording_links"], 1)
        self.assertEqual(curation.data["pending"]["legacy_candidates"], 0)
        self.assertEqual(legacy_candidates.status_code, 403)

    def test_anonymous_cannot_submit_recording(self):
        client = APIClient()
        response = client.post(
            "/recordings/",
            {
                "audio_url": "https://example.test/nope.mp3",
                "usage_dialect_id": self.group.id,
                "original_gloss": "不能匿名提交",
            },
            format="json",
        )
        self.assertEqual(response.status_code, 401)

    def test_entry_bookmarks_are_private_idempotent_and_do_not_rank_entries(self):
        first, _ = self.make_entry("步行", "行")
        second, _ = self.make_entry("奔跑", "走")

        saved = self.client.put(f"/entries/{first.id}/bookmark/")
        repeated = self.client.put(f"/entries/{first.id}/bookmark/")
        bookmarks = self.client.get("/entries/bookmarks/")

        self.assertEqual(saved.status_code, 200)
        self.assertTrue(saved.data["changed"])
        self.assertFalse(repeated.data["changed"])
        self.assertEqual(bookmarks.data["count"], 1)
        self.assertEqual(bookmarks.data["results"][0]["id"], first.id)
        self.assertTrue(bookmarks.data["results"][0]["is_bookmarked"])

        anonymous = APIClient()
        anonymous_list = anonymous.get("/entries/")
        self.assertEqual(anonymous_list.status_code, 200)
        self.assertEqual(
            {item["id"] for item in anonymous_list.data["results"]},
            {first.id, second.id},
        )
        self.assertTrue(
            all(not item["is_bookmarked"] for item in anonymous_list.data["results"])
        )

        removed = self.client.delete(f"/entries/{first.id}/bookmark/")
        self.assertTrue(removed.data["changed"])
        self.assertEqual(self.client.get("/entries/bookmarks/").data["count"], 0)

    def test_v2_circle_lists_recordings_and_legacy_public_routes_are_retired(self):
        entry, _ = self.make_entry("步行", "行", dialect=self.city)
        recording = Recording.objects.create(
            audio_url="https://example.test/circle.mp3",
            usage_dialect=self.city,
            recorder=self.owner,
            original_gloss="走路",
            visibility=True,
        )
        RecordingEntryLink.objects.create(
            recording=recording,
            entry=entry,
            role=RecordingEntryLink.Role.PRIMARY,
            status=RecordingEntryLink.Status.ACCEPTED,
        )
        circle = DialectCircle.objects.create(name="莆仙方言圈", dialect=self.group)

        response = self.client.get(f"/circles/{circle.id}/recordings/")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["results"][0]["id"], recording.id)

        retired = (
            "/cans/",
            "/nameplates/",
            "/flavors/",
            "/packages/",
            "/pronunciations/",
            "/posts/",
            "/comments/",
            "/shelves/",
            "/search/",
            "/discovery/",
            f"/circles/{circle.id}/cans/",
        )
        for path in retired:
            with self.subTest(path=path):
                self.assertEqual(self.client.get(path).status_code, 404)

    def test_invalid_scope_and_boolean_use_standard_error_contract(self):
        response = self.client.get(
            "/entries/",
            {"dialect_id": self.group.id, "dialect_scope": "ancestors"},
        )
        boolean = self.client.get("/entries/", {"has_recording": "perhaps"})

        self.assertEqual(response.status_code, 400)
        self.assertEqual(response.json()["code"], 400)
        self.assertEqual(boolean.status_code, 400)
        self.assertEqual(boolean.json()["code"], 400)

    def test_writing_type_uses_current_relationships_only(self):
        current, _ = self.make_entry("当前罗马字", "行")
        retired, _ = self.make_entry("历史罗马字", "走")
        form = WritingForm.objects.create(text="hing", form_type="romanization")
        for entry, is_current in ((current, True), (retired, False)):
            EntryWriting.objects.create(
                entry=entry, writing=form, is_current=is_current, status="reviewed"
            )
        for params in (
            {"writing_type": "romanization"},
            {"writing_type": "romanization", "search": "罗马字"},
            {"writing_type": "romanization", "writing": "hing"},
        ):
            with self.subTest(params=params):
                response = self.client.get("/entries/", params)
                self.assertEqual(response.status_code, 200)
                self.assertEqual(
                    [item["id"] for item in response.data["results"]], [current.id]
                )

    def test_exact_writing_and_type_match_same_current_relationship(self):
        entry, _ = self.make_entry("移动含义", "行")
        for text in ("hing", "HING"):
            EntryWriting.objects.create(
                entry=entry,
                writing=WritingForm.objects.create(text=text, form_type="romanization"),
            )
        cases = (
            ({"writing": "行", "writing_type": "romanization"}, []),
            ({"writing": "行", "writing_type": "orthographic"}, [entry.id]),
            ({"writing": " hing ", "writing_type": "romanization"}, [entry.id]),
            ({"writing": " hing "}, [entry.id]),
            ({"writing": "missing"}, []),
            ({"writing_type": "romanization"}, [entry.id]),
            # Keyword search spans meanings and other writings, not just the type.
            ({"search": "行", "writing_type": "romanization"}, [entry.id]),
        )
        for params, expected in cases:
            with self.subTest(params=params):
                response = self.client.get("/entries/", params)
                self.assertEqual(response.status_code, 200)
                self.assertEqual(
                    [item["id"] for item in response.data["results"]], expected
                )

    def test_writing_filters_preserve_status_and_visibility_rules(self):
        entries = []
        for state in EntryWriting.Status.values:
            entry, _ = self.make_entry(f"状态 {state}", state)
            EntryWriting.objects.create(
                entry=entry,
                writing=WritingForm.objects.create(
                    text="hing", form_type="romanization"
                ),
                status=state,
            )
            entries.append(entry)
        private, _ = self.make_entry("私有", "私")
        private.visibility = False
        private.save(update_fields=["visibility"])
        EntryWriting.objects.create(
            entry=private,
            writing=WritingForm.objects.create(text="hing", form_type="romanization"),
        )
        self.client.force_authenticate(user=None)
        for params in (
            {"writing_type": "romanization"},
            {"writing": "hing", "writing_type": "romanization"},
        ):
            with self.subTest(params=params):
                response = self.client.get("/entries/", params)
                self.assertEqual(response.status_code, 200)
                self.assertEqual(
                    {item["id"] for item in response.data["results"]},
                    {entry.id for entry in entries},
                )
