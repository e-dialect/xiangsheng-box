import json

from django import forms
from django.contrib import admin, messages
from django.core.exceptions import PermissionDenied, ValidationError
from django.shortcuts import redirect, render
from django.urls import path, reverse
from django.utils.html import format_html

from .models import MaterialPack, MaterialRevision
from .public import public_material


@admin.register(MaterialPack)
class MaterialPackAdmin(admin.ModelAdmin):
    list_display = ["dialect", "kind", "active_revision"]
    list_filter = ["kind"]
    autocomplete_fields = ["dialect"]

    def get_readonly_fields(self, request, obj=None):
        return ["active_revision", "dialect", "kind"] if obj else ["active_revision"]

    def has_delete_permission(self, request, obj=None):
        return False


class MaterialRevisionForm(forms.ModelForm):
    payload_file = forms.FileField(label="上传资料内容 JSON（可选）", required=False)
    payload = forms.JSONField(
        label="资料内容",
        required=False,
        widget=forms.Textarea(attrs={"rows": 20, "cols": 80}),
    )

    class Meta:
        model = MaterialRevision
        fields = "__all__"

    def clean(self):
        cleaned = super().clean()
        upload = cleaned.get("payload_file")
        if upload:
            try:
                if upload.size > 192_000:
                    raise ValueError("资料文件不得超过 192 KB")
                document = json.loads(upload.read().decode("utf-8-sig"))
                if isinstance(document, dict) and "payload" in document:
                    document = document["payload"]
                cleaned["payload"] = document
            except (ValueError, UnicodeError) as error:
                self.add_error("payload_file", str(error))
        if "payload" in self.fields and cleaned.get("payload") is None:
            self.add_error("payload", "请填写资料内容或上传 JSON 文件")
        return cleaned


@admin.register(MaterialRevision)
class MaterialRevisionAdmin(admin.ModelAdmin):
    form = MaterialRevisionForm
    list_display = ["pack", "version", "title", "published_at", "available", "preview"]
    list_filter = ["pack__kind", "available"]
    search_fields = ["title", "version", "pack__dialect__name"]
    actions = ["publish", "withdraw"]
    list_select_related = ["pack", "pack__dialect"]
    fields = [
        "pack",
        "version",
        "title",
        "accent",
        "source",
        "source_url",
        "rights",
        "payload",
        "payload_file",
        "published_at",
        "available",
        "preview",
    ]

    def get_fields(self, request, obj=None):
        if obj and obj.published_at:
            return [field for field in self.fields if field != "payload_file"]
        return self.fields

    def get_readonly_fields(self, request, obj=None):
        fields = ["published_at", "available", "preview"]
        if obj:
            fields.extend(["pack", "version"])
        if obj and obj.published_at:
            fields.extend(
                ["title", "accent", "source", "source_url", "rights", "payload"]
            )
        return fields

    def has_delete_permission(self, request, obj=None):
        return False

    def has_publish_permission(self, request):
        return request.user.has_perm("localtools.publish_materialrevision")

    def changeform_view(self, request, object_id=None, form_url="", extra_context=None):
        try:
            return super().changeform_view(request, object_id, form_url, extra_context)
        except ValidationError as error:
            self.message_user(request, "；".join(error.messages), messages.ERROR)
            return redirect(request.path)

    @admin.action(description="发布或恢复选中的版本", permissions=["publish"])
    def publish(self, request, queryset):
        if queryset.count() != 1:
            self.message_user(request, "请一次选择一个要发布的版本", messages.ERROR)
            return
        try:
            queryset.get().publish()
        except ValidationError as error:
            self.message_user(request, "；".join(error.messages), messages.ERROR)
        else:
            self.message_user(request, "已发布选中的版本", messages.SUCCESS)

    @admin.action(description="下架选中的版本", permissions=["publish"])
    def withdraw(self, request, queryset):
        for revision in queryset:
            revision.withdraw()
        self.message_user(request, "已下架选中的版本", messages.SUCCESS)

    @admin.display(description="预览")
    def preview(self, obj):
        if not obj or not obj.pk:
            return "保存后可预览"
        url = reverse("admin:localtools_revision_preview", args=[obj.pk])
        return format_html('<a href="{}">预览保存的内容</a>', url)

    def get_urls(self):
        return [
            path(
                "<int:object_id>/preview/",
                self.admin_site.admin_view(self.render_preview),
                name="localtools_revision_preview",
            ),
            *super().get_urls(),
        ]

    def render_preview(self, request, object_id):
        obj = self.get_object(request, str(object_id))
        if obj is None or not self.has_view_or_change_permission(request, obj):
            raise PermissionDenied
        context = {
            **self.admin_site.each_context(request),
            "title": f"{obj.title} · 预览",
            "material": public_material(obj),
            "kind": obj.pack.kind,
        }
        return render(request, "admin/localtools/preview.html", context)
