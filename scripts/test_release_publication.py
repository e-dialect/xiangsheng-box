"""Run publication scripts against an isolated registry/daemon command fixture."""
import hashlib
import json
import os
import pathlib
import tempfile
import unittest

from test_release_scripts import ROOT, SHA, COMMIT_DATE, labels, node, runtime_receipt


def digest(raw):
    return 'sha256:' + hashlib.sha256(raw).hexdigest()


class PublicationTests(unittest.TestCase):
    def execute(self, existing=(), mutation=None):
        with tempfile.TemporaryDirectory() as temporary:
            directory = pathlib.Path(temporary)
            images, manifests, configs, digests = {}, {}, {}, {}
            for service in ('backend', 'frontend'):
                raw = json.dumps({'os': 'linux', 'architecture': 'amd64',
                                  'config': {'Labels': {**labels(), 'fixture.service': service}}}).encode()
                configs[service] = raw.decode()
                images[service] = digest(raw)
                manifest = json.dumps({'schemaVersion': 2,
                    'mediaType': 'application/vnd.oci.image.manifest.v1+json',
                    'config': {'digest': images[service], 'size': len(raw)}})
                manifests[service] = manifest
                digests[service] = digest(manifest.encode())
            receipt = runtime_receipt(images)
            local_images = dict(images)
            if mutation == 'cleanup':
                receipt['cleanup'] = 'FAIL'
            elif mutation == 'check':
                receipt['checks']['productionStateDefaults'] = False
            elif mutation == 'local_tag':
                local_images['backend'] = 'sha256:' + 'f' * 64
            elif mutation in ('existing_config', 'pushed_config'):
                service = 'backend'
                config = json.loads(configs[service])
                config['config']['Labels']['fixture.variant'] = 'different-valid-config'
                raw = json.dumps(config).encode()
                configs[service] = raw.decode()
                manifests[service] = json.dumps({'schemaVersion': 2,
                    'mediaType': 'application/vnd.oci.image.manifest.v1+json',
                    'config': {'digest': digest(raw), 'size': len(raw)}})
                digests[service] = digest(manifests[service].encode())
            (directory / 'receipt.json').write_text(json.dumps(receipt))
            (directory / 'fixture.json').write_text(json.dumps({
                'images': local_images, 'manifests': manifests, 'digests': digests}))
            docker = directory / 'docker'
            docker.write_text('''#!/usr/bin/env python3
import json,pathlib,sys
p=pathlib.Path(__file__).parent
args=sys.argv[1:]
with (p/'operations').open('a') as stream:stream.write(json.dumps(args)+'\\n')
f=json.loads((p/'fixture.json').read_text())
service=next(s for s in ('backend','frontend') if any('xiangsheng-box-'+s in a for a in args))
if args[:2]==['image','inspect']:print(f['images'][service])
elif args[:2]==['image','push']:pass
elif args[:3]==['buildx','imagetools','inspect']:
 if '--raw' in args:sys.stdout.write(f['manifests'][service])
 else:print(f['digests'][service])
elif args[0]=='pull' or args[:2]==['image','tag']:pass
else:raise SystemExit('unexpected fixture operation')
''')
            docker.chmod(0o755)
            harness = '''const configs=CONFIGS, digests=DIGESTS, existing=EXISTING;
globalThis.fetch=async(url)=>{
 url=String(url);
 const service=['backend','frontend'].find(s=>url.includes('xiangsheng-box-'+s));
 if(url.startsWith('https://ghcr.io/token?'))return new Response(JSON.stringify({token:'synthetic-pull-token'}));
 if(url.includes('/blobs/'))return new Response(configs[service]);
 if(url.startsWith('https://api.github.com/orgs/e-dialect/packages/container/'))return new Response(JSON.stringify(existing.includes(service)?[{name:digests[service],metadata:{container:{tags:['sha-SHA']}}}]:[]));
 throw new Error('Unexpected fixture URL');
};await import(SCRIPT);
'''.replace('CONFIGS', json.dumps(configs)).replace('DIGESTS', json.dumps(digests)).replace('EXISTING', json.dumps(list(existing))).replace('sha-SHA', 'sha-' + SHA).replace('SCRIPT', json.dumps((ROOT / 'scripts/publish-tested-images.mjs').as_uri()))
            env = {'PATH': str(directory) + os.pathsep + os.environ['PATH'],
                   'SOURCE_SHA': SHA, 'BUILD_DATE': COMMIT_DATE,
                   'GHCR_TOKEN': 'synthetic-fixture-token', 'GITHUB_ACTOR': 'fixture',
                   'GITHUB_OUTPUT': str(directory / 'outputs')}
            # Set argv explicitly because the publication module is imported by node -e.
            result = node('process.argv[2]=' + json.dumps(str(directory / 'receipt.json')) + ';' + harness, env)
            operations = [json.loads(line) for line in (directory / 'operations').read_text().splitlines()] if (directory / 'operations').exists() else []
            outputs = (directory / 'outputs').read_text() if (directory / 'outputs').exists() else ''
            return result, operations, outputs, digests

    def test_missing_partial_and_complete_publication_use_the_smoked_pair(self):
        for existing in ((), ('backend',), ('backend', 'frontend')):
            with self.subTest(existing=existing):
                result, operations, outputs, digests = self.execute(existing)
                self.assertEqual(result.returncode, 0, result.stderr)
                pushes = [args[-1] for args in operations if args[:2] == ['image', 'push']]
                self.assertEqual(pushes, [f'ghcr.io/e-dialect/xiangsheng-box-{s}:sha-{SHA}' for s in ('backend', 'frontend') if s not in existing])
                self.assertEqual(outputs, ''.join(f'{s}_digest={digests[s]}\n' for s in ('backend', 'frontend')))

    def test_failed_or_incomplete_smoke_and_local_identity_change_never_push(self):
        for mutation in ('cleanup', 'check', 'local_tag'):
            with self.subTest(mutation=mutation):
                result, operations, outputs, _ = self.execute(mutation=mutation)
                self.assertNotEqual(result.returncode, 0)
                self.assertFalse(any(args[:2] == ['image', 'push'] for args in operations))
                self.assertEqual(outputs, '')

    def test_existing_config_must_equal_smoked_config_and_is_never_replaced(self):
        result, operations, outputs, _ = self.execute(('backend',), 'existing_config')
        self.assertNotEqual(result.returncode, 0)
        self.assertFalse(any(args[:2] == ['image', 'push'] for args in operations))
        self.assertEqual(outputs, '')

    def test_post_push_config_mismatch_blocks_release_outputs(self):
        result, operations, outputs, _ = self.execute(mutation='pushed_config')
        self.assertNotEqual(result.returncode, 0)
        self.assertEqual(len([args for args in operations if args[:2] == ['image', 'push']]), 1)
        self.assertEqual(outputs, '')

    def test_existing_digest_is_pulled_and_tagged_locally_without_publication(self):
        with tempfile.TemporaryDirectory() as temporary:
            directory = pathlib.Path(temporary)
            docker = directory / 'docker'
            docker.write_text('#!/usr/bin/env python3\nimport json,pathlib,sys\nwith pathlib.Path(__file__).with_name("operations").open("a") as stream:stream.write(json.dumps(sys.argv[1:])+"\\n")\n')
            docker.chmod(0o755)
            image = 'ghcr.io/e-dialect/xiangsheng-box-backend'
            immutable = image + '@sha256:' + 'a' * 64
            result = node('await import(' + json.dumps((ROOT / 'scripts/load-existing-release-images.mjs').as_uri()) + ')',
                          {'PATH': str(directory) + os.pathsep + os.environ['PATH'], 'SOURCE_SHA': SHA,
                           'BACKEND_DIGEST': 'sha256:' + 'a' * 64, 'FRONTEND_DIGEST': ''})
            self.assertEqual(result.returncode, 0, result.stderr)
            operations = [json.loads(line) for line in (directory / 'operations').read_text().splitlines()]
            self.assertEqual(operations, [['pull', '--platform', 'linux/amd64', immutable],
                                         ['image', 'tag', immutable, image + ':sha-' + SHA]])


if __name__ == '__main__':
    unittest.main()
