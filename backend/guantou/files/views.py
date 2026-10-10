import os

import demjson3
from django.conf import settings
from django.http import HttpResponse, JsonResponse
from django.utils import timezone
from django.views.decorators.csrf import csrf_exempt

from user.tokens import get_authorization_token, token_check
from utils.exceptions.types.bad_request import BadRequestException
from utils.exceptions.types.service_unavailable import ServiceUnavailableException

from .audio_processing import (
    AudioCapabilityUnavailable,
    AudioDecodeError,
    AudioProcessingError,
    normalize_audio_to_mp3,
)
from .storage import delete_file, random_str, upload_file

ALLOWED_AUDIO_CONTENT_TYPES = frozenset(
    {
        "audio/mpeg",
        "audio/mp3",
        "audio/wav",
        "audio/wave",
        "audio/x-wav",
        "audio/mp4",
        "audio/x-m4a",
        "audio/m4a",
        "audio/webm",
        "audio/ogg",
    }
)

ALLOWED_AUDIO_EXTENSIONS = frozenset({"mp3", "wav", "m4a", "webm", "ogg"})

GENERIC_BINARY_CONTENT_TYPES = frozenset({"", "application/octet-stream"})

MAX_AUDIO_SIZE_BYTES = 5 * 1024 * 1024  # 5 MB


def file_extension(uploaded_file, file_type):
    name = getattr(uploaded_file, "name", "")
    if "." in name:
        return name.rsplit(".", 1)[-1]
    if file_type == "image":
        return "png"
    if file_type == "video":
        return "mp4"
    return "mp3"


def validate_audio_format(uploaded_file):
    content_type = (
        str(uploaded_file.content_type or "").split(";", 1)[0].strip().lower()
    )
    ext = file_extension(uploaded_file, "audio").lower()
    if content_type not in ALLOWED_AUDIO_CONTENT_TYPES | GENERIC_BINARY_CONTENT_TYPES:
        raise BadRequestException("不支持的音频格式")
    if ext not in ALLOWED_AUDIO_EXTENSIONS:
        raise BadRequestException("不支持的音频格式")
    if uploaded_file.size > MAX_AUDIO_SIZE_BYTES:
        raise BadRequestException("音频文件大小不能超过 5 MB")


def is_audio_upload(uploaded_file, file_type):
    ext = file_extension(uploaded_file, file_type).lower()
    return file_type == "audio" or ext in ALLOWED_AUDIO_EXTENSIONS


@csrf_exempt
def files(request):
    user = token_check(get_authorization_token(request))
    if not user:
        return JsonResponse({}, status=401)
    if request.method == "POST":
        uploaded_file = request.FILES.get("file")
        if not uploaded_file:
            return JsonResponse({"msg": "缺少文件"}, status=400)
        file_type = str(uploaded_file.content_type or "application/octet-stream").split(
            "/"
        )[0]
        audio_upload = is_audio_upload(uploaded_file, file_type)
        suffix = file_extension(uploaded_file, file_type).lower()
        if audio_upload:
            validate_audio_format(uploaded_file)
            file_type = "audio"
            # All accepted formats are normalized to MP3 before storage.
            suffix = "mp3"
        filename = f"{timezone.now().strftime('%Y_%m_%d')}_{random_str(15)}.{suffix}"
        folder = os.path.join(settings.MEDIA_ROOT, file_type, str(user.id))
        os.makedirs(folder, exist_ok=True)
        path = os.path.join(folder, filename)
        duration_ms = 0
        if not audio_upload:
            with open(path, "wb") as f:
                for chunk in uploaded_file.chunks():
                    f.write(chunk)
        else:
            try:
                duration_ms = normalize_audio_to_mp3(uploaded_file, path)
            except AudioDecodeError as exc:
                raise BadRequestException("无法解析音频文件") from exc
            except AudioCapabilityUnavailable as exc:
                raise ServiceUnavailableException(str(exc)) from exc
            except AudioProcessingError as exc:
                raise ServiceUnavailableException("音频处理服务暂不可用") from exc
        key = (
            f"files/{file_type}/{user.id}/"
            + timezone.now().strftime("%Y/%m/%d/")
            + filename.split("_")[-1]
        )
        response_data = {"url": upload_file(path, key)}
        if audio_upload:
            response_data["duration_ms"] = duration_ms
        return JsonResponse(response_data, status=200)
    if request.method == "DELETE":
        body = demjson3.decode(request.body)
        suffix = body["url"].split("/", 4)[-1]
        file_type = suffix.split("/", 2)[0]
        user_id = suffix.split("/", 2)[1]
        if user.id != int(user_id) and not user.is_superuser:
            return JsonResponse({}, status=401)
        filename = "_".join(suffix.split("/", 2)[2].split("/"))
        path = os.path.join(settings.MEDIA_ROOT, file_type, user_id, filename)
        if not os.path.exists(path):
            return JsonResponse({}, status=404)
        os.remove(path)
        delete_file(body["url"].split("/", 3)[-1])
        return JsonResponse({}, status=200)
    return JsonResponse({}, status=405)


FILE_CONTENT_TYPES = {
    "png": "image/png",
    "jpg": "image/jpeg",
    "jpeg": "image/jpeg",
    "gif": "image/gif",
    "webp": "image/webp",
    "mp3": "audio/mpeg",
}


@csrf_exempt
def open_file_url(request, type, id, Y, M, D, X):
    filename = f"{Y}_{M}_{D}_{X}"
    path = os.path.join(settings.MEDIA_ROOT, type, id, filename)
    if not os.path.exists(path):
        return JsonResponse({}, status=404)
    ext = X.rsplit(".", 1)[-1].lower() if "." in X else ""
    content_type = FILE_CONTENT_TYPES.get(ext, "application/octet-stream")
    with open(path.encode("utf-8"), "rb") as f:
        response = HttpResponse(f.read(), content_type=content_type)
        if not content_type.startswith("image/"):
            response["Content-Disposition"] = f"attachment; filename={X}"
        return response
