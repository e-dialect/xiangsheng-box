from datetime import timedelta

from django.contrib.auth.models import User
from django.core.exceptions import ValidationError
from django.utils import timezone
from rest_framework.test import APIClient, APITestCase

from .models import (
    CurationAction,
    CuratorApplication,
    CuratorGrant,
    Dialect,
    Entry,
    EntrySense,
    EvidenceRecord,
    Recording,
    RecordingEntryLink,
    UsageAttestation,
)


class GovernanceApiTests(APITestCase):
    def setUp(self):
        self.root = Dialect.objects.create(name="闽语", code="gov-min")
        self.puxian = Dialect.objects.create(
            name="莆仙片（兴化方言）", code="gov-puxian", parent=self.root
        )
        self.putian = Dialect.objects.create(
            name="莆田", code="gov-putian", parent=self.puxian
        )
        self.city = Dialect.objects.create(
            name="城里", code="gov-city", parent=self.putian
        )
        self.other = Dialect.objects.create(name="粤语", code="gov-yue")
        self.user = User.objects.create_user("speaker", password="secret")
        self.staff = User.objects.create_user(
            "reviewer", password="secret", is_staff=True
        )
        self.regional = User.objects.create_user("regional", password="secret")
        self.lexical = User.objects.create_user("lexical", password="secret")
        self.regional_grant = CuratorGrant.objects.create(
            user=self.regional,
            role=CuratorGrant.Role.REGIONAL,
            dialect=self.puxian,
            granted_by=self.staff,
            reason="熟悉莆仙各地口音与使用范围",
        )
        self.lexical_grant = CuratorGrant.objects.create(
            user=self.lexical,
            role=CuratorGrant.Role.LEXICAL,
            granted_by=self.staff,
            reason="能核对方言写法、义项与文献",
        )
        self.evidence = EvidenceRecord.objects.create(
            source_type=EvidenceRecord.SourceType.FIELDWORK,
            original_text="原贡献者只确定到莆仙方言，田野记录表明范围在城里。",
            contributor=self.user,
        )

    def client_for(self, user):
        client = APIClient()
        client.force_authenticate(user)
        return client

    def test_contributor_applies_and_staff_issues_public_one_year_grant(self):
        client = self.client_for(self.user)
        payload = {
            "role": CuratorGrant.Role.REGIONAL,
            "dialect_id": self.puxian.id,
            "statement": "我从小使用莆仙方言，能够核对城乡地区发音和词语的实际使用范围。",
            "experience": "整理过家庭口述记录。",
        }
        created = client.post("/curator-applications/", payload, format="json")
        self.assertEqual(created.status_code, 201)
        duplicate = client.post("/curator-applications/", payload, format="json")
        self.assertEqual(duplicate.status_code, 400)

        staff = self.client_for(self.staff)
        reviewed = staff.post(
            f"/curator-applications/{created.data['id']}/review/",
            {
                "decision": "approved",
                "reason": "经贡献记录核对，授予一年地区整理权限。",
            },
            format="json",
        )
        self.assertEqual(reviewed.status_code, 200)
        grant = CuratorGrant.objects.get(pk=reviewed.data["grant"]["id"])
        self.assertAlmostEqual(
            (grant.valid_until - grant.valid_from).total_seconds(),
            timedelta(days=365).total_seconds(),
            delta=2,
        )

        public = APIClient().get("/curator-grants/", {"user_id": self.user.id})
        self.assertEqual(public.status_code, 200)
        item = public.data["results"][0]
        self.assertEqual(item["user"]["username"], "speaker")
        self.assertEqual(item["dialect"]["path_names"], ["闽语", "莆仙片（兴化方言）"])
        self.assertIn("授予一年", item["reason"])
        self.assertTrue(item["valid_from"])
        self.assertTrue(item["valid_until"])

    def test_application_scope_and_withdrawal_are_enforced(self):
        client = self.client_for(self.user)
        invalid = client.post(
            "/curator-applications/",
            {
                "role": CuratorGrant.Role.REGIONAL,
                "statement": "我熟悉本地方言使用情况，并愿意持续核对来自不同村落的证据。",
            },
            format="json",
        )
        self.assertEqual(invalid.status_code, 400)
        application = CuratorApplication.objects.create(
            applicant=self.user,
            role=CuratorGrant.Role.LEXICAL,
            statement="我能核对词条写法和义项。",
        )
        withdrawn = client.delete(f"/curator-applications/{application.id}/")
        self.assertEqual(withdrawn.status_code, 204)
        application.refresh_from_db()
        self.assertEqual(application.status, CuratorApplication.Status.WITHDRAWN)

    def test_scope_narrowing_requires_evidence_and_preserves_before_snapshot(self):
        entry = Entry.objects.create(
            summary="害怕",
            usage_dialect=self.puxian,
            created_by=self.user,
        )
        client = self.client_for(self.regional)
        payload = {
            "action_type": "narrow_scope",
            "target_type": "entry",
            "target_id": entry.id,
            "reason": "田野记录只能确认到城里。",
            "changes": {"dialect_id": self.city.id},
        }
        missing = client.post("/curation/actions/", payload, format="json")
        self.assertEqual(missing.status_code, 400)
        payload["evidence_ids"] = [self.evidence.id]
        narrowed = client.post("/curation/actions/", payload, format="json")
        self.assertEqual(narrowed.status_code, 201)
        self.assertEqual(
            narrowed.data["before_snapshot"]["usage_dialect"]["id"],
            self.puxian.id,
        )
        self.assertEqual(
            narrowed.data["after_snapshot"]["usage_dialect"]["id"], self.city.id
        )
        self.assertEqual(narrowed.data["evidence_ids"], [self.evidence.id])
        entry.refresh_from_db()
        self.assertEqual(entry.usage_dialect_id, self.city.id)

        action = CurationAction.objects.get(pk=narrowed.data["id"])
        action.reason = "企图覆写"
        with self.assertRaises(ValidationError):
            action.save()

    def test_regional_curator_cannot_narrow_outside_grant_or_original_scope(self):
        entry = Entry.objects.create(
            summary="范围待核对", usage_dialect=self.puxian, created_by=self.user
        )
        response = self.client_for(self.regional).post(
            "/curation/actions/",
            {
                "action_type": "narrow_scope",
                "target_type": "entry",
                "target_id": entry.id,
                "reason": "这个范围不是原范围的下级。",
                "evidence_ids": [self.evidence.id],
                "changes": {"dialect_id": self.other.id},
            },
            format="json",
        )
        self.assertEqual(response.status_code, 400)
        entry.refresh_from_db()
        self.assertEqual(entry.usage_dialect_id, self.puxian.id)

    def test_split_and_merge_keep_source_entries_and_audit_snapshots(self):
        source = Entry.objects.create(
            summary="走：步行或奔跑", usage_dialect=self.puxian, created_by=self.user
        )
        walk = EntrySense.objects.create(entry=source, sense_number=1, gloss="步行")
        run = EntrySense.objects.create(entry=source, sense_number=2, gloss="奔跑")
        client = self.client_for(self.lexical)
        split = client.post(
            "/curation/actions/",
            {
                "action_type": "split_entry",
                "target_type": "entry",
                "target_id": source.id,
                "reason": "两个核心意义在该方言中应分立为不同词条。",
                "evidence_ids": [self.evidence.id],
                "changes": {
                    "sense_ids": [run.id],
                    "summary": "奔跑",
                    "identity_note": "表示快速奔跑的读音身份",
                },
            },
            format="json",
        )
        self.assertEqual(split.status_code, 201)
        created_id = split.data["after_snapshot"]["created"]["id"]
        walk.refresh_from_db()
        run.refresh_from_db()
        self.assertEqual(walk.entry_id, source.id)
        self.assertEqual(run.entry_id, created_id)
        source.refresh_from_db()
        self.assertEqual(source.status, Entry.Status.DISPUTED)

        merged = client.post(
            "/curation/actions/",
            {
                "action_type": "merge_entries",
                "target_type": "entry",
                "target_id": source.id,
                "reason": "新证据证明这是同一读音身份下的关联义项，恢复一个词条。",
                "evidence_ids": [self.evidence.id],
                "changes": {"source_entry_ids": [created_id]},
            },
            format="json",
        )
        self.assertEqual(merged.status_code, 201)
        redirected = Entry.objects.get(pk=created_id)
        self.assertEqual(redirected.status, Entry.Status.REDIRECTED)
        self.assertEqual(redirected.canonical_entry_id, source.id)
        self.assertTrue(Entry.objects.filter(pk=created_id).exists())

    def test_competing_explanation_never_replaces_the_accepted_primary(self):
        primary = Entry.objects.create(summary="原解释", usage_dialect=self.city)
        competing = Entry.objects.create(summary="竞争解释", usage_dialect=self.city)
        recording = Recording.objects.create(
            audio_url="https://example.com/a.mp3",
            usage_dialect=self.city,
            original_gloss="害怕",
            status=Recording.Status.PUBLISHED,
            visibility=True,
        )
        primary_link = RecordingEntryLink.objects.create(
            recording=recording,
            entry=primary,
            role=RecordingEntryLink.Role.PRIMARY,
            status=RecordingEntryLink.Status.ACCEPTED,
        )
        response = self.client_for(self.regional).post(
            "/curation/actions/",
            {
                "action_type": "preserve_competing",
                "target_type": "recording",
                "target_id": recording.id,
                "reason": "另一位母语者给出不同释义，先并列保留等待补证。",
                "evidence_ids": [self.evidence.id],
                "changes": {"entry_id": competing.id},
            },
            format="json",
        )
        self.assertEqual(response.status_code, 201)
        primary_link.refresh_from_db()
        self.assertTrue(primary_link.is_current)
        self.assertEqual(primary_link.status, RecordingEntryLink.Status.ACCEPTED)
        competing_link = recording.entry_links.get(
            role=RecordingEntryLink.Role.COMPETING
        )
        self.assertEqual(competing_link.status, RecordingEntryLink.Status.DISPUTED)

    def test_rejecting_a_published_recording_hides_it_and_keeps_the_audit(self):
        recording = Recording.objects.create(
            audio_url="https://example.com/reject.mp3",
            usage_dialect=self.city,
            original_gloss="来源需要复核",
            status=Recording.Status.PUBLISHED,
            visibility=True,
        )
        response = self.client_for(self.regional).post(
            "/curation/actions/",
            {
                "action_type": "review",
                "target_type": "recording",
                "target_id": recording.id,
                "reason": "录音授权无法核实，暂不采用。",
                "changes": {"status": "rejected"},
            },
            format="json",
        )
        self.assertEqual(response.status_code, 201)
        recording.refresh_from_db()
        self.assertEqual(recording.status, Recording.Status.REJECTED)
        self.assertFalse(recording.visibility)
        self.assertTrue(response.data["before_snapshot"]["visibility"])
        self.assertFalse(response.data["after_snapshot"]["visibility"])

    def test_regional_tasks_and_contribution_history_are_scoped_and_non_gamified(self):
        own = Recording.objects.create(
            audio_url="https://example.com/own.mp3",
            usage_dialect=self.city,
            recorder=self.regional,
            original_gloss="本地词",
        )
        Recording.objects.create(
            audio_url="https://example.com/other.mp3",
            usage_dialect=self.other,
            original_gloss="外地词",
        )
        entry = Entry.objects.create(summary="本地词", usage_dialect=self.city)
        UsageAttestation.objects.create(
            entry=entry, dialect=self.city, attester=self.regional
        )
        client = self.client_for(self.regional)
        tasks = client.get("/curation/tasks/")
        self.assertEqual(tasks.status_code, 200, tasks.content)
        recording_ids = {
            item["id"] for item in tasks.data["results"] if item["kind"] == "recording"
        }
        self.assertIn(own.id, recording_ids)
        self.assertNotIn(
            Recording.objects.get(original_gloss="外地词").id, recording_ids
        )
        summary = client.get("/curation/")
        self.assertEqual(summary.status_code, 200)
        self.assertEqual(summary.data["pending"]["recordings"], 1)
        self.assertEqual(summary.data["pending"]["entries"], 0)
        invalid_limit = client.get("/curation/tasks/", {"limit": "many"})
        self.assertEqual(invalid_limit.status_code, 400)

        history = client.get("/contributions/me/")
        self.assertEqual(history.status_code, 200)
        self.assertEqual(history.data["summary"]["recordings"], 1)
        self.assertEqual(history.data["summary"]["dialects"], 1)
        self.assertNotIn("score", history.data["summary"])
        self.assertNotIn("rank", history.data["summary"])
        self.assertEqual(
            history.data["dialect_footprint"][0]["dialect"]["id"], self.city.id
        )

    def test_expired_grant_cannot_open_workbench(self):
        expired = User.objects.create_user("expired", password="secret")
        CuratorGrant.objects.create(
            user=expired,
            role=CuratorGrant.Role.LEXICAL,
            valid_from=timezone.now() - timedelta(days=2),
            valid_until=timezone.now() - timedelta(days=1),
            reason="已过期",
        )
        response = self.client_for(expired).get("/curation/tasks/")
        self.assertEqual(response.status_code, 403)


