"""Private until approved. Playback always checks the current access decision."""

from uuid import UUID

from django.conf import settings
from django.http import HttpResponse, Http404
from django.urls import reverse
from django.views.decorators.cache import never_cache
from django.views.decorators.vary import vary_on_headers
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny
from rest_framework.exceptions import ValidationError

from guantou.models import Recording, RecordingMedia
from guantou.v2_permissions import can_curate_recording


def media_url(asset_id):
    base = settings.PUBLIC_BACKEND_URL.rstrip("/")
    return base + reverse("recording-media", args=[asset_id])


def submission_asset(url, owner):
    try:
        if not isinstance(url, str):
            raise ValueError
        asset_id = UUID(url.rstrip("/").rsplit("/", 1)[-1])
        if url == media_url(asset_id):
            asset = (
                RecordingMedia.objects.select_for_update()
                .defer("content")
                .get(
                    id=asset_id,
                    owner=owner,
                )
            )
            if not Recording.objects.filter(media_id=asset_id).exists():
                return asset
    except (ValueError, RecordingMedia.DoesNotExist):
        pass
    raise ValidationError({"audio_url": "请选择本人新上传、尚未投稿的录音"})


@never_cache
@vary_on_headers("Authorization")
@api_view(["GET", "HEAD"])
@permission_classes([AllowAny])
def recording_media(request, asset_id):
    asset = RecordingMedia.objects.defer("content").filter(id=asset_id).first()
    if asset is None:
        raise Http404
    recording = (
        Recording.objects.filter(media_id=asset_id)
        .select_related("usage_dialect")
        .first()
    )
    if recording is None:
        allowed = request.user.is_authenticated and asset.owner_id == request.user.id
    else:
        allowed = recording.visibility or can_curate_recording(request.user, recording)
    if not allowed:
        raise Http404
    response = HttpResponse(asset.content, content_type="audio/mpeg")
    response["X-Content-Type-Options"] = "nosniff"
    return response
