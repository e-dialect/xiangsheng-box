from django.conf import settings
from django.core.exceptions import ValidationError
from django.db import transaction
from django.utils import timezone
from django.utils.text import Truncator

from config.product_origins import product_profile_origins
from guantou.models import Collection, Dialect, Entry, Recording
from localtools.models import MaterialPack

from .models import ProductProfile, ProductProfileRevision
from .profile_layout import (
    HOME_SECTION_LABELS,
    default_enabled_tools,
    default_home_sections,
)

GENERAL_KEY = "general"
GENERAL_PROFILE = {
    "key": GENERAL_KEY,
    "name": "乡声集盒",
    "credit": "",
    "default_dialect": "",
    "local_tools_dialect": "",
    "home_sections": default_home_sections(),
    "enabled_tools": default_enabled_tools(),
    "featured": [],
    "version": None,
}
FEATURE_MODELS = {
    "entry": (Entry, "summary", "词条"),
    "recording": (Recording, "original_gloss", "乡音"),
    "collection": (Collection, "title", "集盒"),
}
MAX_FEATURED = 12


def active_profile(key):
    return (
        ProductProfile.objects.select_related("active_revision")
        .filter(
            pk=key,
            active_revision__profile_id=key,
            active_revision__first_published_at__isnull=False,
        )
        .first()
    )


def registered_request_profile(request):
    origins = product_profile_origins(settings.BOX_PRODUCT_PROFILE_ORIGINS)
    host_origin = f"{request.scheme}://{request.get_host().lower()}"
    # A cross-origin browser supplies Origin. Same-origin GETs may omit it.
    # These are selectors for public data, never a signal of authentication.
    origin = request.headers.get("Origin", host_origin)
    key = origins.get(origin)
    return (active_profile(key) if key else None), origins


def resolve_profile_request(request):
    profile, origins = registered_request_profile(request)
    if not profile:
        return profile_payload(active_profile(GENERAL_KEY)), []

    others = {other_key for other_key in origins.values() if other_key != profile.pk}
    others = ProductProfile.objects.select_related("active_revision").filter(
        pk__in=others
    )
    names = {
        item.pk: item.active_revision.name
        for item in others
        if item.active_revision
        and item.active_revision.profile_id == item.pk
        and item.active_revision.first_published_at
    }
    switches = {}
    for target_origin, target_key in origins.items():
        if target_key in names and target_key not in switches:
            switches[target_key] = {
                "key": target_key,
                "name": names[target_key],
                "origin": target_origin,
            }
    return profile_payload(profile), list(switches.values())


def resolve_dialect_code(code):
    if not code:
        return ""
    parent_id = None
    for part in code.split("."):
        parent_id = (
            Dialect.objects.filter(parent_id=parent_id, code=part)
            .values_list("pk", flat=True)
            .first()
        )
        if parent_id is None:
            return ""
    return code


def visible_features(features):
    found = {}
    for kind, (model, title_field, label) in FEATURE_MODELS.items():
        ids = [item["id"] for item in features if item["type"] == kind]
        if not ids:
            continue
        queryset = model.objects.filter(pk__in=ids)
        if kind == "collection":
            queryset = queryset.filter(is_public=True)
        elif kind == "entry":
            queryset = queryset.filter(visibility=True).exclude(
                status=Entry.Status.REDIRECTED
            )
        else:
            queryset = queryset.filter(visibility=True).exclude(
                status=Recording.Status.REJECTED
            )
        for pk, title in queryset.values_list("pk", title_field):
            title = Truncator(" ".join(title.split())).chars(100) if title else label
            found[kind, pk] = {"type": kind, "id": pk, "title": title or label}
    return [
        found[key] for item in features if (key := (item["type"], item["id"])) in found
    ]


def revision_payload(revision):
    return {
        "key": revision.profile_id,
        "name": revision.name,
        "credit": revision.credit,
        "default_dialect": resolve_dialect_code(revision.default_dialect),
        "local_tools_dialect": resolve_dialect_code(revision.local_tools_dialect),
        "home_sections": revision.home_sections,
        "enabled_tools": revision.enabled_tools,
        "featured": visible_features(revision.featured),
        "version": revision.pk,
    }


def profile_payload(profile):
    return revision_payload(profile.active_revision) if profile else GENERAL_PROFILE


def valid_ordered_choices(value, choices):
    return (
        isinstance(value, list)
        and len(value) <= len(choices)
        and all(isinstance(item, str) and item in choices for item in value)
        and len(value) == len(set(value))
    )


def validate_profile_revision(revision):
    errors = {}
    if not valid_ordered_choices(revision.home_sections, HOME_SECTION_LABELS):
        errors["home_sections"] = "请选择已登记的栏目，每个栏目只能出现一次。"
    elif "featured" in revision.home_sections and any(
        key in revision.home_sections
        for key in ("entries", "recordings", "collections")
    ):
        errors["home_sections"] = "混合精选与按内容类别分列的精选只能选择一种。"
    if not valid_ordered_choices(revision.enabled_tools, MaterialPack.Kind.values):
        errors["enabled_tools"] = "请选择已登记的工具，每项工具只能出现一次。"
    for name in ("default_dialect", "local_tools_dialect"):
        code = getattr(revision, name)
        if code and not resolve_dialect_code(code):
            errors[name] = "找不到该方言限定码。"
    features = revision.featured
    seen = set()
    if not isinstance(features, list) or len(features) > MAX_FEATURED:
        errors["featured"] = f"精选最多 {MAX_FEATURED} 条。"
    else:
        for item in features:
            if (
                not isinstance(item, dict)
                or item.keys() != {"type", "id"}
                or not isinstance(item["type"], str)
                or item["type"] not in FEATURE_MODELS
                or type(item["id"]) is not int
                or not 0 < item["id"] <= 2**53 - 1
                or (item["type"], item["id"]) in seen
            ):
                errors["featured"] = "精选必须为不重复的词条、录音或集盒及其编号。"
                break
            seen.add((item["type"], item["id"]))
        if "featured" not in errors and len(visible_features(features)) != len(
            features
        ):
            errors["featured"] = "精选中含有不存在或当前不公开的内容。"
    if errors:
        raise ValidationError(errors)


@transaction.atomic
def publish_revision(revision):
    profile = ProductProfile.objects.select_for_update().get(pk=revision.profile_id)
    current = ProductProfileRevision.objects.select_for_update().get(
        pk=revision.pk, profile=profile
    )
    if current.pk == profile.active_revision_id:
        return False
    current.full_clean()
    if not current.first_published_at:
        current.first_published_at = timezone.now()
        current.save(update_fields=["first_published_at"])
    profile.active_revision = current
    profile.save(update_fields=["active_revision"])
    return True
