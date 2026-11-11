"""A disconnected Docker daemon must not count as successful fixture cleanup."""
import importlib.util
import contextlib
import io
import json
import pathlib
import subprocess
import unittest
from unittest.mock import Mock, call, patch

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


class RuntimeCleanupTests(unittest.TestCase):
    def setUp(self):
        self.container = {
            'Id': 'fixture-id',
            'Config': {'Labels': {'fixture-label': 'fixture-nonce'}},
        }

    def cleanup(self, docker):
        return RUNTIME.cleanup_fixture(
            docker, {'backend': 'private-container-name'}, 'fixture-label',
            'fixture-nonce', {'backend': 'fixture-id'},
        )

    def test_cleanup_requires_confirmed_absence_after_exact_container_removal(self):
        docker = Mock()
        docker.inspect.side_effect = [self.container, None]
        self.assertEqual(self.cleanup(docker), (True, []))
        docker.call.assert_called_once_with(['rm', '--force', 'fixture-id'])
        self.assertEqual(docker.inspect.call_count, 2)

    def test_missing_fixture_needs_no_removal(self):
        docker = Mock()
        docker.inspect.return_value = None
        self.assertEqual(self.cleanup(docker), (True, []))
        docker.call.assert_not_called()

    def test_failed_cleanup_reports_stage_without_docker_output(self):
        for stage in ('inspect-before-removal', 'remove', 'inspect-after-removal'):
            with self.subTest(stage=stage):
                docker = Mock()
                error = RUNTIME.SmokeFailure('private-docker-error-value')
                docker.inspect.side_effect = (
                    [error] if stage == 'inspect-before-removal' else
                    [self.container, error if stage == 'inspect-after-removal' else None]
                )
                if stage == 'remove':
                    docker.call.side_effect = error
                cleaned, failures = self.cleanup(docker)
                self.assertFalse(cleaned)
                self.assertEqual(failures, [{
                    'service': 'backend', 'stage': stage, 'errorType': 'SmokeFailure',
                }])
                self.assertNotIn('private-', json.dumps(failures))

    def test_identity_mismatch_refuses_removal_for_label_or_id(self):
        for mismatch in ('label', 'id'):
            with self.subTest(mismatch=mismatch):
                docker = Mock()
                if mismatch == 'label':
                    self.container['Config']['Labels']['fixture-label'] = 'other-nonce'
                else:
                    self.container['Config']['Labels']['fixture-label'] = 'fixture-nonce'
                    self.container['Id'] = 'other-id'
                docker.inspect.return_value = self.container
                cleaned, failures = self.cleanup(docker)
                self.assertFalse(cleaned)
                self.assertEqual(failures[0]['stage'], 'verify-identity')
                docker.call.assert_not_called()

    def test_container_still_present_after_removal_is_a_failure(self):
        docker = Mock()
        docker.inspect.return_value = self.container
        cleaned, failures = self.cleanup(docker)
        self.assertFalse(cleaned)
        self.assertEqual(failures[0]['stage'], 'inspect-after-removal')

    def test_cleanup_continues_with_other_service_after_failure(self):
        docker = Mock()
        docker.inspect.side_effect = [RUNTIME.SmokeFailure('private-value'), None, None]
        cleaned, failures = RUNTIME.cleanup_fixture(
            docker, {'backend': 'backend-name', 'frontend': 'frontend-name'},
            'fixture-label', 'fixture-nonce', {},
        )
        self.assertFalse(cleaned)
        self.assertEqual([failure['service'] for failure in failures], ['frontend'])
        self.assertEqual(docker.inspect.call_args_list,
                         [call('frontend-name'), call('backend-name'), call('backend-name')])

    def test_main_includes_cleanup_diagnostics_and_keeps_failure_exit(self):
        docker = Mock()
        docker.call.side_effect = RUNTIME.SmokeFailure('preflight unavailable')
        docker.inspect.side_effect = RUNTIME.SmokeFailure('private-value')
        output = io.StringIO()
        with patch.object(RUNTIME, 'Docker', return_value=docker), patch(
            'sys.argv', ['check-production-runtime.py']
        ), contextlib.redirect_stdout(output):
            self.assertEqual(RUNTIME.main(), 1)
        receipt = json.loads(output.getvalue())
        self.assertEqual(receipt['result'], 'FAIL')
        self.assertEqual(receipt['cleanup'], 'FAIL: exact fixture cleanup required')
        self.assertEqual(len(receipt['cleanupFailures']), 2)
        self.assertNotIn('private-value', output.getvalue())


if __name__ == '__main__':
    unittest.main()
