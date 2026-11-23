import json

from django.contrib.admin.models import LogEntry
from django.contrib.auth.models import Permission, User
from django.test import Client, TestCase
from django.urls import reverse

from guantou.models import CuratorGrant, Dialect
from siteconfig.models import ProductProfile

from .models import MaterialPack, MaterialRevision, RegionalMaintainer


def admin_url(model, view, *args):
    return reverse(f"admin:localtools_{model}_{view}", args=args)


class RegionalAdminTests(TestCase):
    def setUp(self):
        self.editor = User.objects.create_user("地方维护员", is_staff=True)
        self.other_editor = User.objects.create_user("另一维护员", is_staff=True)
        self.center = User.objects.create_superuser("中心", password="unused")
        self.region = Dialect.objects.get(code="莆仙", parent__code="闽")
        self.neighbor = Dialect.objects.create(
            name="测试子点", code="测试子点", parent=self.region
        )
        RegionalMaintainer.objects.create(user=self.other_editor, dialect=self.neighbor)
        self.foreign_pack = MaterialPack.objects.create(
            dialect=self.neighbor, kind="pinyin"
        )
        self.foreign = MaterialRevision.objects.create(
            pack=self.foreign_pack, **self.fields("foreign")
        )
        self.foreign.publish()
        self.client.force_login(self.center)
        self.assertContains(
            self.client.get(admin_url("regionalmaintainer", "changelist")),
            self.neighbor.qualified_code,
        )
        response = self.client.post(
            admin_url("regionalmaintainer", "add"),
            {
                "user": self.editor.pk,
                "dialect": self.region.pk,
                "_save": "保存",
            },
        )
        self.assertEqual(response.status_code, 302)
        self.grant = RegionalMaintainer.objects.get(
            user=self.editor, dialect=self.region
        )
        self.client.force_login(self.editor)

    def fields(self, version):
        return dict(
            version=version,
            title=f"拼音 {version}",
            accent="测试口音",
            source="测试来源",
            rights="测试校订依据",
            payload={
                "schema": 1,
                "sections": [{"title": "示例", "rows": [{"form": "a"}]}],
            },
        )

    def add_revision(self, pack, version):
        data = self.fields(version)
        data["payload"] = json.dumps(data["payload"])
        return self.client.post(
            admin_url("materialrevision", "add"),
            {
                **data,
                "pack": pack.pk,
                "_save": "保存",
            },
        )

    def action(self, action, *revisions):
        return self.client.post(
            admin_url("materialrevision", "changelist"),
            {
                "action": action,
                "_selected_action": [r.pk for r in revisions],
                "index": 0,
            },
        )

    def current_version(self, dialect):
        content = self.client.get(
            reverse("local-tool-packs"), {"dialect": dialect.qualified_code}
        ).json()
        return content["packs"].get("pinyin", {}).get("version")

    def test_admin_home_scope_and_new_pack_publish_restore(self):
        self.assertEqual(Client().get(reverse("admin:login")).status_code, 200)
        self.assertContains(
            self.client.get(reverse("admin:index")),
            admin_url("materialrevision", "changelist"),
        )
        app_index = self.client.get(reverse("admin:app_list", args=["localtools"]))
        self.assertContains(app_index, admin_url("regionalmaintainer", "changelist"))
        grants = self.client.get(admin_url("regionalmaintainer", "changelist"))
        self.assertContains(grants, self.region.qualified_code)
        self.assertNotContains(grants, self.neighbor.qualified_code)
        form = (
            self.client.get(admin_url("materialpack", "add")).context["adminform"].form
        )
        self.assertQuerySetEqual(form.fields["dialect"].queryset, [self.region])
        added = self.client.post(
            admin_url("materialpack", "add"),
            {
                "dialect": self.region.pk,
                "kind": "pinyin",
                "_save": "保存",
            },
        )
        self.assertEqual(added.status_code, 302)
        pack = MaterialPack.objects.get(dialect=self.region, kind="pinyin")
        for version in ("one", "two"):
            self.assertEqual(self.add_revision(pack, version).status_code, 302)
        one, two = pack.materialrevision_set.order_by("pk")
        changed_fields = self.fields(one.version)
        changed_fields["payload"] = json.dumps(changed_fields["payload"])
        change = self.client.post(
            admin_url("materialrevision", "change", one.pk),
            {
                **changed_fields,
                "title": "改过的拼音表",
                "_save": "保存",
            },
        )
        self.assertEqual(change.status_code, 302)
        self.assertContains(
            self.client.get(
                reverse("admin:localtools_revision_preview", args=[one.pk])
            ),
            "改过的拼音表",
        )
        self.assertIsNone(self.current_version(self.region))
        for revision in (one, two, one):
            self.assertEqual(self.action("publish", revision).status_code, 302)
            self.assertEqual(self.current_version(self.region), revision.version)
        self.assertEqual(self.action("withdraw", one).status_code, 302)
        self.assertIsNone(self.current_version(self.region))
        self.assertEqual(self.current_version(self.neighbor), self.foreign.version)
        self.assertTrue(
            LogEntry.objects.filter(
                user=self.editor, change_message="恢复资料版本"
            ).exists()
        )

    def test_exact_dialect_multiple_grants_and_revocation(self):
        form_url = admin_url("materialrevision", "add")
        self.assertFalse(
            self.client.get(form_url)
            .context["adminform"]
            .form.fields["pack"]
            .queryset.exists()
        )
        self.assertEqual(
            self.add_revision(self.foreign_pack, "outside").status_code, 200
        )
        self.assertFalse(MaterialRevision.objects.filter(version="outside").exists())
        self.assertNotContains(
            self.client.get(admin_url("materialrevision", "changelist")),
            self.foreign.title,
        )
        preview = reverse("admin:localtools_revision_preview", args=[self.foreign.pk])
        self.assertEqual(self.client.get(preview).status_code, 403)
        self.action("withdraw", self.foreign)
        self.assertEqual(self.current_version(self.neighbor), self.foreign.version)

        extra = RegionalMaintainer.objects.create(
            user=self.editor, dialect=self.neighbor
        )
        self.assertContains(self.client.get(preview), self.foreign.title)
        self.client.force_login(self.center)
        revoked = self.client.post(
            admin_url("regionalmaintainer", "delete", extra.pk), {"post": "yes"}
        )
        self.assertEqual(revoked.status_code, 302)
        self.client.force_login(self.editor)
        self.assertEqual(self.client.get(preview).status_code, 403)
        self.grant.delete()
        self.assertEqual(self.client.get(form_url).status_code, 403)

    def test_grant_is_independent_of_profile_curator_and_global_settings(self):
        for url in [
            admin_url("regionalmaintainer", "add"),
            reverse("admin:guantou_curatorgrant_add"),
            reverse("admin:siteconfig_sitesettings_add"),
            reverse("admin:siteconfig_productprofile_changelist"),
            reverse("admin:siteconfig_productprofilerevision_add"),
        ]:
            with self.subTest(url=url):
                self.assertEqual(self.client.get(url).status_code, 403)
        self.assertEqual(
            self.client.post(
                admin_url("regionalmaintainer", "change", self.grant.pk),
                {
                    "user": self.editor.pk,
                    "dialect": self.neighbor.pk,
                },
            ).status_code,
            403,
        )
        CuratorGrant.objects.create(
            user=self.other_editor,
            role=CuratorGrant.Role.REGIONAL,
            dialect=self.region,
            granted_by=self.center,
            reason="测试词条整理权",
        )
        ProductProfile.objects.get(pk="pxm").editors.add(self.other_editor)
        self.client.force_login(self.other_editor)
        form = (
            self.client.get(
                admin_url("materialpack", "add"),
                HTTP_ORIGIN="https://pxm.test.edialect.top",
            )
            .context["adminform"]
            .form
        )
        self.assertQuerySetEqual(form.fields["dialect"].queryset, [self.neighbor])

    def test_global_read_permission_does_not_expand_edit_or_publish(self):
        self.editor.user_permissions.add(
            Permission.objects.get(codename="view_materialrevision")
        )
        own_pack = MaterialPack.objects.create(dialect=self.region, kind="pinyin")
        own = MaterialRevision.objects.create(pack=own_pack, **self.fields("own"))
        own.publish()
        self.assertContains(
            self.client.get(admin_url("materialrevision", "changelist")),
            self.foreign.title,
        )
        other_draft = MaterialRevision.objects.create(
            pack=self.foreign_pack, **self.fields("draft")
        )
        other_url = admin_url("materialrevision", "change", other_draft.pk)
        self.assertContains(self.client.get(other_url), other_draft.title)
        self.assertEqual(
            self.client.post(other_url, {"title": "改名"}).status_code, 403
        )
        self.assertEqual(self.action("withdraw", own, self.foreign).status_code, 403)
        self.assertEqual(self.action("publish", self.foreign).status_code, 403)
        self.assertEqual(self.current_version(self.region), "own")
        self.assertEqual(self.current_version(self.neighbor), "foreign")
