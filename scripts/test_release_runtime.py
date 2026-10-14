"""A disconnected Docker daemon must not count as successful fixture cleanup."""
import importlib.util
import pathlib
import subprocess
import unittest
from unittest.mock import patch

SPEC = importlib.util.spec_from_file_location(
    'production_runtime', pathlib.Path(__file__).with_name('check-production-runtime.py')
)
RUNTIME = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(RUNTIME)


class RuntimeInspectionTests(unittest.TestCase):
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
