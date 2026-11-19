import json

from django import forms
from django.contrib import admin, messages
from django.core.exceptions import PermissionDenied, ValidationError
from django.db import transaction
from django.shortcuts import redirect, render
from django.urls import path, reverse
from django.utils.html import format_html

from guantou.models import Dialect

from .models import MaterialPack, MaterialRevision, RegionalMaintainer
from .public import public_material


@admin.register(RegionalMaintainer)
class RegionalMaintainerAdmin(admin.ModelAdmin):
    list_display = ["user", "dialect_code"]
    list_select_related = ["user", "dialect", "dialect__parent"]
    # Revoke individual assignments from their detail page.
    actions = None
    autocomplete_fields = ["user", "dialect"]
    search_fields = ["user__username", "dialect__name", "dialect__code"]

    @admin.display(description="负责的方言点（仅本级）")
    def dialect_code(self, grant):
        return grant.dialect.qualified_code

    def get_queryset(self, request):
        queryset = super().get_queryset(request)
        return (
            queryset
            if request.user.is_superuser
            else queryset.filter(user_id=request.user.pk)
        )

    def has_module_permission(self, request):
        return self.has_view_permission(request)

    def has_view_permission(self, request, obj=None):
        if request.user.is_superuser:
            return True
        if obj:
            return obj.user_id == request.user.pk
        return self.get_queryset(request).exists()

    def has_add_permission(self, request):
        return request.user.is_superuser

    def has_change_permission(self, request, obj=None):
        return request.user.is_superuser

    def has_delete_permission(self, request, obj=None):
        return request.user.is_superuser


class RegionalMaterialAdmin(admin.ModelAdmin):
    # Existing model permissions grant the named operation across all regions.
    # A regional assignment independently grants it for the exact Dialect PK.
    def globally_allowed(self, request, action):
        permission = f"localtools.{action}_{self.model._meta.model_name}"
        if action == "view":
            return super().has_view_permission(request)
        return request.user.has_perm(permission)

    def assigned_regions(self, request):
        return RegionalMaintainer.objects.filter(user_id=request.user.pk).values(
            "dialect_id"
        )

    def restrict_regions(self, request, queryset, action, dialect_field):
        if self.globally_allowed(request, action):
            return queryset
        return queryset.filter(
            **{f"{dialect_field}__in": self.assigned_regions(request)}
        )

    def allowed(self, request, action, dialect_id=None):
        if self.globally_allowed(request, action):
            return True
        regions = self.assigned_regions(request)
        if dialect_id is not None:
            regions = regions.filter(dialect_id=dialect_id)
        return regions.exists()

    def get_queryset(self, request):
        return self.restrict_regions(
            request, super().get_queryset(request), "view", self.dialect_field
        )

    def has_module_permission(self, request):
        return (
            super().has_module_permission(request)
            or self.assigned_regions(request).exists()
        )

    def has_view_permission(self, request, obj=None):
        if self.globally_allowed(request, "view"):
            return True
        if obj:
            return self.get_queryset(request).filter(pk=obj.pk).exists()
        return self.assigned_regions(request).exists()

    def has_add_permission(self, request):
        return self.allowed(request, "add")


@admin.register(MaterialPack)
class MaterialPackAdmin(RegionalMaterialAdmin):
    list_display = ["dialect", "kind", "active_revision"]
    list_filter = ["kind"]
    autocomplete_fields = ["dialect"]

    dialect_field = "dialect_id"

    def get_autocomplete_fields(self, request):
        # Scoped editors choose directly from their assigned dialects.
        return self.autocomplete_fields if self.globally_allowed(request, "add") else ()

    def formfield_for_foreignkey(self, db_field, request, **kwargs):
        if db_field.name == "dialect":
            kwargs["queryset"] = self.restrict_regions(
                request, Dialect.objects.all(), "add", "pk"
            )
        return super().formfield_for_foreignkey(db_field, request, **kwargs)

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
class MaterialRevisionAdmin(RegionalMaterialAdmin):
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

    dialect_field = "pack__dialect_id"

    def formfield_for_foreignkey(self, db_field, request, **kwargs):
        if db_field.name == "pack":
            kwargs["queryset"] = self.restrict_regions(
                request, MaterialPack.objects.all(), "add", "dialect_id"
            )
        return super().formfield_for_foreignkey(db_field, request, **kwargs)

    def has_change_permission(self, request, obj=None):
        if obj and obj.published_at:
            return False
        return self.allowed(request, "change", obj.pack.dialect_id if obj else None)

    def get_fields(self, request, obj=None):
        if obj and not self.has_change_permission(request, obj):
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
        return self.allowed(request, "publish")

    def changeform_view(self, request, object_id=None, form_url="", extra_context=None):
        try:
            return super().changeform_view(request, object_id, form_url, extra_context)
        except ValidationError as error:
            self.message_user(request, "；".join(error.messages), messages.ERROR)
            return redirect(request.path)

    @transaction.atomic
    def publish(self, request, queryset):
        if queryset.count() != 1:
            self.message_user(request, "请一次选择一个要发布的版本", messages.ERROR)
            return
        try:
            revision = queryset.get()
            if not self.allowed(request, "publish", revision.pack.dialect_id):
                raise PermissionDenied
            restoring = revision.published_at is not None
            revision.publish()
            self.log_change(
                request, revision, "恢复资料版本" if restoring else "发布资料版本"
            )
        except ValidationError as error:
            self.message_user(request, "；".join(error.messages), messages.ERROR)
        else:
            self.message_user(request, "已发布选中的版本", messages.SUCCESS)

    # SimpleUI serializes action metadata as JSON. Use Django's changelist
    # default rather than adding a non-serializable ActionLocation enum.
    publish.short_description = "发布或恢复选中的版本"
    publish.allowed_permissions = ["publish"]

    @transaction.atomic
    def withdraw(self, request, queryset):
        revisions = list(queryset.select_related("pack"))
        if not self.globally_allowed(request, "publish"):
            allowed = set(
                self.assigned_regions(request).values_list("dialect_id", flat=True)
            )
            if any(revision.pack.dialect_id not in allowed for revision in revisions):
                raise PermissionDenied
        for revision in revisions:
            revision.withdraw()
            self.log_change(request, revision, "下架资料版本")
        self.message_user(request, "已下架选中的版本", messages.SUCCESS)

    withdraw.short_description = "下架选中的版本"
    withdraw.allowed_permissions = ["publish"]

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
