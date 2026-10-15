"""A disconnected Docker daemon must not count as successful fixture cleanup."""
import importlib.util
import pathlib
import subprocess
import unittest
from unittest.mock import Mock, patch

SPEC = importlib.util.spec_from_file_location(
    'production_runtime', pathlib.Path(__file__).with_name('check-production-runtime.py')
)
RUNTIME = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(RUNTIME)


class RuntimeInspectionTests(unittest.TestCase):
    def test_nginx_diagnostics_emit_only_fixed_categories_and_system_paths(self):
        docker = Mock()
        docker.inspect.return_value = {'Config': {'Labels': {'edialect.production-runtime-smoke': 'synthetic'}}}
        raw = (b'nginx: [emerg] mkdir() "/var/cache/nginx/client_temp" failed (30: Read-only file system)\n'
               b'nginx: [emerg] open() "/home/private/arbitrary" failed (13: Permission denied) private-log-value\n')
        docker.call.return_value = subprocess.CompletedProcess([], 0, b'', raw)
        result = RUNTIME.nginx_startup_diagnostics(docker, 'fixture', 'synthetic')
        self.assertEqual(result['systemPaths'], ['/var/cache/nginx/client_temp'])
        self.assertEqual(result['errorCategories'], ['directoryCreation', 'fileOpen', 'permissionDenied', 'readOnlyFilesystem'])
        self.assertNotIn('private-log-value', str(result))
        self.assertNotIn('/home/private', str(result))
        docker.inspect.return_value['Config']['Labels']['edialect.production-runtime-smoke'] = 'other-fixture'
        docker.call.reset_mock()
        self.assertEqual(RUNTIME.nginx_startup_diagnostics(docker, 'fixture', 'synthetic'), {'available': False})
        docker.call.assert_not_called()

    def test_only_explicit_missing_container_proves_absence(self):
        docker = RUNTIME.Docker('default')
        for diagnostic in (b'Error: No such object: synthetic', b'Error: No such container: synthetic'):
            with self.subTest(diagnostic=diagnostic), patch.object(
                docker, 'call', return_value=subprocess.CompletedProcess([], 1, b'', diagnostic)
            ):
                self.assertIsNone(docker.inspect('synthetic'))

    def test_unreachable_daemon_cannot_claim_container_absence(self):
        docker = RUNTIME.Docker('default')
        with patch.object(docker, 'call', return_value=subprocess.CompletedProcess(
            [], 1, b'', b'Cannot connect to the Docker daemon'
        )):
            with self.assertRaises(RUNTIME.SmokeFailure):
                docker.inspect('synthetic')
            self.assertEqual(RUNTIME.safe_state(docker, {'backend': 'synthetic'}),
                             {'backend': {'inspectionUnavailable': True}})


if __name__ == '__main__':
    unittest.main()