class PrivateSubmissionCurationTests(APITestCase):
    client_for = GovernanceApiTests.client_for

    def setUp(self):
        GovernanceApiTests.setUp(self)
        from .models import RecordingMedia

        entry = Entry.objects.create(
            summary="private submission",
            visibility=False,
            created_by=self.user,
            usage_dialect=self.puxian,
        )
        media = RecordingMedia.objects.create(
            owner=self.user, content=b"audio", duration_ms=800, generated_entry=entry
        )
        self.private_recording = Recording.objects.create(
            media=media,
            status=Recording.Status.DRAFT,
            publication_consent="public-display-v1",
            recorder=self.user,
            original_gloss="private submission",
            usage_dialect=self.puxian,
            visibility=False,
        )
        self.private_entry = entry

    def test_private_submission_cannot_be_reviewed_by_lexical_curator(self):
        entry = self.private_entry
        client = self.client_for(self.lexical)
        self.assertEqual(client.get(f"/entries/{entry.id}/").status_code, 404)
        response = client.post(
            "/curation/actions/",
            {
                "action_type": "review",
                "target_type": "entry",
                "target_id": entry.id,
                "reason": "核对条目",
                "changes": {"status": "reviewed"},
            },
            format="json",
        )
        self.assertEqual(response.status_code, 400, response.data)
        entry.refresh_from_db()
        self.assertNotEqual(entry.status, Entry.Status.REVIEWED)
        self.assertFalse(CurationAction.objects.filter(actor=self.lexical).exists())

    def test_private_sources_and_competing_targets_are_inaccessible(self):
        public = Entry.objects.create(
            summary="public", visibility=True, usage_dialect=self.puxian
        )
        public_recording = Recording.objects.create(
            original_gloss="public", visibility=True, usage_dialect=self.puxian
        )
        requests = [
            (
                "merge_entries",
                "entry",
                public.id,
                {"source_entry_ids": [self.private_entry.id]},
            ),
            (
                "preserve_competing",
                "recording",
                self.private_recording.id,
                {"entry_id": public.id},
            ),
            (
                "preserve_competing",
                "recording",
                public_recording.id,
                {"entry_id": self.private_entry.id},
            ),
        ]
        for action, target, target_id, changes in requests:
            with self.subTest(action=action, changes=changes):
                response = self.client_for(self.lexical).post(
                    "/curation/actions/",
                    {
                        "action_type": action,
                        "target_type": target,
                        "target_id": target_id,
                        "reason": "核对资料",
                        "evidence_ids": [self.evidence.id],
                        "changes": changes,
                    },
                    format="json",
                )
                self.assertEqual(response.status_code, 400, response.data)
        self.assertFalse(CurationAction.objects.filter(actor=self.lexical).exists())
        self.private_entry.refresh_from_db()
        self.assertNotEqual(self.private_entry.status, Entry.Status.REDIRECTED)

    def test_visible_public_and_authorized_private_reviews_remain_allowed(self):
        CuratorGrant.objects.create(
            user=self.user,
            role=CuratorGrant.Role.LEXICAL,
            granted_by=self.staff,
            reason="授权整理",
        )
        public = Entry.objects.create(
            summary="public", visibility=True, usage_dialect=self.puxian
        )
        for actor, entry in [
            (self.lexical, public),
            (self.user, self.private_entry),
            (self.staff, self.private_entry),
        ]:
            with self.subTest(actor=actor.username):
                response = self.client_for(actor).post(
                    "/curation/actions/",
                    {
                        "action_type": "review",
                        "target_type": "entry",
                        "target_id": entry.id,
                        "reason": "核对条目",
                        "changes": {"status": "reviewed"},
                    },
                    format="json",
                )
                self.assertEqual(response.status_code, 201, response.data)
