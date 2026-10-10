import shutil
import tempfile
from io import StringIO
from unittest.mock import MagicMock, patch

from django.contrib.auth.models import User
from django.core.files.uploadedfile import SimpleUploadedFile
from django.core.management import call_command
from django.core.management.base import CommandError
from django.test import Client, SimpleTestCase, TestCase, override_settings

from files.audio_processing import (
    AudioCapabilityUnavailable,
    AudioDecodeError,
    missing_audio_binaries,
    normalize_audio_to_mp3,
    probe_audio_capability,
)

from user.tokens import generate_token


def bearer(user):
    return f"Bearer {generate_token(user)}"


class FileApiTests(TestCase):
    def setUp(self):
        self.media_root = tempfile.mkdtemp()
        self.override = override_settings(MEDIA_ROOT=self.media_root)
        self.override.enable()
        self.user = User.objects.create_user(username="collector", password="pw")
        self.client = Client()

    def tearDown(self):
        self.override.disable()
        shutil.rmtree(self.media_root, ignore_errors=True)

    def _auth_headers(self):
        return {"HTTP_AUTHORIZATION": bearer(self.user)}

    @patch("files.views.upload_file")
    def test_upload_requires_auth_and_returns_url(self, upload_file):
        upload_file.return_value = "https://cos.test.edialect.top/files/image/1/x.png"
        file = SimpleUploadedFile("cover.png", b"image", content_type="image/png")
        response = self.client.post("/files", {"file": file})
        self.assertEqual(response.status_code, 401)
        response = self.client.post(
            "/files",
            {"file": file},
            **self._auth_headers(),
        )
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["url"], upload_file.return_value)

    @patch("files.views.upload_file")
    def test_upload_rejects_legacy_token_header(self, upload_file):
        upload_file.return_value = "https://cos.test.edialect.top/files/image/1/x.png"
        file = SimpleUploadedFile("cover.png", b"image", content_type="image/png")

        response = self.client.post(
            "/files",
            {"file": file},
            HTTP_TOKEN=generate_token(self.user),
        )

        self.assertEqual(response.status_code, 401)

    # --- Audio validation tests ---

    def test_reject_non_whitelist_content_type(self):
        file = SimpleUploadedFile("song.flac", b"fake-audio", content_type="audio/flac")
        response = self.client.post("/files", {"file": file}, **self._auth_headers())
        self.assertEqual(response.status_code, 400)

    def test_reject_non_whitelist_extension(self):
        file = SimpleUploadedFile("song.exe", b"fake-audio", content_type="audio/mpeg")
        response = self.client.post("/files", {"file": file}, **self._auth_headers())
        self.assertEqual(response.status_code, 400)

    @patch("files.views.upload_file")
    @patch("files.views.normalize_audio_to_mp3", return_value=5000)
    def test_browser_recording_formats_are_normalized(
        self, normalize_audio, upload_file
    ):
        upload_file.return_value = "https://example.test/voice.mp3"
        for name, mime in (
            ("voice.webm", "audio/webm;codecs=opus"),
            ("blob", "audio/webm"),
            ("voice.ogg", "audio/ogg;codecs=opus"),
        ):
            with self.subTest(name=name, mime=mime):
                file = SimpleUploadedFile(name, b"browser-audio", content_type=mime)
                response = self.client.post(
                    "/files", {"file": file}, **self._auth_headers()
                )
                self.assertEqual(response.status_code, 200)
                self.assertEqual(response.json()["duration_ms"], 5000)
        self.assertEqual(normalize_audio.call_count, 3)

    @patch(
        "files.views.normalize_audio_to_mp3", side_effect=AudioDecodeError("invalid")
    )
    def test_browser_recording_still_requires_decodable_audio(self, normalize_audio):
        file = SimpleUploadedFile("voice.webm", b"not-audio", content_type="audio/webm")
        response = self.client.post("/files", {"file": file}, **self._auth_headers())
        self.assertEqual(response.status_code, 400)
        self.assertEqual(response.json()["message"], "无法解析音频文件")
        normalize_audio.assert_called_once()

    def test_reject_oversized_audio(self):
        big_data = b"x" * (5 * 1024 * 1024 + 1)  # just over 5 MB
        file = SimpleUploadedFile("big.mp3", big_data, content_type="audio/mpeg")
        response = self.client.post("/files", {"file": file}, **self._auth_headers())
        self.assertEqual(response.status_code, 400)

    @patch(
        "files.views.normalize_audio_to_mp3",
        side_effect=AudioDecodeError("invalid"),
    )
    def test_reject_undecodable_audio_with_validation_error(self, normalize_audio):
        file = SimpleUploadedFile("fake.mp3", b"not-audio", content_type="audio/mpeg")
        response = self.client.post("/files", {"file": file}, **self._auth_headers())

        self.assertEqual(response.status_code, 400)
        self.assertEqual(response.json()["message"], "无法解析音频文件")
        normalize_audio.assert_called_once()

    @patch("files.views.upload_file")
    @patch(
        "files.views.normalize_audio_to_mp3",
        side_effect=AudioCapabilityUnavailable(("ffmpeg", "ffprobe")),
    )
    def test_audio_upload_reports_missing_server_capability(
        self, normalize_audio, upload_file
    ):
        file = SimpleUploadedFile("voice.mp3", b"fake-audio", content_type="audio/mpeg")

        response = self.client.post("/files", {"file": file}, **self._auth_headers())

        self.assertEqual(response.status_code, 503)
        payload = response.json()
        self.assertEqual(
            payload["message"],
            "音频处理服务暂不可用（缺少 ffmpeg、ffprobe）",
        )
        self.assertEqual(payload["code"], 503)
        self.assertEqual(payload["data"], {})
        self.assertTrue(payload["request_id"])
        normalize_audio.assert_called_once()
        upload_file.assert_not_called()

    @patch("files.views.upload_file")
    @patch("files.views.normalize_audio_to_mp3", return_value=1250)
    def test_generic_mime_mp3_is_still_validated_as_audio(
        self, normalize_audio, upload_file
    ):
        upload_file.return_value = "https://cos.example.com/x.mp3"

        file = SimpleUploadedFile(
            "voice.mp3", b"fake-audio", content_type="application/octet-stream"
        )
        response = self.client.post("/files", {"file": file}, **self._auth_headers())

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["duration_ms"], 1250)
        normalize_audio.assert_called_once()

    def test_reject_audio_extension_with_disguised_image_mime(self):
        file = SimpleUploadedFile("voice.mp3", b"fake-audio", content_type="image/png")
        response = self.client.post("/files", {"file": file}, **self._auth_headers())
        self.assertEqual(response.status_code, 400)

    def test_image_upload_not_subject_to_audio_validation(self):
        file = SimpleUploadedFile("photo.png", b"image-data", content_type="image/png")
        with patch("files.views.upload_file") as upload_file:
            upload_file.return_value = "https://cos.example.com/x.png"
            response = self.client.post(
                "/files", {"file": file}, **self._auth_headers()
            )
        self.assertEqual(response.status_code, 200)

    @patch("files.views.upload_file")
    @patch("files.views.normalize_audio_to_mp3", return_value=3456)
    def test_audio_upload_returns_duration_ms(self, normalize_audio, upload_file):
        upload_file.return_value = "https://cos.example.com/x.mp3"

        file = SimpleUploadedFile("voice.mp3", b"fake-audio", content_type="audio/mpeg")
        response = self.client.post("/files", {"file": file}, **self._auth_headers())
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertEqual(data["url"], upload_file.return_value)
        self.assertEqual(data["duration_ms"], 3456)
        normalize_audio.assert_called_once()

    @patch("files.views.upload_file")
    @patch("files.views.normalize_audio_to_mp3", return_value=1000)
    def test_audio_upload_accepts_wav(self, normalize_audio, upload_file):
        upload_file.return_value = "https://cos.example.com/x.mp3"

        file = SimpleUploadedFile("voice.wav", b"fake-audio", content_type="audio/wav")
        response = self.client.post("/files", {"file": file}, **self._auth_headers())
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["duration_ms"], 1000)
        normalize_audio.assert_called_once()

    @patch("files.views.upload_file")
    @patch("files.views.normalize_audio_to_mp3", return_value=2500)
    def test_audio_upload_accepts_m4a(self, normalize_audio, upload_file):
        upload_file.return_value = "https://cos.example.com/x.mp3"

        file = SimpleUploadedFile("voice.m4a", b"fake-audio", content_type="audio/mp4")
        response = self.client.post("/files", {"file": file}, **self._auth_headers())
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["duration_ms"], 2500)
        normalize_audio.assert_called_once()


