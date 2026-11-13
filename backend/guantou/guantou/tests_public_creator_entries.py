from django.contrib.auth.models import User
from django.test import TestCase
from rest_framework.test import APIClient

from .models import CuratorGrant, Dialect, Entry, EntrySense, EntryWriting, WritingForm


class PublicCreatorEntryTests(TestCase):
    @classmethod
    def setUpTestData(cls):
        cls.author = User.objects.create_user(username="entry-author")
        cls.other = User.objects.create_user(username="entry-other")
        cls.curator = User.objects.create_user(username="entry-curator")
        cls.staff = User.objects.create_user(username="entry-staff", is_staff=True)
        CuratorGrant.objects.create(
            user=cls.curator, role=CuratorGrant.Role.LEXICAL, reason="测试"
        )
        dialect = Dialect.objects.create(name="示例方言", code="entry-profile-test")
        cls.reviewed = Entry.objects.create(
            created_by=cls.author,
            status=Entry.Status.REVIEWED,
            summary="节日的问候",
            identity_note="内部辨识备注",
            usage_dialect=dialect,
        )
        cls.disputed = Entry.objects.create(
            created_by=cls.author,
            status=Entry.Status.DISPUTED,
            summary="另一种公开说法",
        )
        Entry.objects.create(
            created_by=cls.author, status=Entry.Status.DRAFT, summary="可见草稿"
        )
        Entry.objects.create(
            created_by=cls.author,
            status=Entry.Status.REVIEWED,
            visibility=False,
            summary="私有词条",
        )
        Entry.objects.create(
            created_by=cls.author,
            status=Entry.Status.REDIRECTED,
            canonical_entry=cls.reviewed,
        )
        other_entry = Entry.objects.create(
            created_by=cls.other, status=Entry.Status.REVIEWED, summary="他人词条"
        )
        EntrySense.objects.create(entry=other_entry, created_by=cls.author)
        for entry, text, status in [
            (cls.disputed, "草稿写法", EntryWriting.Status.DRAFT),
            (cls.reviewed, "拜年", EntryWriting.Status.REVIEWED),
        ]:
            writing = WritingForm.objects.create(text=text, normalized_text=text)
            EntryWriting.objects.create(
                entry=entry,
                writing=writing,
                relation_type=EntryWriting.RelationType.PRIMARY,
                status=status,
            )

    def test_public_list_has_the_same_fields_and_visibility_for_every_viewer(self):
        for viewer in (None, self.author, self.other, self.curator, self.staff):
            with self.subTest(viewer=viewer):
                client = APIClient()
                client.force_authenticate(viewer)
                query = {"creator_id": self.author.id, "page_size": 1}
                first = client.get("/entries/public-contributions/", query)
                second = client.get(
                    "/entries/public-contributions/", {**query, "page": 2}
                )

                self.assertEqual(first.status_code, 200)
                self.assertEqual(first.data["count"], 2)
                self.assertTrue(first.data["next"])
                self.assertEqual(first.data["results"][0]["id"], self.disputed.id)
                self.assertEqual(first.data["results"][0]["display_writing"], "")
                self.assertEqual(second.status_code, 200)
                result = second.data["results"][0]
                self.assertEqual(
                    set(result), {"id", "display_writing", "summary", "usage_dialect"}
                )
                self.assertEqual(result["id"], self.reviewed.id)
                self.assertEqual(result["display_writing"], "拜年")

    def test_missing_or_invalid_creator_is_rejected(self):
        for query in ({}, {"creator_id": "bad"}, {"creator_id": -1}):
            with self.subTest(query=query):
                response = self.client.get("/entries/public-contributions/", query)
                self.assertEqual(response.status_code, 400)
