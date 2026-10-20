from copy import deepcopy
from datetime import timedelta

from django.contrib.auth.models import User
from django.core.exceptions import ValidationError
from django.test import TestCase
from django.utils import timezone
from rest_framework.test import APIClient

from .models import (
    CurationAction,
    CuratorGrant,
    Dialect,
    Entry,
    EvidenceLink,
    EvidenceRecord,
    LegacyReviewCandidate,
    PronunciationVariant,
    Recording,
    RecordingEntryLink,
)


class CurationProvenanceTests(TestCase):
    def setUp(self):
        self.root = Dialect.objects.create(name="Test root", code="provenance-root")
        self.local = Dialect.objects.create(
            name="Local", code="local", parent=self.root
        )
        self.other = Dialect.objects.create(name="Other", code="provenance-other")
        self.owner = User.objects.create_user("owner")
        self.actor = User.objects.create_user("actor")
        self.peer = User.objects.create_user("peer")
        self.outsider = User.objects.create_user("outsider")
        self.staff = User.objects.create_user("staff", is_staff=True)
        self.grant = self.issue(self.actor, self.root)
        self.issue(self.peer, self.root)
        self.issue(self.outsider, self.other)
        self.entry = Entry.objects.create(
            summary="Claim",
            usage_dialect=self.root,
            status="reviewed",
            visibility=False,
            created_by=self.owner,
        )
        self.evidence = EvidenceRecord.objects.create(
            original_text="Test source", contributor=self.owner
        )
        EvidenceLink.objects.create(evidence=self.evidence, entry=self.entry)

    def issue(self, user, dialect=None, role="regional_curator"):
        return CuratorGrant.objects.create(
            user=user,
            dialect=dialect,
            role=role,
            granted_by=self.staff,
            reason="Administrative grant note",
        )

    def client_for(self, user):
        client = APIClient()
        client.force_authenticate(user)
        return client

    def narrow(self, actor=None, target=None, target_type="entry"):
        return self.client_for(actor or self.actor).post(
            "/curation/actions/",
            {
                "action_type": "narrow_scope",
                "target_type": target_type,
                "target_id": (target or self.entry).id,
                "reason": "Evidence supports a local claim",
                "evidence_ids": [self.evidence.id],
                "changes": {"dialect_id": self.local.id},
            },
            format="json",
        )

    def test_reviewed_scope_cannot_bypass_service_by_patch_put_or_staff(self):
        for user in (self.owner, self.staff):
            for method in ("patch", "put"):
                response = getattr(self.client_for(user), method)(
                    f"/entries/{self.entry.id}/",
                    {"usage_dialect_id": self.local.id},
                    format="json",
                )
                self.assertEqual(response.status_code, 400, response.data)
        self.entry.refresh_from_db()
        self.assertEqual(self.entry.usage_dialect_id, self.root.id)
        self.assertFalse(CurationAction.objects.exists())
        response = self.narrow()
        self.assertEqual(response.status_code, 201, response.data)
        self.assertEqual(
            response.data["before_snapshot"]["usage_dialect"]["id"], self.root.id
        )
        self.assertEqual(
            response.data["after_snapshot"]["usage_dialect"]["id"], self.local.id
        )

    def test_draft_scope_edits_remain_but_prior_semantic_action_protects_draft(self):
        self.entry.status = "draft"
        self.entry.save()
        response = self.client_for(self.owner).patch(
            f"/entries/{self.entry.id}/",
            {"usage_dialect_id": self.local.id},
            format="json",
        )
        self.assertEqual(response.status_code, 200, response.data)
        CurationAction.objects.create(
            actor=self.actor,
            action_type="review",
            target_type="entry",
            target_id=self.entry.id,
            reason="Earlier decision",
        )
        response = self.client_for(self.owner).patch(
            f"/entries/{self.entry.id}/",
            {"usage_dialect_id": self.root.id},
            format="json",
        )
        self.assertEqual(response.status_code, 400)

    def test_same_scope_and_unrelated_fields_can_still_be_saved(self):
        response = self.client_for(self.owner).patch(
            f"/entries/{self.entry.id}/",
            {"usage_dialect_id": self.root.id, "summary": "Clarified gloss"},
            format="json",
        )
        self.assertEqual(response.status_code, 200, response.data)

    def test_recording_and_pronunciation_scope_edits_are_also_protected(self):
        recording = Recording.objects.create(
            original_gloss="Clip",
            audio_url="https://example.test/a.wav",
            recorder=self.owner,
            usage_dialect=self.root,
            status="published",
        )
        pronunciation = PronunciationVariant.objects.create(
            entry=self.entry,
            dialect=self.root,
            ipa="a",
            status="reviewed",
            created_by=self.owner,
        )
        for path, payload in (
            (f"/recordings/{recording.id}/", {"usage_dialect_id": self.local.id}),
            (
                f"/pronunciation-variants/{pronunciation.id}/",
                {"dialect_id": self.local.id},
            ),
        ):
            response = self.client_for(self.owner).patch(path, payload, format="json")
            self.assertEqual(response.status_code, 400, response.data)
        for target, kind in (
            (recording, "recording"),
            (pronunciation, "pronunciation"),
        ):
            response = self.narrow(target=target, target_type=kind)
            self.assertEqual(response.status_code, 201, response.data)

    def test_peer_history_is_scoped_and_private_profile_grant_notes_are_not_shared(
        self,
    ):
        response = self.narrow()
        self.assertEqual(response.status_code, 201, response.data)
        aid = response.data["id"]
        peer = self.client_for(self.peer).get(f"/curation/actions/{aid}/")
        self.assertEqual(peer.status_code, 200, peer.data)
        self.assertEqual(peer.data["reason"], response.data["reason"])
        self.assertEqual(peer.data["actor"], {"id": self.actor.id})
        self.assertIsNone(peer.data["grant"])
        self.assertNotIn("Administrative grant note", str(peer.data))
        self.assertEqual(peer.data["evidence_ids"], [self.evidence.id])
        for user in (self.outsider, self.owner):
            denied = self.client_for(user).get(f"/curation/actions/{aid}/")
            self.assertEqual(denied.status_code, 404, denied.data)
        anonymous = APIClient().get(f"/curation/actions/{aid}/")
        self.assertIn(anonymous.status_code, (401, 403))
        listed = self.client_for(self.peer).get(
            "/curation/actions/", {"target_type": "entry", "target_id": self.entry.id}
        )
        rows = listed.data["results"] if isinstance(listed.data, dict) else listed.data
        self.assertIn(aid, [row["id"] for row in rows])

    def test_child_grant_cannot_read_parent_scope_history_even_when_target_now_local(
        self,
    ):
        response = self.narrow()
        child = User.objects.create_user("child-curator")
        self.issue(child, self.local)
        result = self.client_for(child).get(f'/curation/actions/{response.data["id"]}/')
        self.assertEqual(result.status_code, 404)

    def test_public_target_does_not_grant_out_of_scope_history(self):
        self.entry.visibility = True
        self.entry.save()
        response = self.narrow()
        denied = self.client_for(self.outsider).get(
            f'/curation/actions/{response.data["id"]}/'
        )
        self.assertEqual(denied.status_code, 404)

    def test_authority_snapshot_survives_revocation_edit_and_grant_deletion(self):
        response = self.narrow()
        self.assertEqual(response.status_code, 201, response.data)
        aid = response.data["id"]
        captured = deepcopy(response.data["authority_snapshot"])
        self.assertEqual(captured["mode"], "grant")
        self.assertEqual(captured["dialect"]["id"], self.root.id)
        self.grant.dialect = self.other
        self.grant.reason = "Changed administrative note"
        self.grant.revoked_at = timezone.now()
        self.grant.revocation_reason = "Revoked"
        self.grant.save()
        old = self.client_for(self.actor).get(f"/curation/actions/{aid}/")
        self.assertEqual(old.status_code, 200, old.data)
        self.assertEqual(old.data["authority_snapshot"], captured)
        blocked = self.narrow()
        self.assertEqual(blocked.status_code, 403)
        self.grant.delete()
        old = self.client_for(self.actor).get(f"/curation/actions/{aid}/")
        self.assertEqual(old.status_code, 200)
        self.assertIsNone(old.data["grant"])
        self.assertEqual(old.data["authority_snapshot"], captured)
        row = CurationAction.objects.get(pk=aid)
        row.authority_snapshot = {"mode": "fabricated"}
        with self.assertRaises(ValidationError):
            row.save()

    def test_expired_actor_can_read_own_history_but_not_create_or_read_others(self):
        own = self.narrow()
        self.grant.valid_from = timezone.now() - timedelta(days=2)
        self.grant.valid_until = timezone.now() - timedelta(days=1)
        self.grant.save()
        self.assertEqual(
            self.client_for(self.actor)
            .get(f'/curation/actions/{own.data["id"]}/')
            .status_code,
            200,
        )
        self.assertEqual(self.narrow().status_code, 403)
        other = CurationAction.objects.create(
            actor=self.peer,
            action_type="review",
            target_type="entry",
            target_id=self.entry.id,
            reason="Peer action",
        )
        self.assertEqual(
            self.client_for(self.actor)
            .get(f"/curation/actions/{other.id}/")
            .status_code,
            404,
        )

    def test_staff_and_unknown_legacy_authority_are_distinct(self):
        staff_action = self.narrow(actor=self.staff)
        self.assertEqual(staff_action.status_code, 201, staff_action.data)
        self.assertEqual(staff_action.data["authority_snapshot"]["mode"], "staff")
        legacy = CurationAction.objects.create(
            actor=self.actor,
            action_type="review",
            target_type="entry",
            target_id=self.entry.id,
            reason="Legacy record",
        )
        result = self.client_for(self.actor).get(f"/curation/actions/{legacy.id}/")
        self.assertEqual(
            result.data["authority_snapshot"],
            {"status": "unavailable", "reason": "legacy_record"},
        )

    def test_peer_cannot_learn_unlinked_private_evidence_identifiers(self):
        private = EvidenceRecord.objects.create(
            original_text="Unlinked private source", contributor=self.staff
        )
        response = self.narrow()
        row = CurationAction.objects.get(pk=response.data["id"])
        row.evidence.add(private)
        result = self.client_for(self.peer).get(f"/curation/actions/{row.id}/")
        self.assertNotIn(private.id, result.data["evidence_ids"])

    def test_lexical_peer_can_read_entry_history_but_cannot_make_regional_decisions(
        self,
    ):
        lexical = User.objects.create_user("lexical-peer")
        self.issue(lexical, role="lexical_curator")
        response = self.narrow()
        result = self.client_for(lexical).get(
            f'/curation/actions/{response.data["id"]}/'
        )
        self.assertEqual(result.status_code, 200, result.data)
        self.assertEqual(self.narrow(actor=lexical).status_code, 400)

    def test_peer_can_read_recording_pronunciation_and_versioned_link_decisions(self):
        recording = Recording.objects.create(
            original_gloss="Private clip",
            audio_url="https://example.test/private.wav",
            recorder=self.owner,
            usage_dialect=self.root,
            status="published",
            visibility=False,
        )
        pronunciation = PronunciationVariant.objects.create(
            entry=self.entry,
            dialect=self.root,
            ipa="a",
            status="reviewed",
            created_by=self.owner,
        )
        link = RecordingEntryLink.objects.create(
            recording=recording,
            entry=self.entry,
            status="accepted",
            role="primary",
        )
        reviewed = self.client_for(self.actor).post(
            "/curation/actions/",
            {
                "action_type": "review",
                "target_type": "recording_link",
                "target_id": link.id,
                "reason": "Interpretation needs further review",
                "changes": {"status": "disputed"},
            },
            format="json",
        )
        self.assertEqual(reviewed.status_code, 201, reviewed.data)
        decisions = [reviewed]
        decisions.append(self.narrow(target=recording, target_type="recording"))
        decisions.append(self.narrow(target=pronunciation, target_type="pronunciation"))
        for response in decisions:
            self.assertEqual(response.status_code, 201, response.data)
            url = f'/curation/actions/{response.data["id"]}/'
            self.assertEqual(self.client_for(self.peer).get(url).status_code, 200)
            self.assertEqual(self.client_for(self.outsider).get(url).status_code, 404)

    def test_client_cannot_supply_authority_snapshot(self):
        response = self.client_for(self.actor).post(
            "/curation/actions/",
            {
                "action_type": "narrow_scope",
                "target_type": "entry",
                "target_id": self.entry.id,
                "reason": "Evidence supports a local claim",
                "evidence_ids": [self.evidence.id],
                "changes": {"dialect_id": self.local.id},
                "authority_snapshot": {"mode": "staff", "role": "staff"},
            },
            format="json",
        )
        self.assertEqual(response.status_code, 201, response.data)
        self.assertEqual(response.data["authority_snapshot"]["mode"], "grant")

    def test_peer_cannot_read_deleted_target_or_inconsistent_legacy_scope(self):
        legacy = CurationAction.objects.create(
            actor=self.actor,
            action_type="narrow_scope",
            target_type="entry",
            target_id=self.entry.id,
            reason="Legacy scope",
            before_snapshot={"usage_dialect": {"id": self.other.id}},
            after_snapshot={"usage_dialect": {"id": self.root.id}},
        )
        self.assertEqual(
            self.client_for(self.peer)
            .get(f"/curation/actions/{legacy.id}/")
            .status_code,
            404,
        )
        response = self.narrow()
        self.entry.delete()
        self.assertEqual(
            self.client_for(self.peer)
            .get(f'/curation/actions/{response.data["id"]}/')
            .status_code,
            404,
        )
        self.assertEqual(
            self.client_for(self.actor)
            .get(f'/curation/actions/{response.data["id"]}/')
            .status_code,
            200,
        )

    def test_deleted_legacy_candidate_history_is_actor_only(self):
        lexical = User.objects.create_user("legacy-peer")
        self.issue(lexical, role="lexical_curator")
        candidate = LegacyReviewCandidate.objects.create(
            source_system="test",
            candidate_key="deleted-candidate",
            candidate_type="possible_duplicate",
            payload={"note": "Private legacy note"},
        )
        response = self.client_for(self.staff).post(
            "/curation/actions/",
            {
                "action_type": "resolve_legacy",
                "target_type": "legacy_candidate",
                "target_id": candidate.id,
                "reason": "Checked source",
                "changes": {"status": "rejected"},
            },
            format="json",
        )
        self.assertEqual(response.status_code, 201, response.data)
        url = f'/curation/actions/{response.data["id"]}/'
        self.assertEqual(self.client_for(lexical).get(url).status_code, 200)
        candidate.delete()
        self.assertEqual(self.client_for(lexical).get(url).status_code, 404)
        self.assertEqual(self.client_for(self.staff).get(url).status_code, 200)

    def test_competing_history_requires_its_entry_to_remain_visible(self):
        recording = Recording.objects.create(
            original_gloss="Scoped clip",
            audio_url="https://example.test/a.wav",
            recorder=self.owner,
            usage_dialect=self.root,
            visibility=False,
        )
        response = self.client_for(self.actor).post(
            "/curation/actions/",
            {
                "action_type": "preserve_competing",
                "target_type": "recording",
                "target_id": recording.id,
                "reason": "Keep alternative",
                "evidence_ids": [self.evidence.id],
                "changes": {"entry_id": self.entry.id},
            },
            format="json",
        )
        self.assertEqual(response.status_code, 201, response.data)
        url = f'/curation/actions/{response.data["id"]}/'
        self.assertEqual(self.client_for(self.peer).get(url).status_code, 200)
        RecordingEntryLink.objects.filter(recording=recording).delete()
        self.entry.delete()
        self.assertEqual(self.client_for(self.peer).get(url).status_code, 404)
        self.assertEqual(self.client_for(self.actor).get(url).status_code, 200)

    def lexical_competing_history(self):
        author = User.objects.create_user("lexical-author")
        peer = User.objects.create_user("lexical-history-peer")
        author_grant = self.issue(author, role="lexical_curator")
        peer_grant = self.issue(peer, role="lexical_curator")
        recording = Recording.objects.create(
            original_gloss="Public competing clip",
            audio_url="https://example.test/a.wav",
            recorder=self.owner,
            usage_dialect=self.root,
            visibility=True,
        )
        response = self.client_for(author).post(
            "/curation/actions/",
            {
                "action_type": "preserve_competing",
                "target_type": "recording",
                "target_id": recording.id,
                "reason": "Preserve lexical alternative",
                "evidence_ids": [self.evidence.id],
                "changes": {"entry_id": self.entry.id},
            },
            format="json",
        )
        self.assertEqual(response.status_code, 201, response.data)
        return author, peer, author_grant, peer_grant, recording, response.data["id"]

    def assert_history_access(self, user, action_id, allowed):
        client = self.client_for(user)
        detail = client.get(f"/curation/actions/{action_id}/")
        self.assertEqual(detail.status_code, 200 if allowed else 404, detail.data)
        listed = client.get("/curation/actions/", {"target_type": "recording"})
        self.assertEqual(listed.status_code, 200, listed.data)
        rows = listed.data["results"] if isinstance(listed.data, dict) else listed.data
        self.assertEqual(action_id in [row["id"] for row in rows], allowed)
        return detail

    def test_lexical_peer_reads_competing_history_with_redacted_response(self):
        author, peer, _, _, _, aid = self.lexical_competing_history()
        private = EvidenceRecord.objects.create(
            original_text="Unlinked secret", contributor=self.staff
        )
        CurationAction.objects.get(pk=aid).evidence.add(private)
        detail = self.assert_history_access(peer, aid, True)
        self.assertEqual(detail.data["actor"], {"id": author.id})
        self.assertIsNone(detail.data["grant"])
        self.assertNotIn(private.id, detail.data["evidence_ids"])
        self.assertNotIn("Administrative grant note", str(detail.data))
        self.assertEqual(detail.data["authority_snapshot"]["role"], "lexical_curator")

    def test_lexical_peer_competing_history_requires_visible_recording(self):
        author, peer, _, _, recording, aid = self.lexical_competing_history()
        self.assert_history_access(peer, aid, True)
        recording.visibility = False
        recording.save(update_fields=["visibility"])
        self.assert_history_access(peer, aid, False)
        self.assert_history_access(author, aid, True)
        recording.delete()
        self.assert_history_access(peer, aid, False)
        self.assert_history_access(author, aid, True)

    def test_lexical_peer_competing_history_requires_existing_visible_entry(self):
        from .v2_history import history_for_user

        author, peer, _, _, recording, aid = self.lexical_competing_history()
        # Lexical curators currently see private entries too. Check the supplied
        # visibility boundary directly rather than claiming visibility=False hides one.
        rows = history_for_user(
            CurationAction.objects.all(),
            peer,
            Entry.objects.none(),
            Recording.objects.all(),
        )
        self.assertFalse(rows.filter(pk=aid).exists())
        RecordingEntryLink.objects.filter(recording=recording).delete()
        self.entry.delete()
        self.assert_history_access(peer, aid, False)
        self.assert_history_access(author, aid, True)

    def test_lexical_peer_competing_history_rejects_malformed_entry_snapshot(self):
        _, peer, _, _, _, aid = self.lexical_competing_history()
        for snapshot in (
            {},
            {"competing_link": {}},
            {"competing_link": {"entry_id": None}},
            {"competing_link": {"entry_id": "invalid"}},
            {"competing_link": {"entry_id": {"id": self.entry.id}}},
            {"competing_link": {"entry_id": self.entry.id + 1000}},
        ):
            with self.subTest(snapshot=snapshot):
                # Model historical corrupt/legacy data without changing append-only API.
                CurationAction.objects.filter(pk=aid).update(after_snapshot=snapshot)
                self.assert_history_access(peer, aid, False)

    def test_revoked_lexical_peer_denied_but_actor_keeps_own_history(self):
        author, peer, author_grant, peer_grant, _, aid = (
            self.lexical_competing_history()
        )
        for grant in (peer_grant, author_grant):
            grant.revoked_at = timezone.now()
            grant.save(update_fields=["revoked_at"])
        self.assert_history_access(peer, aid, False)
        self.assert_history_access(author, aid, True)
        self.assert_history_access(self.owner, aid, False)

    def test_lexical_competing_access_does_not_expose_other_recording_actions(self):
        _, peer, _, _, recording, aid = self.lexical_competing_history()
        self.assert_history_access(peer, aid, True)
        narrow = self.narrow(target=recording, target_type="recording")
        self.assertEqual(narrow.status_code, 201, narrow.data)
        review = self.client_for(self.actor).post(
            "/curation/actions/",
            {
                "action_type": "review",
                "target_type": "recording",
                "target_id": recording.id,
                "reason": "Review recording state",
                "changes": {"status": "published"},
            },
            format="json",
        )
        self.assertEqual(review.status_code, 201, review.data)
        for other in (narrow, review):
            self.assert_history_access(peer, other.data["id"], False)
