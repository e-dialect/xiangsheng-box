from django.contrib.admin.models import LogEntry
from django.contrib.auth.models import Permission, User
from django.core.exceptions import ValidationError
from django.test import Client, TestCase, override_settings
from django.urls import reverse

from guantou.models import Collection, Entry

from .models import ProductProfile, ProductProfileRevision, SiteSettings
from .product_profiles import publish_revision

URL = "/site-settings/product-profile"
BOX = "https://box.test.edialect.top"
PXM = "https://pxm.test.edialect.top"


@override_settings(BOX_PRODUCT_PROFILE_ORIGINS=None)
class ProductProfileTests(TestCase):
    def read(self, origin=BOX, **kwargs):
        return self.client.get(URL, HTTP_ORIGIN=origin, **kwargs).json()

    def test_exact_origins_helper_matches_both_known_hosts(self):
        response = self.client.get(URL, secure=True, HTTP_HOST="box.test.edialect.top")
        self.assertEqual(response.json()["profile"]["name"], "乡声集盒内测版")
        self.assertEqual(response.json()["profile"]["default_dialect"], "")
        self.assertIn("no-store", response.headers["Cache-Control"])
        self.assertIn("Origin", response.headers["Vary"])
        pxm = self.read(PXM, HTTP_HOST="api.test.edialect.top")
        self.assertEqual(pxm["profile"]["name"], "兴化语记 2.0 内测版")
        self.assertEqual(pxm["profile"]["credit"], "powered by 乡声集盒")
        self.assertEqual(pxm["profile"]["default_dialect"], "闽.莆仙")
        self.assertEqual(
            pxm["switch_targets"],
            [{"key": "box", "name": "乡声集盒内测版", "origin": BOX}],
        )
        self.assertEqual(response.json()["switch_targets"][0]["origin"], PXM)

    def test_unknown_hosts_query_and_forwarded_values_do_not_select_a_profile(self):
        response = self.client.get(
            f"{URL}?profile=pxm",
            secure=True,
            HTTP_HOST="preview.example.test",
            HTTP_X_FORWARDED_HOST="pxm.test.edialect.top",
        )
        self.assertEqual(response.json()["profile"]["key"], "general")
        self.assertEqual(response.json()["switch_targets"], [])
        for origin in (f"{PXM}.elsewhere.test", f"{PXM}:444", f"{PXM}/", "null"):
            with self.subTest(origin=origin):
                self.assertEqual(self.read(origin)["profile"]["name"], "乡声集盒")
        with override_settings(BOX_PRODUCT_PROFILE_ORIGINS={}):
            self.assertEqual(self.read(PXM)["profile"]["key"], "general")

    def test_wechat_binding_and_neutral_third_station(self):
        third = ProductProfile.objects.create(key="sample")
        draft = ProductProfileRevision.objects.create(profile=third, name="第三站")
        origins = {BOX: "box", PXM: "pxm", "https://sample.test.edialect.top": "sample"}
        with override_settings(BOX_PRODUCT_PROFILE_ORIGINS=origins):
            self.assertEqual(
                self.read("https://sample.test.edialect.top")["profile"]["key"],
                "general",
            )
            self.assertTrue(publish_revision(draft))
            self.assertEqual(
                self.read("https://sample.test.edialect.top")["profile"]["name"],
                "第三站",
            )
            self.assertEqual(len(self.read(PXM)["switch_targets"]), 2)
        self.assertEqual(self.client.get(f"{URL}/pxm").json()["profile"]["key"], "pxm")
        self.assertEqual(
            self.client.get(f"{URL}/unknown").json()["profile"]["key"], "general"
        )

    def test_public_recommendations_are_ordered_and_follow_current_visibility(self):
        site_settings = SiteSettings.get_solo()
        site_settings.carousel = ["previous"]
        site_settings.save(update_fields=["carousel"])
        box = ProductProfile.objects.get(pk="box")
        user = User.objects.create_user("owner")
        first = Entry.objects.create(summary="精选一", visibility=True)
        second = Collection.objects.create(title="莆仙集盒", owner=user, is_public=True)
        revision = ProductProfileRevision.objects.create(
            profile=box,
            name="夜间预览",
            featured=[
                {"type": "collection", "id": second.id},
                {"type": "entry", "id": first.id},
            ],
        )
        self.assertEqual(self.read()["profile"]["featured"], [])
        publish_revision(revision)
        self.assertEqual(
            self.read()["profile"]["featured"],
            [
                {"type": "collection", "id": second.id, "title": "莆仙集盒"},
                {"type": "entry", "id": first.id, "title": "精选一"},
            ],
        )
        self.assertEqual(self.read(PXM)["profile"]["featured"], [])
        site_settings.refresh_from_db()
        self.assertEqual(site_settings.carousel, ["previous"])
        first.visibility = False
        first.save(update_fields=["visibility"])
        self.assertEqual(
            self.read()["profile"]["featured"],
            [{"type": "collection", "id": second.id, "title": "莆仙集盒"}],
        )

    def test_draft_validation_rejects_private_duplicates_and_noninteger_ids(self):
        private = Entry.objects.create(summary="后台内容", visibility=False)
        box = ProductProfile.objects.get(pk="box")
        for entries in (
            [{"type": "entry", "id": private.id}],
            [{"type": "entry", "id": 1}] * 2,
            [{"type": "entry", "id": True}],
            [{"type": ["entry"], "id": 1}],
        ):
            with self.subTest(entries=entries):
                draft = ProductProfileRevision.objects.create(
                    profile=box, name="验证", featured=entries
                )
                with self.assertRaises(ValidationError):
                    publish_revision(draft)
                draft.refresh_from_db()
                self.assertIsNone(draft.first_published_at)


