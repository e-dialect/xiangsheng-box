from django.contrib.auth.models import User
from django.test import TestCase
from rest_framework.test import APIClient

from .models import (
    Dialect,
    Entry,
    EntryWriting,
    EvidenceLink,
    EvidenceRecord,
    PronunciationVariant,
    Recording,
    RecordingEntryLink,
    WritingForm,
)


class CharacterReadingTests(TestCase):
    endpoint = "/entries/character-readings/"

    @classmethod
    def setUpTestData(cls):
        cls.a = Dialect.objects.create(name="测试甲地", code="char-a")
        cls.b = Dialect.objects.create(name="测试乙地", code="char-b")
        cls.entry = Entry.objects.create(
            summary="测试义项", status=Entry.Status.REVIEWED
        )
        for spelling in ("汉", "漢"):
            cls.link_writing(cls.entry, spelling)
        for district, kind, status in (
            (cls.a, "literary", "reviewed"),
            (cls.a, "colloquial", "reviewed"),
            (cls.b, "colloquial", "disputed"),
            (cls.b, "general", "draft"),
        ):
            variant = PronunciationVariant.objects.create(
                entry=cls.entry,
                dialect=district,
                reading_type=kind,
                status=status,
                ipa="fixture",
            )
            if kind == "literary":
                source = EvidenceRecord.objects.create(
                    source_type="book", citation="测试资料第 2 页"
                )
                EvidenceLink.objects.create(
                    evidence=source,
                    pronunciation_variant=variant,
                    relation_type="supports",
                )
        for spelling, status, visible in (
            ("汉语", "reviewed", True),
            ("汉", "draft", True),
            ("汉", "reviewed", False),
        ):
            cls.link_writing(
                Entry.objects.create(status=status, visibility=visible), spelling
            )
        no_reading = Entry.objects.create(status="reviewed")
        cls.link_writing(no_reading, "字")
        for spelling, status, current in (
            ("山", "draft", True),
            ("水", "reviewed", False),
        ):
            cls.link_writing(cls.entry, spelling, status, current)
        for status, consent, link_status in (
            ("published", "public-display-v1", "accepted"),
            ("published", "", "accepted"),
            ("withdrawn", "public-display-v1", "accepted"),
            ("published", "public-display-v1", "suggested"),
        ):
            recording = Recording.objects.create(
                usage_dialect=cls.b,
                audio_url="https://example.invalid/test.wav",
                publication_consent=consent,
                status=status,
                visibility=status == "published",
            )
            RecordingEntryLink.objects.create(
                entry=cls.entry, recording=recording, status=link_status
            )
        cls.staff = User.objects.create_user(username="lookup-reviewer", is_staff=True)

    @staticmethod
    def link_writing(entry, text, status="reviewed", current=True):
        writing, _ = WritingForm.objects.get_or_create(text=text)
        return EntryWriting.objects.create(
            entry=entry, writing=writing, status=status, is_current=current
        )

    def test_exact_public_results_for_every_character_and_viewer(self):
        for user in (None, self.staff):
            client = APIClient()
            client.force_authenticate(user)
            text = "汉漢，汉𠮷A 字山水"
            response = client.get(self.endpoint, {"text": text})
            self.assertEqual(response.status_code, 200)
            rows = response.data
            self.assertEqual("".join(row["character"] for row in rows), text)
            self.assertEqual(rows[0]["entries"], rows[1]["entries"])
            self.assertEqual(rows[0], rows[3])
            self.assertEqual(
                [entry["id"] for entry in rows[0]["entries"]], [self.entry.pk]
            )
            item = rows[0]["entries"][0]
            self.assertEqual(set(item["writings"]), {"汉", "漢"})
            self.assertCountEqual(
                [(r["district"], r["reading_type"]) for r in item["readings"]],
                [
                    (self.a.name, "literary"),
                    (self.a.name, "colloquial"),
                    (self.b.name, "colloquial"),
                ],
            )
            literary = next(
                r for r in item["readings"] if r["reading_type"] == "literary"
            )
            self.assertEqual(literary["sources"][0]["citation"], "测试资料第 2 页")
            self.assertEqual(literary["sources"][0]["relation"], "支持")
            self.assertEqual(len(item["recordings"]), 1)
            self.assertEqual(item["recordings"][0]["district"], self.b.name)
            self.assertEqual(
                [r["kind"] for r in rows[4:7]], ["han", "other", "separator"]
            )
            self.assertEqual(rows[2]["kind"], "separator")
            self.assertEqual(rows[7]["entries"][0]["readings"], [])
            self.assertTrue(all(not rows[i]["entries"] for i in [2, 4, 5, 6, 8, 9]))

    def test_single_unknown_and_rejected_lengths(self):
        self.assertEqual(
            self.client.get(self.endpoint, {"text": "龘"}).data,
            [{"character": "龘", "kind": "han", "entries": []}],
        )
        for text in ("", " ", "汉" * 33):
            self.assertEqual(
                self.client.get(self.endpoint, {"text": text}).status_code, 400
            )
