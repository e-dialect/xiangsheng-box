import json
import os
import subprocess
import sys
import tempfile

from django.conf import settings
from django.test import SimpleTestCase


class ProductionBoundaryTests(SimpleTestCase):
    def _load(self, overrides=None, *, paths_only=False, file_overrides=None):
        with tempfile.TemporaryDirectory() as directory:
            envfile = os.path.join(directory, "empty.env")
            with open(envfile, "w") as stream:
                for key, value in (file_overrides or {}).items():
                    stream.write(f"{key}={json.dumps(value)}\n")
            environment = {
                "PATH": os.environ.get("PATH", ""),
                "ENV_FILE": envfile,
                "ENVIRONMENT": "production",
                "SECRET_KEY": "synthetic-django-key-" + "x" * 64,
                "JWT_KEY": "synthetic-jwt-key-" + "y" * 64,
                "EMAIL_HOST": "smtp.invalid",
                "EMAIL_HOST_USER": "synthetic@example.invalid",
                "EMAIL_HOST_PASSWORD": "synthetic-not-a-real-password",
                "DEFAULT_FROM_EMAIL": "synthetic@example.invalid",
                "COS_SECRET_ID": "synthetic-id",
                "COS_SECRET_KEY": "synthetic-key",
                "COS_BUCKET": "synthetic-bucket",
                "COS_REGION": "ap-test-1",
                "APP_ID": "synthetic-app-id",
                "APP_SECRET": "synthetic-app-secret",
                "PUBLIC_BACKEND_URL": "https://box.example.invalid",
                "COS_KEY_PREFIX": "xiangsheng-box",
                "PHONE_CODE_DEMO_MODE": "false",
                "EMAIL_CODE_DEMO_MODE": "false",
                "WECHAT_BIND_DEMO_MODE": "false",
                "LOG_DIR": directory,
                "SQLITE_PATH": os.path.join(directory, "db.sqlite3"),
                "PYTHONDONTWRITEBYTECODE": "1",
            }
            if paths_only:
                for key in ("SQLITE_PATH", "MEDIA_ROOT", "LOG_DIR"):
                    environment.pop(key, None)
            environment.update(overrides or {})
            code = """
import json
from config import production as s
import os
os.environ['DJANGO_SETTINGS_MODULE'] = 'config.production'
from django.core.exceptions import DisallowedHost
from django.test import RequestFactory
middleware = s.ValidateHostMiddleware(lambda request: 'accepted')
assert middleware(RequestFactory().get('/site-settings/capabilities', HTTP_HOST='box.example.invalid')) == 'accepted'
try:
    middleware(RequestFactory().get('/site-settings/capabilities', HTTP_HOST='untrusted.example.invalid'))
except DisallowedHost:
    pass
else:
    raise AssertionError('Health path accepted an untrusted host')
print(json.dumps({
    'hosts': s.ALLOWED_HOSTS,
    'corsAll': s.CORS_ALLOW_ALL_ORIGINS,
    'cors': s.CORS_ALLOWED_ORIGINS,
    'csrf': s.CSRF_TRUSTED_ORIGINS,
    'cookies': [s.SESSION_COOKIE_NAME, s.CSRF_COOKIE_NAME],
    'secureCookies': s.SESSION_COOKIE_SECURE and s.CSRF_COOKIE_SECURE,
    'proxy': s.SECURE_PROXY_SSL_HEADER,
    'middleware': s.MIDDLEWARE,
    'logHandlers': list(s.LOGGING['handlers']),
    'prefix': s.COS_KEY_PREFIX,
}))
"""
            if paths_only:
                code = """
import importlib
import json
import os
from unittest.mock import patch
module = 'config.production' if os.environ['ENVIRONMENT'].strip().lower() == 'production' else 'config.settings'
with patch('os.makedirs') as mkdir:
    s = importlib.import_module(module)
print(json.dumps({
    'database': s.DATABASES['default']['NAME'],
    'media': s.MEDIA_ROOT,
    'logs': s.log_path,
    'mkdir': [call.args[0] for call in mkdir.call_args_list],
}))
"""
            return subprocess.run(
                [sys.executable, "-c", code],
                cwd=settings.BASE_DIR,
                env=environment,
                capture_output=True,
                text=True,
                timeout=20,
            )

    def test_production_defaults_are_writable_before_base_settings_import(self):
        for environment in ("production", " Production ", "PRODUCTION"):
            with self.subTest(environment=environment):
                result = self._load({"ENVIRONMENT": environment}, paths_only=True)
                self.assertEqual(result.returncode, 0, result.stderr)
                self.assertEqual(
                    json.loads(result.stdout),
                    {
                        "database": "/data/db.sqlite3",
                        "media": "/data/media",
                        "logs": "/data/logs",
                        "mkdir": ["/data/logs"],
                    },
                )

    def test_development_keeps_source_relative_data_defaults(self):
        result = self._load({"ENVIRONMENT": " development "}, paths_only=True)
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertEqual(
            json.loads(result.stdout),
            {
                "database": os.path.join(settings.BASE_DIR, "db.sqlite3"),
                "media": os.path.join(settings.BASE_DIR, "media"),
                "logs": os.path.join(settings.BASE_DIR, "logs"),
                "mkdir": [os.path.join(settings.BASE_DIR, "logs")],
            },
        )

    def test_explicit_environment_and_env_file_paths_keep_precedence(self):
        file_paths = {
            "SQLITE_PATH": "/file-data/db.sqlite3",
            "MEDIA_ROOT": "/file-data/media",
            "LOG_DIR": "/file-data/logs",
        }
        for overrides in (
            {},
            {
                key: value.replace("file-data", "env-data")
                for key, value in file_paths.items()
            },
        ):
            with self.subTest(environment_override=bool(overrides)):
                result = self._load(
                    overrides, paths_only=True, file_overrides=file_paths
                )
                self.assertEqual(result.returncode, 0, result.stderr)
                expected = overrides or file_paths
                self.assertEqual(
                    json.loads(result.stdout),
                    {
                        "database": expected["SQLITE_PATH"],
                        "media": expected["MEDIA_ROOT"],
                        "logs": expected["LOG_DIR"],
                        "mkdir": [expected["LOG_DIR"]],
                    },
                )

    def test_production_contract_is_origin_bound_and_logs_to_console(self):
        result = self._load()
        self.assertEqual(result.returncode, 0, result.stderr)
        config = json.loads(result.stdout)
        self.assertNotIn("*", config["hosts"])
        self.assertIn("box.example.invalid", config["hosts"])
        self.assertFalse(config["corsAll"])
        self.assertEqual(config["cors"], ["https://box.example.invalid"])
        self.assertEqual(config["csrf"], config["cors"])
        self.assertEqual(
            config["cookies"], ["xiangsheng_box_sessionid", "xiangsheng_box_csrftoken"]
        )
        self.assertTrue(config["secureCookies"])
        self.assertEqual(config["proxy"], ["HTTP_X_FORWARDED_PROTO", "https"])
        self.assertEqual(config["logHandlers"], ["console"])
        self.assertEqual(config["prefix"], "xiangsheng-box")
        self.assertEqual(
            config["middleware"][2], "whitenoise.middleware.WhiteNoiseMiddleware"
        )

    def test_debug_and_each_demo_auth_mode_are_rejected(self):
        for key in (
            "DEBUG",
            "PHONE_CODE_DEMO_MODE",
            "EMAIL_CODE_DEMO_MODE",
            "WECHAT_BIND_DEMO_MODE",
        ):
            with self.subTest(key=key):
                result = self._load({key: "true"})
                self.assertNotEqual(result.returncode, 0)
                self.assertIn("cannot enable debug or demo", result.stderr)

    def test_development_or_short_keys_are_rejected(self):
        for key in ("SECRET_KEY", "JWT_KEY"):
            for value in ("short", "dev-" + "x" * 64, "ci-" + "x" * 64):
                with self.subTest(key=key, value=value):
                    result = self._load({key: value})
                    self.assertNotEqual(result.returncode, 0)
                    self.assertIn("dedicated random production key", result.stderr)

    def test_public_backend_url_must_be_https_origin_only(self):
        for value in (
            "http://box.example.invalid",
            "https://box.example.invalid/api",
            "https://name:password@box.example.invalid",
            "https://box.example.invalid?key=x",
            "https://box.example.invalid:8443",
        ):
            with self.subTest(value=value):
                result = self._load({"PUBLIC_BACKEND_URL": value})
                self.assertNotEqual(result.returncode, 0)
                self.assertIn("must be an HTTPS origin", result.stderr)

    def test_production_cannot_share_unscoped_object_keys(self):
        for value in ("", "../old", "/xiangsheng-box", "box/old"):
            with self.subTest(value=value):
                result = self._load({"COS_KEY_PREFIX": value})
                self.assertNotEqual(result.returncode, 0)
                self.assertIn("dedicated COS_KEY_PREFIX", result.stderr)
