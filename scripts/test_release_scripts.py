"""Exercise publication authorization and immutable manifest failure boundaries."""
import datetime
import hashlib
import json
import os
import pathlib
import re
import subprocess
import tempfile
import unittest

import yaml

ROOT = pathlib.Path(__file__).resolve().parents[1]
RELEASE = yaml.safe_load((ROOT / '.github/workflows/release.yml').read_text())
CI = yaml.safe_load((ROOT / '.github/workflows/ci.yml').read_text())
SHA = subprocess.check_output(['git', 'rev-parse', 'HEAD'], cwd=ROOT, text=True).strip()
COMMIT_DATE = datetime.datetime.fromtimestamp(int(subprocess.check_output(['git', 'show', '-s', '--format=%ct', SHA], cwd=ROOT)), datetime.timezone.utc).strftime('%Y-%m-%dT%H:%M:%SZ')

def labels():
    return {'org.opencontainers.image.revision': SHA, 'org.opencontainers.image.source': 'https://github.com/e-dialect/xiangsheng-box', 'org.opencontainers.image.version': 'sha-' + SHA, 'org.opencontainers.image.created': COMMIT_DATE}


RUNTIME_CHECKS = ['capabilitiesWithoutTLSRedirect', 'productionAdminStaticCSS', 'untrustedHostRejected', 'corsExactOrigin', 'phoneDemoDisabled', 'httpsRedirect', 'gunicornIsPID1', 'backendUnprivilegedUID', 'productionStateDefaults', 'frontendHTMLAndJavaScript', 'frontendWithoutRuntimePlaceholder', 'nginxNonrootPort8080AndTmpPID']


def runtime_receipt(images):
    return {'result': 'PASS', 'cleanup': 'PASS', 'phase': 'complete',
            'checks': dict.fromkeys(RUNTIME_CHECKS, True),
            'containers': {service: {'present': True, 'status': 'running', 'imageId': image}
                           for service, image in images.items()}}


def node(source, env=None):
    return subprocess.run(['node', '--input-type=module', '-e', source], cwd=ROOT,
                          env={**os.environ, **(env or {})}, capture_output=True, text=True, timeout=20)


