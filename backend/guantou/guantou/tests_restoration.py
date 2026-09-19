import uuid
import warnings

from django.contrib.auth.models import User
from django.core.paginator import UnorderedObjectListWarning
from django.test import TestCase
from rest_framework.test import APIClient
from inbox.models import Notification
from user.models import UserFollow
from .models import (
    Dialect,
    Entry,
    Recording,
    RecordingEntryLink,
    CollectionRecording,
    CollectionEntry,
    RecordingComment,
    DailyRecordingSelection,
)


class RestorationTests(TestCase):
    def setUp(self):
        self.user = User.objects.create_user("collector")
        self.other = User.objects.create_user("speaker")
        self.dialect = Dialect.objects.create(name="测试乡音", code="restore")
        self.entry = Entry.objects.create(
            summary="月亮", created_by=self.other, visibility=True
        )
        self.second = Entry.objects.create(
            summary="月亮", created_by=self.other, visibility=True
        )
        self.recording = Recording.objects.create(
            original_gloss="月娘",
            usage_dialect=self.dialect,
            recorder=self.other,
            audio_url="https://example.test/a.mp3",
            visibility=True,
        )
        self.link = RecordingEntryLink.objects.create(
            recording=self.recording, entry=self.entry, role="primary"
        )
        self.client = APIClient()
        self.client.force_authenticate(self.user)
        response = self.client.post(
            "/collections/", {"title": "月下乡音"}, format="json"
        )
        self.assertEqual(response.status_code, 201, response.data)
        self.box = response.data["id"]
        self.url = f"/collections/{self.box}/"

    def test_directory_dedup_sort_and_no_domain_mutations(self):
        RecordingEntryLink.objects.create(
            recording=self.recording, entry=self.second, role="mention"
        )
        for entry in (self.entry, self.second):
            for _ in range(2):
                response = self.client.post(
                    self.url + "recordings/",
                    {"recording_id": self.recording.id, "entry_id": entry.id},
                )
                self.assertEqual(response.status_code, 200, response.data)
        detail = self.client.get(self.url).data
        self.assertEqual((detail["entry_count"], detail["recording_count"]), (2, 1))
        self.assertEqual(CollectionRecording.objects.count(), 2)
        ids = [section["id"] for section in detail["sections"]]
        self.assertEqual(
            self.client.post(
                self.url + "order/", {"ids": ids[::-1]}, format="json"
            ).status_code,
            200,
        )
        self.assertEqual(self.client.get(self.url).data["sections"][0]["id"], ids[-1])
        self.assertEqual(
            self.client.post(
                self.url + "order/", {"ids": [ids[0]]}, format="json"
            ).status_code,
            400,
        )
        self.assertEqual(RecordingEntryLink.objects.count(), 2)

    def test_private_and_hidden_resources_are_not_leaked(self):
        self.client.post(
            self.url + "recordings/",
            {"recording_id": self.recording.id, "entry_id": self.entry.id},
        )
        self.client.force_authenticate(None)
        self.assertEqual(self.client.get(self.url).status_code, 404)
        self.client.force_authenticate(self.user)
        self.client.patch(self.url, {"is_public": True}, format="json")
        self.recording.visibility = False
        self.recording.save()
        self.client.force_authenticate(None)
        data = self.client.get(self.url).data
        self.assertEqual(data["recording_count"], 0)
        self.assertEqual(data["sections"][0]["recordings"], [])
        self.assertEqual(
            self.client.get(f"/recordings/{self.recording.id}/").status_code, 404
        )
        self.assertEqual(
            self.client.get(
                "/recording-comments/", {"recording_id": self.recording.id}
            ).status_code,
            404,
        )
        self.assertEqual(self.client.get("/recordings/daily/").status_code, 204)
        self.assertEqual(self.client.get("/recordings/random/").status_code, 204)
        self.client.force_authenticate(self.other)
        self.assertEqual(
            self.client.patch(self.url, {"title": "hijack"}).status_code, 403
        )

    def test_pending_confirmation_and_invalid_relation(self):
        self.link.delete()
        self.client.post(self.url + "recordings/", {"recording_id": self.recording.id})
        self.assertEqual(len(self.client.get(self.url).data["pending"]), 1)
        link = RecordingEntryLink.objects.create(
            recording=self.recording, entry=self.entry
        )
        self.assertEqual(len(self.client.get(self.url).data["pending"]), 1)
        self.client.post(
            self.url + "recordings/",
            {"recording_id": self.recording.id, "entry_id": self.entry.id},
        )
        self.assertEqual(self.client.get(self.url).data["pending"], [])
        link.status = "rejected"
        link.save()
        self.assertTrue(
            self.client.get(self.url).data["sections"][0]["recordings"][0][
                "needs_review"
            ]
        )
        self.client.patch(self.url, {"is_public": True})
        self.client.force_authenticate(None)
        self.assertEqual(self.client.get(self.url).data["recording_count"], 0)

    def test_like_comment_retry_reply_and_notification(self):
        url = f"/recordings/{self.recording.id}/like/"
        for _ in range(2):
            self.assertEqual(self.client.put(url).status_code, 200)
        self.client.delete(url)
        self.client.put(url)
        self.assertEqual(Notification.objects.filter(verb="recording.like").count(), 1)
        data = {
            "recording_id": self.recording.id,
            "body": "我这里也听过",
            "client_id": str(uuid.uuid4()),
        }
        first = self.client.post("/recording-comments/", data, format="json")
        self.assertEqual(first.status_code, 201, first.data)
        self.assertEqual(
            self.client.post("/recording-comments/", data, format="json").status_code,
            200,
        )
        self.assertEqual(RecordingComment.objects.count(), 1)
        data["body"] = "不能复用请求编号改变内容"
        self.assertEqual(
            self.client.post("/recording-comments/", data, format="json").status_code,
            400,
        )
        reply = self.client.post(
            "/recording-comments/",
            {**data, "client_id": str(uuid.uuid4()), "parent_id": first.data["id"]},
            format="json",
        )
        self.assertEqual(reply.status_code, 201)
        bad = self.client.post(
            "/recording-comments/",
            {**data, "client_id": str(uuid.uuid4()), "parent_id": reply.data["id"]},
            format="json",
        )
        self.assertEqual(bad.status_code, 404)
        self.client.delete(f'/recording-comments/{first.data["id"]}/')
        self.assertEqual(
            self.client.get(
                "/recording-comments/", {"recording_id": self.recording.id}
            ).data["count"],
            0,
        )

    def test_comment_reply_count_and_parent_filter(self):
        data = {
            "recording_id": self.recording.id,
            "body": "顶层留言",
            "client_id": str(uuid.uuid4()),
        }
        top = self.client.post("/recording-comments/", data, format="json")
        self.assertEqual(top.status_code, 201, top.data)
        top_id = top.data["id"]
        for _ in range(4):
            reply = self.client.post(
                "/recording-comments/",
                {
                    **data,
                    "client_id": str(uuid.uuid4()),
                    "parent_id": top_id,
                    "body": "回复留言",
                },
                format="json",
            )
            self.assertEqual(reply.status_code, 201, reply.data)

        listing = self.client.get(
            "/recording-comments/", {"recording_id": self.recording.id}
        ).data["results"]
        self.assertEqual(len(listing), 1)
        self.assertEqual(listing[0]["id"], top_id)
        self.assertEqual(listing[0]["reply_count"], 4)

        replies = self.client.get(
            "/recording-comments/",
            {"recording_id": self.recording.id, "parent_id": top_id},
        ).data["results"]
        self.assertEqual(len(replies), 4)
        self.assertEqual([item["parent_id"] for item in replies], [top_id] * 4)

    def test_reply_to_reply_targets_the_specific_comment(self):
        data = {
            "recording_id": self.recording.id,
            "body": "顶层留言",
            "client_id": str(uuid.uuid4()),
        }
        top = self.client.post("/recording-comments/", data, format="json")
        first = self.client.post(
            "/recording-comments/",
            {
                **data,
                "client_id": str(uuid.uuid4()),
                "parent_id": top.data["id"],
                "body": "第一条回复",
            },
            format="json",
        )
        self.client.post(
            "/recording-comments/",
            {
                **data,
                "client_id": str(uuid.uuid4()),
                "parent_id": top.data["id"],
                "body": "第二条回复",
            },
            format="json",
        )
        reply = self.client.post(
            "/recording-comments/",
            {
                **data,
                "client_id": str(uuid.uuid4()),
                "parent_id": top.data["id"],
                "reply_to_id": first.data["id"],
                "body": "回复第一条",
            },
            format="json",
        )
        self.assertEqual(reply.status_code, 201, reply.data)
        self.assertEqual(reply.data["reply_to_id"], first.data["id"])
        self.assertEqual(reply.data["reply_to_author_name"], self.user.username)

        bad = self.client.post(
            "/recording-comments/",
            {
                **data,
                "client_id": str(uuid.uuid4()),
                "reply_to_id": first.data["id"],
                "body": "缺少一级评论",
            },
            format="json",
        )
        self.assertEqual(bad.status_code, 400)

    def test_reply_pagination_is_stable_across_pages(self):
        data = {
            "recording_id": self.recording.id,
            "body": "顶层留言",
            "client_id": str(uuid.uuid4()),
        }
        top = self.client.post("/recording-comments/", data, format="json")
        self.assertEqual(top.status_code, 201, top.data)
        top_id = top.data["id"]
        created_ids = []
        for index in range(18):
            response = self.client.post(
                "/recording-comments/",
                {
                    **data,
                    "client_id": str(uuid.uuid4()),
                    "parent_id": top_id,
                    "body": f"回复{index}",
                },
                format="json",
            )
            self.assertEqual(response.status_code, 201, response.data)
            created_ids.append(response.data["id"])

        with warnings.catch_warnings(record=True) as caught:
            warnings.simplefilter("always")
            page1 = self.client.get(
                "/recording-comments/",
                {"recording_id": self.recording.id, "parent_id": top_id, "page": 1},
            )
            page2 = self.client.get(
                "/recording-comments/",
                {"recording_id": self.recording.id, "parent_id": top_id, "page": 2},
            )

        unordered = [
            item
            for item in caught
            if issubclass(item.category, UnorderedObjectListWarning)
        ]
        self.assertEqual(unordered, [])

        page1_ids = [item["id"] for item in page1.data["results"]]
        page2_ids = [item["id"] for item in page2.data["results"]]
        self.assertEqual(len(page1_ids), 15)
        self.assertEqual(len(page2_ids), 3)
        self.assertEqual(page1_ids + page2_ids, created_ids)

    def test_search_daily_following_and_hidden_entry_link(self):
        self.assertEqual(
            self.client.get("/entries/suggestions/", {"q": "月亮"}).status_code, 200
        )
        self.assertEqual(
            len(self.client.get("/entries/suggestions/", {"q": "月亮"}).data), 2
        )
        self.assertEqual(self.client.get("/entries/popular/").status_code, 200)
        first = self.client.get("/recordings/daily/").data["id"]
        self.assertEqual(self.client.get("/recordings/daily/").data["id"], first)
        self.assertEqual(DailyRecordingSelection.objects.count(), 1)
        self.assertEqual(
            self.client.get("/recordings/", {"following": "true"}).data["count"], 0
        )
        UserFollow.objects.create(follower=self.user, followed=self.other)
        self.assertEqual(
            self.client.get("/recordings/", {"following": "true"}).data["count"], 1
        )
        self.entry.visibility = False
        self.entry.save()
        self.client.force_authenticate(None)
        self.assertEqual(
            self.client.get(f"/recordings/{self.recording.id}/").data["entry_links"], []
        )
        self.assertEqual(
            len(self.client.get("/entries/suggestions/", {"q": "月亮"}).data), 1
        )

    def test_hidden_sections_remain_archived_without_blocking_visible_order(self):
        third = Entry.objects.create(
            summary="雨", created_by=self.other, visibility=True
        )
        for entry in (self.entry, self.second, third):
            self.client.post(self.url + "entries/", {"entry_id": entry.id})
        hidden_section = CollectionEntry.objects.get(entry=self.second)
        self.second.visibility = False
        self.second.save()
        data = self.client.get(self.url).data
        self.assertEqual(data["unavailable_count"], 1)
        ids = [section["id"] for section in data["sections"]]
        response = self.client.post(
            self.url + "order/", {"ids": ids[::-1]}, format="json"
        )
        self.assertEqual(response.status_code, 200)
        hidden_section.refresh_from_db()
        self.assertEqual(hidden_section.sort_order, 1)
        self.assertEqual(CollectionEntry.objects.count(), 3)

    def test_collection_serialization_batches_repeated_recordings(self):
        from django.db import connection
        from django.test.utils import CaptureQueriesContext

        self.client.post(
            self.url + "recordings/",
            {"recording_id": self.recording.id, "entry_id": self.entry.id},
        )
        self.client.patch(self.url, {"is_public": True})
        self.client.force_authenticate(None)
        with CaptureQueriesContext(connection) as baseline:
            self.client.get(self.url)
        for index in range(8):
            entry = Entry.objects.create(summary=f"编号{index}", visibility=True)
            RecordingEntryLink.objects.create(
                recording=self.recording, entry=entry, role="mention"
            )
            section = CollectionEntry.objects.create(
                collection_id=self.box, entry=entry
            )
            CollectionRecording.objects.create(
                collection_id=self.box, section=section, recording=self.recording
            )
        with CaptureQueriesContext(connection) as expanded:
            response = self.client.get(self.url)
        self.assertEqual(response.data["recording_count"], 1)
        self.assertLessEqual(len(expanded), len(baseline) + 2)

    def test_entry_discussion_isolated_idempotent_and_notifies_entry_creator(self):
        data = {
            "entry_id": self.entry.id,
            "body": "这个词还可以这样用",
            "client_id": str(uuid.uuid4()),
        }
        first = self.client.post("/entry-comments/", data, format="json")
        self.assertEqual(first.status_code, 201, first.data)
        self.assertEqual(first.data["entry_id"], self.entry.id)
        self.assertIsNone(first.data["recording_id"])
        self.assertEqual(
            self.client.post("/entry-comments/", data, format="json").status_code, 200
        )
        event = Notification.objects.get(verb="entry.comment")
        self.assertEqual(event.recipient, self.other)
        self.assertEqual(
            event.metadata["target_url"], f"/pages/entries/details?id={self.entry.id}"
        )
        self.assertEqual(
            self.client.get(
                "/recording-comments/", {"recording_id": self.recording.id}
            ).data["count"],
            0,
        )
        self.assertEqual(
            self.client.delete(f"/recording-comments/{first.data['id']}/").status_code,
            404,
        )
        reply = {**data, "client_id": str(uuid.uuid4()), "parent_id": first.data["id"]}
        self.assertEqual(
            self.client.post("/entry-comments/", reply, format="json").status_code, 201
        )
        self.assertEqual(
            self.client.post(
                "/entry-comments/",
                {**reply, "entry_id": self.second.id, "client_id": str(uuid.uuid4())},
                format="json",
            ).status_code,
            404,
        )
        self.assertEqual(
            self.client.post(
                "/recording-comments/",
                {
                    "recording_id": self.recording.id,
                    "parent_id": first.data["id"],
                    "body": "wrong",
                    "client_id": str(uuid.uuid4()),
                },
                format="json",
            ).status_code,
            404,
        )
        self.assertEqual(
            self.client.delete(f"/entry-comments/{first.data['id']}/").status_code, 204
        )
        self.assertEqual(
            self.client.get("/entry-comments/", {"entry_id": self.entry.id}).data[
                "count"
            ],
            0,
        )

    def test_discussion_requires_exactly_one_target_and_hidden_targets_reject_writes(
        self,
    ):
        from django.db import IntegrityError, transaction

        data = {
            "entry_id": self.entry.id,
            "recording_id": self.recording.id,
            "body": "wrong",
            "client_id": str(uuid.uuid4()),
        }
        self.assertEqual(
            self.client.post("/entry-comments/", data, format="json").status_code, 400
        )
        with self.assertRaises(IntegrityError), transaction.atomic():
            RecordingComment.objects.create(
                entry=self.entry,
                recording=self.recording,
                author=self.user,
                body="wrong",
                client_id=uuid.uuid4(),
            )
        with self.assertRaises(IntegrityError), transaction.atomic():
            RecordingComment.objects.create(
                author=self.user, body="wrong", client_id=uuid.uuid4()
            )
        self.entry.visibility = False
        self.entry.save(update_fields=["visibility"])
        self.client.force_authenticate(self.other)
        self.assertEqual(
            self.client.post(
                "/entry-comments/",
                {
                    "entry_id": self.entry.id,
                    "body": "hidden",
                    "client_id": str(uuid.uuid4()),
                },
                format="json",
            ).status_code,
            403,
        )
        self.client.force_authenticate(None)
        self.assertEqual(
            self.client.get(
                "/entry-comments/", {"entry_id": self.entry.id}
            ).status_code,
            404,
        )

    def test_entry_comment_likes_are_scoped_and_notifications_deduplicated(self):
        comment = RecordingComment.objects.create(
            entry=self.entry, author=self.other, body="词条留言", client_id=uuid.uuid4()
        )
        endpoint = f"/entry-comments/{comment.id}/like/"
        response = self.client.put(endpoint)
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["like_count"], 1)
        self.client.delete(endpoint)
        self.client.put(endpoint)
        self.assertEqual(
            Notification.objects.filter(verb="entry.comment_like").count(), 1
        )
        self.assertEqual(
            self.client.put(f"/recording-comments/{comment.id}/like/").status_code, 404
        )
        self.assertEqual(
            self.client.delete(f"/entry-comments/{comment.id}/").status_code, 403
        )
