import demjson3
from django.http import JsonResponse
from django.views.decorators.cache import never_cache
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_safe
from django.views.decorators.vary import vary_on_headers

from announcements.dto.announcement import announcement_normal
from announcements.models import Announcement
from user.dto.user_simple import user_simple
from user.tokens import get_authorization_token, token_check
from utils.collections import order_by_id_list

from .models import SiteSettings
from .capabilities import resolved_remote_capabilities
from .product_profiles import (
    GENERAL_KEY,
    active_profile,
    profile_payload,
    resolve_profile_request,
)


def announcement_payload(announcement):
    return {
        "announcement": announcement_normal(announcement),
        "author": user_simple(announcement.author),
    }


def ordered_visible_announcements(ids):
    result = Announcement.objects.filter(id__in=ids, visibility=True)
    return order_by_id_list(result, ids)


def admin_user_from_request(request):
    return token_check(get_authorization_token(request), -1)


def validated_announcement_ids(value):
    if not isinstance(value, list):
        return None
    try:
        ids = [int(item) for item in value]
    except (TypeError, ValueError):
        return None
    if any(item <= 0 for item in ids) or len(ids) != len(set(ids)):
        return None
    visible_ids = set(
        Announcement.objects.filter(id__in=ids, visibility=True).values_list(
            "id", flat=True
        )
    )
    return ids if visible_ids == set(ids) else None


@csrf_exempt
def announcements(request):
    item = SiteSettings.get_solo()
    if request.method == "GET":
        return JsonResponse(
            {
                "announcements": [
                    announcement_payload(announcement)
                    for announcement in ordered_visible_announcements(
                        item.announcements
                    )
                ]
            },
            status=200,
        )
    if request.method == "PUT":
        if not admin_user_from_request(request):
            return JsonResponse({}, status=401)
        body = demjson3.decode(request.body)
        ids = validated_announcement_ids(body.get("announcements"))
        if ids is not None:
            item.announcements = ids
            item.save(update_fields=["announcements"])
            return JsonResponse({}, status=200)
        return JsonResponse({}, status=400)
    return JsonResponse({}, status=405)


@csrf_exempt
def featured_announcements(request):
    item = SiteSettings.get_solo()
    if request.method == "GET":
        return JsonResponse(
            {
                "featured_announcements": [
                    announcement_payload(announcement)
                    for announcement in ordered_visible_announcements(
                        item.featured_announcements
                    )
                ]
            },
            status=200,
        )
    if request.method == "PUT":
        if not admin_user_from_request(request):
            return JsonResponse({}, status=401)
        body = demjson3.decode(request.body)
        ids = validated_announcement_ids(body.get("featured_announcements"))
        if ids is not None:
            item.featured_announcements = ids
            item.save(update_fields=["featured_announcements"])
            return JsonResponse({}, status=200)
        return JsonResponse({}, status=400)
    return JsonResponse({}, status=405)


@csrf_exempt
def carousel(request):
    item = SiteSettings.get_solo()
    if request.method == "GET":
        return JsonResponse({"carousel": item.carousel}, status=200)
    if request.method == "PUT":
        if not admin_user_from_request(request):
            return JsonResponse({}, status=401)
        body = demjson3.decode(request.body)
        if isinstance(body.get("carousel"), list):
            item.carousel = body["carousel"]
            item.save(update_fields=["carousel"])
            return JsonResponse({}, status=200)
        return JsonResponse({}, status=400)
    return JsonResponse({}, status=405)


def capabilities(request):
    if request.method != "GET":
        return JsonResponse({}, status=405)
    item = SiteSettings.get_solo()
    return JsonResponse(
        {
            "version": 1,
            "capabilities": resolved_remote_capabilities(item.remote_capabilities),
            "updated_at": item.updated_at.isoformat(),
            "cache_seconds": 300,
        },
        status=200,
    )


@require_safe
@never_cache
@vary_on_headers("Origin")
def product_profile(request):
    profile, targets = resolve_profile_request(request)
    return JsonResponse({"profile": profile, "switch_targets": targets})


@require_safe
@never_cache
def client_product_profile(request, key):
    """A compiled client may request a registered profile by key."""
    profile = active_profile(key) or active_profile(GENERAL_KEY)
    return JsonResponse({"profile": profile_payload(profile), "switch_targets": []})