class AuthorizationTests(unittest.TestCase):
    def test_aggregate_gate_accepts_only_the_intentional_main_skip(self):
        step = CI['jobs']['ci-gate']['steps'][0]
        command = step['run'].split("node <<'JS'\n", 1)[1].rsplit('\nJS', 1)[0]
        for event in ['push', 'workflow_dispatch', 'pull_request']:
            jobs = {name: {'result': 'success'} for name in CI['jobs']['ci-gate']['needs']}
            if event != 'pull_request':
                jobs['commit-messages']['result'] = 'skipped'
            env = {'EVENT_NAME': event, 'NEEDS': json.dumps(jobs)}
            self.assertEqual(node(command, env).returncode, 0)
            for name in jobs:
                changed = {key: dict(value) for key, value in jobs.items()}
                changed[name]['result'] = 'failure'
                self.assertNotEqual(node(command, {**env, 'NEEDS': json.dumps(changed)}).returncode, 0)
            jobs['backend']['result'] = 'skipped'
            self.assertNotEqual(node(command, {**env, 'NEEDS': json.dumps(jobs)}).returncode, 0)

    def test_release_build_has_no_private_build_inputs_or_cos_actions(self):
        jobs = RELEASE['jobs']
        steps = {step['id']: step for step in jobs['publish']['steps'] if 'id' in step}
        for service, context in [('backend', './backend/guantou'), ('frontend', './frontend')]:
            build = steps[service]
            self.assertEqual(build['with']['context'], context)
            self.assertEqual(build['with']['platforms'], 'linux/amd64')
            self.assertIs(build['with']['push'], False)
            self.assertIs(build['with']['load'], True)
            if service == 'frontend':
                self.assertEqual(build['with']['build-args'].strip(),
                                 'VITE_BACKEND_URL=\nVITE_PHONE_CODE_LOGIN_ENABLED=false')
            else:
                self.assertNotIn('build-args', build['with'])
            self.assertNotIn('secrets', build['with'])
            self.assertNotIn('env', build)
            ignored = (ROOT / context / '.dockerignore').read_text().splitlines()
            self.assertIn('.env*', ignored)
        self.assertIn('VITE_BACKEND_URL_RUNTIME_REPLACEMENT', (ROOT / 'frontend/Dockerfile').read_text())
        self.assertIn('ARG VITE_PHONE_CODE_LOGIN_ENABLED=false', (ROOT / 'frontend/Dockerfile').read_text())
        cos_original = subprocess.check_output(['git', 'show', SHA + ':.github/workflows/deploy-cos.yml'], cwd=ROOT)
        self.assertEqual((ROOT / '.github/workflows/deploy-cos.yml').read_bytes(), cos_original)
        self.assertNotIn('TENCENT_CLOUD', (ROOT / '.github/workflows/release.yml').read_text())

    def test_ci_production_runtime_uses_the_same_compiled_frontend_contract(self):
        steps = CI['jobs']['docker']['steps']
        production = next(step for step in steps if step.get('name') == 'Build production frontend image')
        self.assertEqual(production['with']['build-args'].strip(),
                         'VITE_BACKEND_URL=\nVITE_PHONE_CODE_LOGIN_ENABLED=false')
        self.assertEqual(production['with']['platforms'], 'linux/amd64')
        self.assertNotIn('push', production['with'])
        smoke = next(step for step in steps if step.get('name') == 'Check real production runtime without external services')
        self.assertEqual(smoke['run'], 'python3 scripts/check-production-runtime.py')
        self.assertLess(steps.index(production), steps.index(smoke))
        self.assertLess(steps.index(smoke), next(i for i, step in enumerate(steps) if step.get('name') == 'Upload Docker images'))

    def test_release_smokes_before_any_publication_and_preserves_failure_receipt(self):
        steps = RELEASE['jobs']['publish']['steps']
        names = [step.get('name') for step in steps]
        smoke = names.index('Accept the exact production image pair before publication')
        promote = next(i for i, step in enumerate(steps) if step.get('id') == 'promote')
        self.assertLess(smoke, promote)
        self.assertIn('check-production-runtime.py', steps[smoke]['run'])
        self.assertIn('steps.promote.outputs.backend_digest', str(steps[promote + 1]))
        diagnostic = next(step for step in steps if step.get('name') == 'Preserve bounded runtime acceptance receipt')
        self.assertEqual(diagnostic['if'], 'always()')
        self.assertEqual(diagnostic['with']['path'], 'release/production-runtime.json')

    def authorize(self, mutation=None):
        script = RELEASE['jobs']['authorize']['steps'][0]['with']['script']
        state = {'sha': SHA, 'main': SHA, 'event': 'push', 'repository': 'e-dialect/xiangsheng-box',
                 'repositoryId': 1286043779, 'latest': 100, 'conclusion': 'success', 'gate': 'success'}
        state.update(mutation or {})
        harness = '''const s=STATE;
const run={id:100,run_number:10,head_sha:s.sha,head_branch:'main',
 head_repository:{full_name:s.repository,id:s.repositoryId},repository:{full_name:s.repository,id:s.repositoryId},
 workflow_id:42,event:s.event,status:'completed',conclusion:s.conclusion};
const github={rest:{repos:{getBranch:async()=>({data:{commit:{sha:s.main}}})},actions:{
 getWorkflow:async()=>({data:{id:42}}),getWorkflowRun:async()=>({data:run}),
 listWorkflowRuns:async()=>({data:{workflow_runs:[run,{...run,id:s.latest,run_number:11}]}}),
 listJobsForWorkflowRun:()=>{}}},paginate:async()=>s.gate===null?[]:[{name:'CI gate',status:'completed',conclusion:s.gate}]};
const context={repo:{owner:'e-dialect',repo:'xiangsheng-box'},payload:{workflow_run:{id:100,head_sha:s.sha}}};
const outputs={};const core={setOutput:(k,v)=>outputs[k]=v};
const execute=new (Object.getPrototypeOf(async()=>{}).constructor)('github','context','core',SCRIPT);
try{await execute(github,context,core);console.log(JSON.stringify(outputs))}catch(e){process.exitCode=1}
'''.replace('STATE', json.dumps(state)).replace('SCRIPT', json.dumps(script))
        return node(harness)

    def test_trusted_current_main_latest_ci_passes(self):
        result = self.authorize()
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertEqual(json.loads(result.stdout)['source_sha'], SHA)

    def test_untrusted_stale_failed_or_missing_gate_cannot_authorize(self):
        for mutation in [{'event': 'pull_request'}, {'repository': 'fork/xiangsheng-box'},
                         {'repositoryId': 1}, {'main': 'a' * 40}, {'latest': 101}, {'conclusion': 'failure'},
                         {'gate': 'failure'}, {'gate': None}]:
            with self.subTest(mutation=mutation):
                self.assertNotEqual(self.authorize(mutation).returncode, 0)

    def test_all_ci_jobs_feed_gate_and_only_authorized_job_has_package_write(self):
        jobs = CI['jobs']
        self.assertEqual(set(jobs['ci-gate']['needs']), set(jobs) - {'ci-gate'})
        self.assertEqual(jobs['ci-gate']['if'], 'always()')
        events = RELEASE.get('on', RELEASE.get(True))
        self.assertEqual(set(events), {'workflow_run', 'workflow_dispatch'})
        self.assertEqual(RELEASE['permissions'], {'contents': 'read'})
        self.assertNotIn('packages', RELEASE['jobs']['authorize']['permissions'])
        self.assertFalse(any('checkout' in step.get('uses', '') for step in RELEASE['jobs']['authorize']['steps']))
        self.assertEqual(RELEASE['jobs']['publish']['needs'], 'authorize')
        self.assertEqual(RELEASE['jobs']['publish']['permissions']['packages'], 'write')
        steps = {step['id']: step for step in RELEASE['jobs']['publish']['steps'] if 'id' in step}
        for service in ['backend', 'frontend']:
            self.assertEqual(steps[service]['if'], f"steps.existing.outputs.{service}_digest == ''")


class ManifestTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.directory = pathlib.Path(self.temp.name)
        self.tested = {}
        self.env = {'SOURCE_SHA': SHA, 'VERSION': 'sha-' + SHA, 'BUILD_DATE': COMMIT_DATE}
        for service in ['backend', 'frontend']:
            self.write_config(service, {'os': 'linux', 'architecture': 'amd64',
                'config': {'Labels': labels()}})
            self.bind_config(service)

    def tearDown(self):
        self.temp.cleanup()

    def write_manifest(self, service, value):
        raw = json.dumps(value).encode()
        (self.directory / (service + '-manifest.json')).write_bytes(raw + b'\n')
        self.env[service.upper() + '_DIGEST'] = 'sha256:' + hashlib.sha256(raw).hexdigest()

    def write_config(self, service, value):
        (self.directory / (service + '-config.json')).write_text(json.dumps(value))

    def bind_config(self, service):
        raw = (self.directory / (service + '-config.json')).read_bytes()
        self.tested[service] = 'sha256:' + hashlib.sha256(raw).hexdigest()
        (self.directory / 'production-runtime.json').write_text(json.dumps(runtime_receipt(self.tested)))
        self.write_manifest(service, {'schemaVersion': 2,
            'mediaType': 'application/vnd.oci.image.manifest.v1+json',
            'config': {'digest': 'sha256:' + hashlib.sha256(raw).hexdigest(), 'size': len(raw)}})

    def create(self):
        return subprocess.run(['node', 'scripts/create-release-manifest.mjs', str(self.directory)], cwd=ROOT,
                              env={**os.environ, **self.env}, capture_output=True, text=True, timeout=20)

    def test_verified_manifest_binds_images_runtime_config_and_migrations(self):
        result = self.create()
        self.assertEqual(result.returncode, 0, result.stderr)
        release = json.loads((self.directory / 'release-manifest.json').read_text())
        self.assertEqual(release['build']['frontend'], {
            'VITE_BACKEND_URL': '',
            'VITE_PHONE_CODE_LOGIN_ENABLED': 'false',
        })
        self.assertEqual(release['recovery']['compatibility'], 'server-local-attestation-required')
        self.assertFalse(release['recovery']['rollbackSafe'])
        entries = []
        tree = subprocess.check_output(['git', 'ls-tree', '-rz', '--full-tree', SHA, '--', 'backend/guantou'], cwd=ROOT)
        for record in tree.decode().split('\0'):
            if not record:
                continue
            metadata, path = record.split('\t')
            if not re.fullmatch(r'backend/guantou/[^/]+/migrations/[^/]+\.py', path):
                continue
            content = subprocess.check_output(['git', 'cat-file', 'blob', metadata.split()[2]], cwd=ROOT)
            entries.append({'path': path, 'sha256': hashlib.sha256(content).hexdigest()})
        canonical = json.dumps(sorted(entries, key=lambda e: e['path']), separators=(',', ':'), ensure_ascii=False).encode()
        self.assertEqual(release['recovery']['migrationDigest'], 'sha256:' + hashlib.sha256(canonical).hexdigest())
        requirements = subprocess.check_output(['git', 'show', SHA + ':backend/guantou/requirements.txt'], cwd=ROOT, text=True)
        version = re.search(r'^django==([^\s#]+)\s*$', requirements, re.M | re.I).group(1)
        self.assertEqual(release['recovery']['djangoVersion'], version)
        self.assertEqual(release['recovery']['kind'], 'django-sqlite')
        self.assertEqual(release['recovery']['dataFormat'], 'django-sqlite-media')
        self.assertEqual(release['build']['backend'], {})
        self.assertEqual(set(release['images']), {'backend', 'frontend'})

    def test_smoke_identity_and_complete_acceptance_are_required_for_manifest(self):
        for mutation in ['image', 'check', 'cleanup']:
            with self.subTest(mutation=mutation):
                receipt = runtime_receipt(self.tested)
                if mutation == 'image':
                    receipt['containers']['backend']['imageId'] = 'sha256:' + 'f' * 64
                elif mutation == 'check':
                    receipt['checks']['productionStateDefaults'] = False
                else:
                    receipt['cleanup'] = 'FAIL'
                (self.directory / 'production-runtime.json').write_text(json.dumps(receipt))
                self.assertNotEqual(self.create().returncode, 0)
                self.assertFalse((self.directory / 'release-manifest.json').exists())

    def test_tampered_registry_bytes_do_not_produce_manifest(self):
        with (self.directory / 'backend-manifest.json').open('ab') as stream:
            stream.write(b' ')
        self.assertNotEqual(self.create().returncode, 0)
        self.assertFalse((self.directory / 'release-manifest.json').exists())

    def test_raw_config_must_match_manifest_digest(self):
        raw = (self.directory / 'backend-config.json').read_bytes()
        # Keep valid JSON and byte length so only the content hash detects this.
        tampered = raw.replace(b'linux', b'linuz', 1)
        self.assertEqual(len(raw), len(tampered))
        (self.directory / 'backend-config.json').write_bytes(tampered)
        self.assertNotEqual(self.create().returncode, 0)
        self.assertFalse((self.directory / 'release-manifest.json').exists())

    def test_wrong_platform_or_revision_is_rejected(self):
        for key, value in [('architecture', 'arm64'), ('revision', 'a' * 40)]:
            with self.subTest(key=key):
                config = {'os': 'linux', 'architecture': 'amd64', 'config': {'Labels': labels()}}
                if key == 'revision':
                    config['config']['Labels']['org.opencontainers.image.revision'] = value
                else:
                    config[key] = value
                self.write_config('backend', config)
                self.bind_config('backend')
                self.assertNotEqual(self.create().returncode, 0)
                self.assertFalse((self.directory / 'release-manifest.json').exists())


