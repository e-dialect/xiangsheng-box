import json
from pathlib import Path

from django.contrib.auth.models import Permission, User
from django.core.exceptions import ValidationError
from django.core.management import call_command
from django.test import TestCase
from django.urls import reverse

from guantou.models import Dialect, Entry, Recording

from .models import MaterialPack, MaterialRevision

EXAMPLES = Path(__file__).parent / "examples"


class LocalMaterialTests(TestCase):
    def setUp(self):
        self.root = Dialect.objects.get(code="闽", parent__isnull=True)
        self.dialect = Dialect.objects.get(code="莆仙", parent=self.root)
        self.endpoint = reverse("local-tool-packs")

    def load(self, **kwargs):
        return self.client.get(
            self.endpoint, {"dialect": self.dialect.qualified_code, **kwargs}
        ).json()

    def import_example(self, kind):
        call_command(
            "import_local_material", str(EXAMPLES / f"{kind}.json"), verbosity=0
        )
        return MaterialRevision.objects.get(pack__kind=kind)

    def test_import_is_draft_and_does_not_duplicate(self):
        for kind in MaterialPack.Kind.values:
            revision = self.import_example(kind)
            again = self.import_example(kind)
            self.assertEqual(revision.pk, again.pk)
            self.assertIsNone(revision.published_at)
        self.assertEqual(self.load()["packs"], {})

    def test_versions_remain_pinned_until_withdrawn(self):
        first = self.import_example("quiz")
        self.assertTrue(self.load(quiz_version=first.version)["quiz_unavailable"])
        first.publish()
        next_revision = MaterialRevision.objects.create(
            pack=first.pack,
            version="second",
            title="新版",
            accent=first.accent,
            source=first.source,
            rights=first.rights,
            payload=first.payload,
        )
        next_revision.publish()
        self.assertEqual(self.load()["packs"]["quiz"]["version"], "second")
        self.assertEqual(
            self.load(quiz_version=first.version)["packs"]["quiz"]["version"],
            first.version,
        )
        with self.assertRaises(ValidationError):
            first.save()  # A stale editor instance cannot overwrite a published snapshot.
        next_revision.withdraw()
        self.assertTrue(self.load(quiz_version=first.version)["quiz_unavailable"])
        first.publish()
        self.assertEqual(self.load()["packs"]["quiz"]["version"], first.version)
        self.assertTrue(self.load(quiz_version="second")["quiz_unavailable"])

    def test_missing_scope_and_public_links(self):
        revision = self.import_example("pinyin")
        private_entry = Entry.objects.create(
            usage_dialect=self.dialect, visibility=False
        )
        recording = Recording.objects.create(
            usage_dialect=self.dialect,
            visibility=True,
            audio_url="https://example.com/audio.wav",
        )
        row = revision.payload["sections"][1]["rows"][0]
        row.update(
            entry_id=private_entry.pk,
            recording_id=recording.pk,
            private_note="editor only",
        )
        revision.save()
        revision.publish()
        data = self.load()["packs"]["pinyin"]
        self.assertNotIn("rights", data)
        row = data["content"]["sections"][1]["rows"][0]
        self.assertNotIn("entry_id", row)
        self.assertNotIn("private_note", row)
        self.assertEqual(row["recording_id"], recording.pk)
        Recording.objects.filter(pk=recording.pk).update(visibility=False)
        self.assertNotIn(
            "recording_id",
            self.load()["packs"]["pinyin"]["content"]["sections"][1]["rows"][0],
        )
        other = Dialect.objects.create(name="别处", code="别处", parent=self.dialect)
        self.assertEqual(self.load(dialect=other.qualified_code)["packs"], {})

    def test_incomplete_quiz_cannot_publish(self):
        quiz = self.import_example("quiz")
        quiz.payload["questions"] = []
        quiz.save()
        with self.assertRaises(ValidationError):
            quiz.publish()
        self.assertEqual(self.load()["packs"], {})

    def test_editor_can_preview_but_publish_permission_is_separate(self):
        editor = User.objects.create_user("local-editor", is_staff=True)
        editor.user_permissions.set(
            Permission.objects.filter(
                content_type__app_label="localtools",
                codename__in=["view_materialrevision", "change_materialrevision"],
            )
        )
        revision = self.import_example("quiz")
        url = reverse("admin:localtools_revision_preview", args=[revision.pk])
        self.assertIn(self.client.get(url).status_code, (302, 403))
        self.client.force_login(editor)
        self.assertContains(self.client.get(url), revision.title)
        responses = self.client.post(
            reverse("admin:localtools_materialrevision_changelist"),
            {"action": "publish", "_selected_action": [revision.pk], "index": "0"},
        )
        self.assertIn(responses.status_code, (200, 302))
        self.assertFalse(self.load()["packs"])
        editor.user_permissions.add(
            Permission.objects.get(codename="publish_materialrevision")
        )
        self.client.post(
            reverse("admin:localtools_materialrevision_changelist"),
            {"action": "publish", "_selected_action": [revision.pk], "index": "0"},
        )
        self.assertEqual(self.load()["packs"]["quiz"]["version"], revision.version)

    def test_payload_examples_use_supported_schema(self):
        for kind in MaterialPack.Kind.values:
            data = json.loads((EXAMPLES / f"{kind}.json").read_text())
            self.assertEqual(data["payload"]["schema"], 1)
            self.assertEqual(data["dialect"], self.dialect.qualified_code)
