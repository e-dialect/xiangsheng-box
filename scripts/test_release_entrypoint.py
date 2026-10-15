"""Exercise production selection before any migration using synthetic commands."""
import json
import os
import pathlib
import subprocess
import sys
import tempfile
import unittest

ENTRYPOINT = pathlib.Path(__file__).resolve().parents[1] / 'backend/guantou/docker/entrypoint.sh'


class EntrypointTests(unittest.TestCase):
    def invoke(self, environment, uid='1000'):
        with tempfile.TemporaryDirectory() as directory:
            root = pathlib.Path(directory)
            record = root / 'commands.jsonl'
            executable = f'#!{sys.executable}\n'
            recorder = '''import json,os,sys
with open(os.environ['RECORD'], 'a') as stream:
 stream.write(json.dumps({'command':os.path.basename(sys.argv[0]), 'args':sys.argv[1:], 'environment':os.environ.get('ENVIRONMENT'), 'settings':os.environ.get('DJANGO_SETTINGS_MODULE')})+'\\n')
'''
            (root / 'python').write_text(executable + '''import os,sys
if sys.argv[1:2] == ['-c']:
 os.execv(sys.executable,[sys.executable]+sys.argv[1:])
''' + recorder)
            (root / 'gunicorn').write_text(executable + recorder)
            (root / 'id').write_text(executable + 'print(' + repr(uid) + ')\n')
            for name in ('python','gunicorn','id'):
                (root / name).chmod(0o700)
            env = {'PATH':str(root)+os.pathsep+os.environ['PATH'], 'RECORD':str(record), 'ENVIRONMENT':environment}
            result = subprocess.run(['/bin/sh',str(ENTRYPOINT)],cwd=root,env=env,capture_output=True,text=True,timeout=20)
            rows = [json.loads(line) for line in record.read_text().splitlines()] if record.exists() else []
            return result, rows

    def test_normalized_production_always_uses_gunicorn_and_production_settings(self):
        for environment in ('production',' Production ','\tPRODUCTION\n'):
            with self.subTest(environment=environment):
                result, rows = self.invoke(environment)
                self.assertEqual(result.returncode,0,result.stderr)
                self.assertEqual(rows[-1]['command'],'gunicorn')
                self.assertTrue(all(row['environment']=='production' for row in rows))
                self.assertTrue(all(row['settings']=='config.production' for row in rows))
                self.assertFalse(any('runserver' in row['args'] for row in rows))

    def test_normalized_production_root_is_rejected_before_migrations(self):
        result,rows = self.invoke(' Production ',uid='0')
        self.assertNotEqual(result.returncode,0)
        self.assertIn('explicit unprivileged UID',result.stderr)
        self.assertEqual(rows,[])

    def test_development_preserves_development_server(self):
        result,rows = self.invoke('development',uid='0')
        self.assertEqual(result.returncode,0,result.stderr)
        self.assertEqual(rows[-1]['args'],['manage.py','runserver','0.0.0.0:8000','--insecure'])
        self.assertFalse(any(row['command']=='gunicorn' for row in rows))


if __name__=='__main__':unittest.main()
