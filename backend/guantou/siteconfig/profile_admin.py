from django import forms
from django.contrib import admin, messages
from django.core.exceptions import PermissionDenied, ValidationError
from django.db import transaction
from django.http import HttpResponseForbidden, HttpResponseNotFound
from django.shortcuts import redirect
from django.template.response import TemplateResponse
from django.urls import path, reverse
from django.views.decorators.http import require_http_methods

from localtools.models import MaterialPack

from .models import ProductProfile, ProductProfileRevision
from .product_profiles import MAX_FEATURED, publish_revision, revision_payload
from .profile_layout import HOME_SECTION_LABELS

FEATURE_LABELS = {"词条": "entry", "录音": "recording", "集盒": "collection"}
SECTION_BY_LABEL = {label: key for key, label in HOME_SECTION_LABELS.items()}


class ProductProfileRevisionForm(forms.ModelForm):
    home_sections = forms.CharField(
        label="首页栏目",
        required=False,
        widget=forms.Textarea(attrs={"rows": 5}),
        help_text="每行填写一个栏目名称，按行序展示。可选："
        + "、".join(SECTION_BY_LABEL)
        + "。留空时隐藏可选栏目。",
    )
    enabled_tools = forms.MultipleChoiceField(
        label="启用工具",
        required=False,
        choices=MaterialPack.Kind.choices,
        widget=forms.CheckboxSelectMultiple,
        help_text="供本站入口、地方工具页和词条快捷链接使用。",
    )
    featured = forms.CharField(
        label="精选",
        required=False,
        widget=forms.Textarea(attrs={"rows": 6}),
        help_text=f"每行填类型和公开页面链接中的编号，如「词条 123」「录音 45」「集盒 6」。"
        f"展示顺序与行序一致，最多 {MAX_FEATURED} 条。",
    )

    class Meta:
        model = ProductProfileRevision
        fields = (
            "profile",
            "name",
            "credit",
            "default_dialect",
            "local_tools_dialect",
            "home_sections",
            "enabled_tools",
            "featured",
        )

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        if "home_sections" in self.fields:
            self.initial["home_sections"] = "\n".join(
                HOME_SECTION_LABELS[item] for item in self.instance.home_sections
            )
        if "featured" in self.fields:
            labels = {value: label for label, value in FEATURE_LABELS.items()}
            self.initial["featured"] = "\n".join(
                f"{labels[item['type']]} {item['id']}"
                for item in self.instance.featured
            )

    def clean_home_sections(self):
        lines = [
            line.strip()
            for line in self.cleaned_data["home_sections"].splitlines()
            if line.strip()
        ]
        if any(label not in SECTION_BY_LABEL for label in lines):
            raise ValidationError("请使用表单提示中的栏目名称。")
        return [SECTION_BY_LABEL[label] for label in lines]

    def clean_featured(self):
        features = []
        lines = [
            line.strip()
            for line in self.cleaned_data["featured"].splitlines()
            if line.strip()
        ]
        if len(lines) > MAX_FEATURED:
            raise ValidationError(f"精选最多 {MAX_FEATURED} 条。")
        for line in lines:
            parts = line.split()
            if (
                len(parts) != 2
                or parts[0] not in FEATURE_LABELS
                or not parts[1].isascii()
                or not parts[1].isdigit()
                or len(parts[1]) > 16
            ):
                raise ValidationError("请按「类型 编号」逐行填写精选。")
            features.append({"type": FEATURE_LABELS[parts[0]], "id": int(parts[1])})
        return features


@admin.register(ProductProfile)
class ProductProfileAdmin(admin.ModelAdmin):
    list_display = ("key", "active_revision")
    filter_horizontal = ("editors",)

    def get_readonly_fields(self, request, obj=None):
        return ("active_revision", "key") if obj else ("active_revision",)

    def has_module_permission(self, request):
        return request.user.is_superuser

    def has_view_permission(self, request, obj=None):
        return request.user.is_superuser

    def has_add_permission(self, request):
        return request.user.is_superuser

    def has_change_permission(self, request, obj=None):
        return request.user.is_superuser

    def has_delete_permission(self, request, obj=None):
        return False


