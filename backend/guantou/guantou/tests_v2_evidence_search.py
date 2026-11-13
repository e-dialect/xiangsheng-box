from django.test import TestCase
from rest_framework.test import APIClient

from .models import Entry, EvidenceLink, EvidenceRecord


class EntryEvidenceSearchTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.split = Entry.objects.create(summary="来源条件分别落在不同证据")
        self.match = Entry.objects.create(summary="同一书籍证据匹配")
        self.oral = Entry.objects.create(summary="只有口述证据")
        self.no_evidence = Entry.objects.create(summary="尚无来源证据")
        self.hidden = Entry.objects.create(summary="未公开词条", visibility=False)
        for entry, source_type, citation in (
            (self.split, "book", "另一部方言志"),
            (self.split, "oral", "莆仙方言调查"),
            (self.match, "book", "莆仙方言调查（上卷）"),
            (self.match, "book", "莆仙方言调查（下卷）"),
            (self.oral, "oral", "莆仙方言调查"),
            (self.hidden, "book", "莆仙方言调查"),
        ):
            evidence = EvidenceRecord.objects.create(
                source_type=source_type, citation=citation
            )
            EvidenceLink.objects.create(evidence=evidence, entry=entry)

    def assert_results(self, params, expected):
        response = self.client.get("/entries/", params)
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["count"], len(expected))
        self.assertEqual(
            {item["id"] for item in response.data["results"]},
            {entry.id for entry in expected},
        )

    def test_type_and_citation_must_match_the_same_evidence(self):
        self.assert_results(
            {"source_type": "book", "source": "莆仙方言调查"}, [self.match]
        )

    def test_source_type_alone_preserves_all_matching_entries(self):
        self.assert_results({"source_type": "book"}, [self.split, self.match])

    def test_citation_alone_preserves_all_matching_source_types(self):
        self.assert_results(
            {"source": "莆仙方言调查"}, [self.split, self.match, self.oral]
        )

    def test_surrounding_citation_whitespace_is_ignored(self):
        self.assert_results(
            {"source_type": "book", "source": "  莆仙方言调查  "}, [self.match]
        )

    def test_keyword_can_match_another_evidence_record(self):
        EvidenceRecord.objects.filter(
            claim_links__entry=self.split, source_type="oral"
        ).update(original_gloss="乡友的原话")
        self.assert_results(
            {
                "search": "乡友的原话",
                "source_type": "book",
                "source": "另一部方言志",
            },
            [self.split],
        )

    def test_without_source_filters_entries_without_evidence_remain(self):
        self.assert_results({}, [self.split, self.match, self.oral, self.no_evidence])