class AudioProcessingTests(SimpleTestCase):
    @patch("files.audio_processing.shutil.which")
    def test_probe_reports_each_required_binary(self, which):
        which.side_effect = lambda name: "/usr/bin/ffmpeg" if name == "ffmpeg" else None

        capability = probe_audio_capability()

        self.assertEqual(
            capability,
            {"ffmpeg": "/usr/bin/ffmpeg", "ffprobe": None},
        )
        self.assertEqual(missing_audio_binaries(capability), ("ffprobe",))

    @patch("files.audio_processing._pydub_api")
    @patch(
        "files.audio_processing.require_audio_capability",
        side_effect=AudioCapabilityUnavailable(("ffmpeg",)),
    )
    def test_normalizer_checks_tools_before_importing_pydub(
        self, require_capability, pydub_api
    ):
        with self.assertRaises(AudioCapabilityUnavailable):
            normalize_audio_to_mp3(MagicMock(), "/tmp/voice.mp3")

        require_capability.assert_called_once()
        pydub_api.assert_not_called()

    @patch("files.audio_processing._pydub_api")
    @patch("files.audio_processing.require_audio_capability")
    def test_normalizer_preserves_duration_and_mp3_contract(
        self, require_capability, pydub_api
    ):
        class FakeDecodeError(Exception):
            pass

        class FakeEncodeError(Exception):
            pass

        audio_api = MagicMock()
        segment = MagicMock(duration_seconds=3.456)
        segment.set_frame_rate.return_value = segment
        audio_api.from_file.return_value = segment
        pydub_api.return_value = (audio_api, FakeDecodeError, FakeEncodeError)
        uploaded_file = MagicMock()

        duration_ms = normalize_audio_to_mp3(uploaded_file, "/tmp/voice.mp3")

        self.assertEqual(duration_ms, 3456)
        require_capability.assert_called_once()
        audio_api.from_file.assert_called_once_with(uploaded_file)
        segment.set_frame_rate.assert_called_once_with(44100)
        segment.export.assert_called_once_with("/tmp/voice.mp3", format="mp3")