@admin.register(ProductProfileRevision)
class ProductProfileRevisionAdmin(admin.ModelAdmin):
    form = ProductProfileRevisionForm
    list_display = ("id", "profile", "name", "state", "created_at", "preview_link")
    readonly_fields = ("preview_link",)
    change_form_template = "siteconfig/revision_form.html"

    def profiles_for_user(self, request):
        profiles = ProductProfile.objects.all()
        return (
            profiles
            if request.user.is_superuser
            else profiles.filter(editors=request.user)
        )

    def get_queryset(self, request):
        return (
            super()
            .get_queryset(request)
            .select_related("profile")
            .filter(profile__in=self.profiles_for_user(request))
        )

    def formfield_for_foreignkey(self, db_field, request, **kwargs):
        if db_field.name == "profile":
            kwargs["queryset"] = self.profiles_for_user(request)
        return super().formfield_for_foreignkey(db_field, request, **kwargs)

    def has_add_permission(self, request):
        return (
            super().has_add_permission(request)
            and self.profiles_for_user(request).exists()
        )

    def has_change_permission(self, request, obj=None):
        if obj and (
            obj.first_published_at
            or not self.profiles_for_user(request).filter(pk=obj.profile_id).exists()
        ):
            return False
        return super().has_change_permission(request, obj)

    def has_delete_permission(self, request, obj=None):
        return False

    def get_readonly_fields(self, request, obj=None):
        return ("profile", "preview_link") if obj else ()

    def changeform_view(self, request, object_id=None, form_url="", extra_context=None):
        try:
            return super().changeform_view(request, object_id, form_url, extra_context)
        except PermissionDenied:
            return HttpResponseForbidden()

    def save_model(self, request, obj, form, change):
        if change:
            # Django admin change views already wrap saves in a transaction.
            ProductProfile.objects.select_for_update().get(pk=obj.profile_id)
            if ProductProfileRevision.objects.filter(
                pk=obj.pk, first_published_at__isnull=False
            ).exists():
                raise PermissionDenied("该版本已发布。请复制为新草稿。")
        super().save_model(request, obj, form, change)

    @admin.display(description="发布状态")
    def state(self, obj):
        if obj.pk == obj.profile.active_revision_id:
            return "线上"
        return "历史" if obj.first_published_at else "草稿"

    @admin.display(description="预览和发布")
    def preview_link(self, obj):
        from django.utils.html import format_html

        if not obj.pk:
            return ""
        url = reverse("admin:siteconfig_revision_preview", args=[obj.pk])
        return format_html('<a href="{}">预览和发布</a>', url)

    def get_urls(self):
        return [
            path(
                "<int:revision_id>/preview/",
                self.admin_site.admin_view(
                    require_http_methods(["GET", "POST"])(self.preview)
                ),
                name="siteconfig_revision_preview",
            )
        ] + super().get_urls()

    def preview(self, request, revision_id):
        revision = self.get_queryset(request).filter(pk=revision_id).first()
        if not revision:
            return HttpResponseNotFound()
        if not self.has_view_permission(request, revision):
            return HttpResponseForbidden()
        can_publish = request.user.has_perm("siteconfig.change_productprofilerevision")
        can_copy = self.has_add_permission(request)
        if request.method == "POST":
            action = request.POST.get("action")
            if action == "copy" and can_copy:
                draft = ProductProfileRevision.objects.create(
                    profile=revision.profile,
                    name=revision.name,
                    credit=revision.credit,
                    default_dialect=revision.default_dialect,
                    local_tools_dialect=revision.local_tools_dialect,
                    home_sections=revision.home_sections,
                    enabled_tools=revision.enabled_tools,
                    featured=revision.featured,
                )
                self.log_addition(request, draft, f"从版本 {revision.pk} 复制")
                return redirect(
                    "admin:siteconfig_productprofilerevision_change", draft.pk
                )
            if action != "publish" or not can_publish:
                return HttpResponseForbidden()
            try:
                restoring = bool(revision.first_published_at)
                with transaction.atomic():
                    changed = publish_revision(revision)
                    if changed:
                        label = "恢复" if restoring else "发布"
                        self.log_change(
                            request, revision, f"{label}线上版本 {revision.pk}"
                        )
                self.message_user(
                    request,
                    (
                        f"已{label}版本 {revision.pk}。"
                        if changed
                        else "该版本已经在线上。"
                    ),
                )
            except ValidationError as error:
                self.message_user(
                    request, "；".join(error.messages), level=messages.ERROR
                )
            return redirect("admin:siteconfig_revision_preview", revision.pk)
        profile = revision_payload(revision)
        return TemplateResponse(
            request,
            "siteconfig/revision_preview.html",
            {
                **self.admin_site.each_context(request),
                "opts": self.model._meta,
                "title": f"预览 {revision}",
                "revision": revision,
                "profile": profile,
                "home_section_labels": [
                    HOME_SECTION_LABELS[key] for key in profile["home_sections"]
                ],
                "enabled_tool_labels": [
                    label
                    for key, label in MaterialPack.Kind.choices
                    if key in profile["enabled_tools"]
                ],
                "status": self.state(revision),
                "can_publish": can_publish
                and revision.pk != revision.profile.active_revision_id,
                "can_copy": can_copy,
            },
        )