class ProductProfileEditorTests(TestCase):
    def setUp(self):
        self.editor = User.objects.create_user("editor", is_staff=True)
        self.editor.user_permissions.add(
            *Permission.objects.filter(
                content_type__app_label="siteconfig",
                codename__in=[
                    "add_productprofilerevision",
                    "change_productprofilerevision",
                ],
            )
        )
        self.box = ProductProfile.objects.get(pk="box")
        self.original = self.box.active_revision
        self.box.editors.add(self.editor)
        self.client.force_login(self.editor)

    def preview_url(self, revision):
        return reverse("admin:siteconfig_revision_preview", args=[revision.pk])

    def test_local_editor_previews_publishes_and_restores_selected_public_reference(
        self,
    ):
        entry = Entry.objects.create(summary="莆仙读法", visibility=True)
        response = self.client.post(self.preview_url(self.original), {"action": "copy"})
        self.assertEqual(response.status_code, 302)
        draft = self.box.revisions.first()
        response = self.client.post(
            response.url,
            {
                "name": "内测新精选",
                "credit": "",
                "default_dialect": "",
                "local_tools_dialect": "闽.莆仙",
                "featured": f"词条 {entry.id}",
                "_save": "保存",
            },
        )
        self.assertEqual(response.status_code, 302)
        preview = self.client.get(self.preview_url(draft))
        self.assertContains(preview, "莆仙读法")
        self.assertContains(preview, "发布此版本")
        self.box.refresh_from_db()
        self.assertEqual(self.box.active_revision, self.original)
        self.client.post(self.preview_url(draft), {"action": "publish"})
        self.box.refresh_from_db()
        self.assertEqual(self.box.active_revision, draft)
        self.assertContains(
            self.client.get(self.preview_url(self.original)), "恢复此版本"
        )
        self.client.post(self.preview_url(self.original), {"action": "publish"})
        self.box.refresh_from_db()
        self.assertEqual(self.box.active_revision, self.original)
        logs = LogEntry.objects.filter(user=self.editor).values_list(
            "change_message", flat=True
        )
        self.assertIn(f"发布线上版本 {draft.pk}", logs)
        self.assertIn(f"恢复线上版本 {self.original.pk}", logs)

    def test_editor_scope_published_immutability_and_public_preview_exclusion(self):
        foreign = ProductProfile.objects.get(pk="pxm").active_revision
        self.assertEqual(self.client.get(self.preview_url(foreign)).status_code, 404)
        self.assertEqual(
            self.client.post(
                self.preview_url(foreign), {"action": "publish"}
            ).status_code,
            404,
        )
        target_url = reverse(
            "admin:siteconfig_productprofilerevision_change", args=[self.original.pk]
        )
        self.assertEqual(
            self.client.post(target_url, {"name": "覆盖旧版"}).status_code, 403
        )
        anonymous = Client()
        self.assertEqual(
            anonymous.get(self.preview_url(self.original)).status_code, 302
        )
        self.assertEqual(anonymous.put(URL, {"key": "pxm"}).status_code, 405)