class AudioProbeCommandTests(SimpleTestCase):
    @patch("files.management.commands.probe_audio.probe_audio_capability")
    def test_probe_command_reports_available_paths(self, probe):
        probe.return_value = {
            "ffmpeg": "/usr/bin/ffmpeg",
            "ffprobe": "/usr/bin/ffprobe",
        }
        output = StringIO()

        call_command("probe_audio", stdout=output)

        self.assertIn("ffmpeg=/usr/bin/ffmpeg", output.getvalue())
        self.assertIn("ffprobe=/usr/bin/ffprobe", output.getvalue())

    @patch("files.management.commands.probe_audio.probe_audio_capability")
    def test_probe_command_fails_with_missing_binary_names(self, probe):
        probe.return_value = {"ffmpeg": None, "ffprobe": None}

        with self.assertRaisesMessage(CommandError, "ffmpeg、ffprobe"):
            call_command("probe_audio")


class LocalFileStorageTests(TestCase):
    def setUp(self):
        self.media_root = tempfile.mkdtemp()
        self.override = override_settings(
            MEDIA_ROOT=self.media_root,
            COS_REGION="DEFAULT_COS_REGION",
            COS_SECRET_ID="DEFAULT_COS_SECRET_ID",
            COS_SECRET_KEY="DEFAULT_COS_SECRET_KEY",
            COS_BUCKET="DEFAULT_COS_BUCKET",
            PUBLIC_BACKEND_URL="http://localhost:8000",
        )
        self.override.enable()
        self.user = User.objects.create_user(username="collector", password="pw")
        self.client = Client()

    def tearDown(self):
        self.override.disable()
        shutil.rmtree(self.media_root, ignore_errors=True)

    def _auth_headers(self):
        return {"HTTP_AUTHORIZATION": bearer(self.user)}

    def test_upload_falls_back_to_local_url_without_cos(self):
        file = SimpleUploadedFile("photo.png", b"image-data", content_type="image/png")
        with patch("files.storage.cos_client") as cos_client:
            response = self.client.post(
                "/files",
                {"file": file},
                **self._auth_headers(),
            )
        self.assertEqual(response.status_code, 200)
        url = response.json()["url"]
        self.assertTrue(url.startswith("http://localhost:8000/files/image/"))
        cos_client.assert_not_called()

        rel = url.split("http://localhost:8000/", 1)[-1]
        parts = rel.split("/")
        self.assertEqual(parts[0], "files")
        served = self.client.get("/" + rel)
        self.assertEqual(served.status_code, 200)
        self.assertEqual(served.content, b"image-data")
        self.assertEqual(served["Content-Type"], "image/png")
        self.assertNotIn("Content-Disposition", served)