class ImmutableTagTests(unittest.TestCase):
    def check(self, responses):
        script = (ROOT / 'scripts/resolve-release-images.mjs').resolve().as_uri()
        code = '''import assert from 'node:assert/strict';
const responses=RESPONSES;let count=0;
globalThis.fetch=async(url)=>{assert.ok(url.startsWith('https://api.github.com/orgs/e-dialect/packages/container/xiangsheng-box-'));const r=responses[count++];return {status:r.status,ok:r.status===200,json:async()=>r.body}};
await import(SCRIPT);assert.equal(count,responses.length);
'''.replace('RESPONSES', json.dumps(responses)).replace('SCRIPT', json.dumps(script))
        with tempfile.TemporaryDirectory() as temp:
            return node(code, {'SOURCE_SHA': SHA, 'GHCR_TOKEN': 'synthetic-fixture-token', 'BUILD_DATE': COMMIT_DATE, 'GITHUB_OUTPUT': str(pathlib.Path(temp) / 'github-output')})

    def test_new_packages_can_publish_but_both_packages_are_checked(self):
        self.assertEqual(self.check([{'status': 404}, {'status': 200, 'body': []}]).returncode, 0)
        existing = {'status': 200, 'body': [{'metadata': {'container': {'tags': ['sha-' + SHA]}}}]}
        self.assertNotEqual(self.check([{'status': 404}, existing]).returncode, 0)

    def test_retry_reuses_only_fully_verified_published_digest(self):
        with tempfile.TemporaryDirectory() as temp:
            directory = pathlib.Path(temp)
            config = {'os': 'linux', 'architecture': 'amd64', 'config': {'Labels': labels()}}
            def registry_response():
                raw_config = json.dumps(config).encode()
                raw = json.dumps({'schemaVersion': 2, 'mediaType': 'application/vnd.oci.image.manifest.v1+json', 'config': {'digest': 'sha256:' + hashlib.sha256(raw_config).hexdigest(), 'size': len(raw_config)}}).encode()
                digest = 'sha256:' + hashlib.sha256(raw).hexdigest()
                (directory / 'manifest').write_bytes(raw)
                return digest, raw_config
            docker = directory / 'docker'
            docker.write_text("#!/usr/bin/env python3\nimport pathlib,sys\np=pathlib.Path(__file__).parent\nassert sys.argv[1:4]==['buildx','imagetools','inspect']\nassert any('xiangsheng-box-'+s+'@sha256:' in sys.argv[4] for s in ['backend','frontend'])\nsys.stdout.buffer.write((p/'manifest').read_bytes())\n")
            docker.chmod(0o755)
            script = (ROOT / 'scripts/resolve-release-images.mjs').resolve().as_uri()
            def execute(redirect_host=None, both_existing=False):
                (directory / 'github-output').unlink(missing_ok=True)
                digest, raw_config = registry_response()
                existing = {'status': 200, 'body': [{'name': digest, 'metadata': {'container': {'tags': ['sha-' + SHA]}}}]}
                responses = [existing, existing if both_existing else {'status': 404}]
                code = "import assert from 'node:assert/strict';const r=" + json.dumps(responses) + ";const blob=" + json.dumps(raw_config.decode()) + ";const redirect=" + json.dumps(redirect_host) + ";let n=0;globalThis.fetch=async(url,options)=>{url=String(url);if(url.startsWith('https://ghcr.io/token?'))return new Response(JSON.stringify({token:'synthetic-pull-token'}));if(url.includes('/blobs/'))return redirect?new Response(null,{status:307,headers:{location:'https://'+redirect+'/fixture?signature=synthetic'}}):new Response(blob);if(url.startsWith('https://pkg-containers.githubusercontent.com/')){assert.equal(options.headers?.Authorization,undefined);return new Response(blob)}const v=r[n++];return {status:v.status,ok:v.status===200,json:async()=>v.body}};await import(" + json.dumps(script) + ");"

                env = {'PATH': str(directory) + os.pathsep + os.environ['PATH'], 'SOURCE_SHA': SHA, 'GHCR_TOKEN': 'synthetic-fixture-token', 'GITHUB_ACTOR': 'synthetic-actor', 'BUILD_DATE': COMMIT_DATE, 'GITHUB_OUTPUT': str(directory / 'github-output')}
                return node(code, env), digest
            for both_existing in (False, True):
                with self.subTest(both_existing=both_existing):
                    result, digest = execute(both_existing=both_existing)
                    self.assertEqual(result.returncode, 0, result.stderr)
                    self.assertEqual((directory / 'github-output').read_text(), 'backend_digest=' + digest + '\nfrontend_digest=' + (digest if both_existing else '') + '\n')
            self.assertEqual(execute('pkg-containers.githubusercontent.com')[0].returncode, 0)
            untrusted = execute('untrusted.example')[0]
            self.assertNotEqual(untrusted.returncode, 0)
            self.assertIn('Untrusted registry blob redirect', untrusted.stderr)
            # Valid raw blobs with mismatched identity still must not be reused.
            for key, value in [('org.opencontainers.image.revision', 'a' * 40), ('org.opencontainers.image.source', 'https://github.com/other/repo'), ('org.opencontainers.image.version', 'unexpected-version'), ('org.opencontainers.image.created', '2020-01-01T00:00:00Z')]:
                with self.subTest(label=key):
                    config['config']['Labels'] = labels()
                    config['config']['Labels'][key] = value
                    self.assertNotEqual(execute()[0].returncode, 0)

    def test_registry_api_errors_fail_closed(self):
        for status in [401, 403, 429, 500]:
            with self.subTest(status=status):
                self.assertNotEqual(self.check([{'status': status}]).returncode, 0)


if __name__ == '__main__':
    unittest.main()
