#!/usr/bin/env python3
"""Exercise real production images using only isolated, synthetic tmpfs data."""
import argparse
import json
import re
import signal
import subprocess
import time
import urllib.parse
import uuid


class SmokeFailure(RuntimeError):
    pass


BACKEND_READY = r'''
import json,urllib.request
request=urllib.request.Request('http://127.0.0.1:8000/site-settings/capabilities',headers={'Host':'box.example.invalid'})
with urllib.request.build_opener(urllib.request.ProxyHandler({})).open(request,timeout=3) as response:
 data=json.loads(response.read(1048576))
 assert response.status==200 and data.get('version')==1 and isinstance(data.get('capabilities'),dict)
'''

BACKEND_CHECKS = r'''
import json,pathlib,urllib.request,urllib.error
class NoRedirect(urllib.request.HTTPRedirectHandler):
 def redirect_request(self,*args,**kwargs):return None
opener=urllib.request.build_opener(NoRedirect,urllib.request.ProxyHandler({}))
def get(path,headers=None,body=None):
 h={'Host':'box.example.invalid',**(headers or {})}
 if body is not None:h['Content-Type']='application/json'
 request=urllib.request.Request('http://127.0.0.1:8000'+path,headers=h,data=body)
 try:response=opener.open(request,timeout=5)
 except urllib.error.HTTPError as error:response=error
 with response:return response.status,response.headers,response.read(2097152)
checks={}
status,headers,body=get('/site-settings/capabilities')
data=json.loads(body)
assert status==200 and data.get('version')==1 and isinstance(data.get('capabilities'),dict)
checks['capabilitiesWithoutTLSRedirect']=True
status,headers,body=get('/static/admin/css/base.css',{'X-Forwarded-Proto':'https'})
assert status==200 and headers.get_content_type()=='text/css' and len(body)>100
checks['productionAdminStaticCSS']=True
assert get('/site-settings/capabilities',{'Host':'untrusted.example.invalid'})[0]==400
checks['untrustedHostRejected']=True
status,headers,body=get('/site-settings/capabilities',{'Origin':'https://box.example.invalid'})
assert status==200 and headers.get('Access-Control-Allow-Origin')=='https://box.example.invalid'
assert get('/site-settings/capabilities',{'Origin':'https://untrusted.example.invalid'})[1].get('Access-Control-Allow-Origin') is None
checks['corsExactOrigin']=True
status,headers,body=get('/users/phone-code',{'X-Forwarded-Proto':'https'},b'{"phone":"synthetic-never-sent"}')
data=json.loads(body)
assert status==503 and 'demo_code' not in data and data.get('delivery')!='demo'
checks['phoneDemoDisabled']=True
status,headers,body=get('/site-settings/carousel')
assert status in (301,302) and headers.get('Location')=='https://box.example.invalid/site-settings/carousel'
checks['httpsRedirect']=True
assert b'gunicorn' in pathlib.Path('/proc/1/cmdline').read_bytes()
checks['gunicornIsPID1']=True
print(json.dumps(checks))
'''


def synthetic_environment():
    return {
        'ENVIRONMENT': 'production', 'DJANGO_SETTINGS_MODULE': 'config.production',
        'SECRET_KEY': 'synthetic-runtime-secret-' + 'a' * 64,
        'JWT_KEY': 'synthetic-runtime-jwt-' + 'b' * 64,
        'DEBUG': 'false', 'PHONE_CODE_DEMO_MODE': 'false',
        'EMAIL_CODE_DEMO_MODE': 'false', 'WECHAT_BIND_DEMO_MODE': 'false',
        'PUBLIC_BACKEND_URL': 'https://box.example.invalid',
        'SQLITE_PATH': '/data/db.sqlite3', 'MEDIA_ROOT': '/data/media', 'LOG_DIR': '/data/logs',
        'EMAIL_HOST': 'smtp.example.invalid', 'EMAIL_HOST_USER': 'runtime@example.invalid',
        'EMAIL_HOST_PASSWORD': 'synthetic-no-external-service',
        'DEFAULT_FROM_EMAIL': 'runtime@example.invalid', 'EMAIL_PORT': '465',
        'EMAIL_USE_SSL': 'true', 'EMAIL_USE_TLS': 'false',
        'COS_SECRET_ID': 'synthetic-no-external-service',
        'COS_SECRET_KEY': 'synthetic-no-external-service',
        'COS_BUCKET': 'synthetic-0000000000', 'COS_REGION': 'ap-test',
        'COS_KEY_PREFIX': 'xiangsheng-box', 'APP_ID': 'wxsyntheticruntime',
        'APP_SECRET': 'synthetic-no-external-service',
    }


class Docker:
    def __init__(self, context):
        self.prefix = ['docker', '--context', context]

    def call(self, args, check=True, timeout=20):
        try:
            result = subprocess.run(self.prefix + args, capture_output=True, timeout=timeout)
        except subprocess.TimeoutExpired:
            raise SmokeFailure('Bounded Docker operation timed out') from None
        if check and result.returncode:
            raise SmokeFailure('Docker operation failed; output withheld')
        return result

    def inspect(self, name):
        result = self.call(['inspect', name], check=False)
        return json.loads(result.stdout)[0] if result.returncode == 0 else None


def wait_for(docker, command, timeout=120):
    deadline = time.monotonic() + timeout
    while time.monotonic() < deadline:
        result = docker.call(command, check=False, timeout=10)
        if result.returncode == 0:
            return result.stdout
        time.sleep(1)
    raise SmokeFailure('Production readiness timed out; logs withheld')


def asset_path(html):
    sources = re.findall(rb'<script\b[^>]*\bsrc=["\']([^"\']+)["\']', html, re.I)
    for source in sources:
        parsed = urllib.parse.urlsplit(source.decode('utf-8'))
        path = '/' + parsed.path.lstrip('./')
        if (not parsed.scheme and not parsed.netloc and not parsed.query and not parsed.fragment
                and path.startswith('/assets/') and path.endswith('.js')
                and '..' not in urllib.parse.unquote(parsed.path).split('/')):
            return path
    raise SmokeFailure('No local production JavaScript asset found')


def safe_state(docker, names):
    result = {}
    for service, name in names.items():
        try:
            container = docker.inspect(name)
            if container is None:
                result[service] = {'present': False}
                continue
            state = container['State']
            result[service] = {
                'present': True, 'containerId': container['Id'], 'imageId': container['Image'],
                'status': state.get('Status'), 'exitCode': state.get('ExitCode'),
                'oomKilled': state.get('OOMKilled'),
                'health': state.get('Health', {}).get('Status'),
            }
        except Exception:
            result[service] = {'inspectionUnavailable': True}
    return result


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--backend-image', default='guantou-backend:latest')
    parser.add_argument('--frontend-image', default='guantou-frontend-production:latest')
    parser.add_argument('--docker-context', choices=['default', 'orbstack'], default='default')
    args = parser.parse_args()
    docker = Docker(args.docker_context)
    nonce = uuid.uuid4().hex
    label = 'edialect.production-runtime-smoke'
    names = {service: 'ci-production-' + service + '-' + nonce for service in ('backend', 'frontend')}
    receipt = {'fixture': nonce, 'checks': {}, 'network': 'none', 'data': 'synthetic tmpfs only'}
    created = {}
    success = False
    try:
        contexts = json.loads(docker.call(['context', 'inspect', args.docker_context]).stdout)
        if not contexts[0]['Endpoints']['docker']['Host'].startswith('unix://'):
            raise SmokeFailure('Only a local Unix Docker socket is permitted')
        images = {}
        for service in names:
            reference = getattr(args, service + '_image')
            if not re.fullmatch(r'[A-Za-z0-9][A-Za-z0-9_./:@-]+', reference):
                raise SmokeFailure('Invalid image reference')
            image = json.loads(docker.call(['image', 'inspect', reference]).stdout)[0]
            if image['Os'] != 'linux' or image['Architecture'] != 'amd64':
                raise SmokeFailure('Production fixture requires linux/amd64 images')
            images[service] = image['Id']
        for service, name in names.items():
            uid = '1000:1000' if service == 'backend' else '10001:10001'
            command = ['run', '-d', '--pull=never', '--name', name, '--label', label + '=' + nonce,
                       '--network=none', '--user', uid, '--read-only', '--cap-drop=ALL',
                       '--security-opt=no-new-privileges', '--memory=512m', '--memory-swap=512m',
                       '--cpus=1', '--pids-limit=128', '--tmpfs',
                       '/tmp:rw,noexec,nosuid,size=' + ('32m' if service == 'backend' else '16m')]
            if service == 'backend':
                command += ['--tmpfs', '/data:rw,noexec,nosuid,size=64m,uid=1000,gid=1000,mode=0700']
                for key, value in synthetic_environment().items():
                    command += ['--env', key + '=' + value]
            else:
                command += ['--env', 'VITE_BACKEND_URL=']
            created[service] = docker.call(command + [images[service]]).stdout.decode().strip()
        wait_for(docker, ['exec', names['backend'], 'python', '-c', BACKEND_READY])
        receipt['checks'].update(json.loads(docker.call(['exec', names['backend'], 'python', '-c', BACKEND_CHECKS]).stdout))
        if docker.call(['exec', names['backend'], 'id', '-u']).stdout.strip() != b'1000':
            raise SmokeFailure('Backend must use UID 1000')
        receipt['checks']['backendUnprivilegedUID'] = True
        html = wait_for(docker, ['exec', names['frontend'], 'wget', '-qO-', 'http://127.0.0.1:8080/'])
        if b'<html' not in html.lower() or b'VITE_BACKEND_URL_RUNTIME_REPLACEMENT' in html:
            raise SmokeFailure('Production HTML contract failed')
        path = asset_path(html)
        javascript = docker.call(['exec', names['frontend'], 'wget', '-qO-', 'http://127.0.0.1:8080' + path]).stdout
        if (len(javascript) < 100 or b'VITE_BACKEND_URL_RUNTIME_REPLACEMENT' in javascript
                or javascript.lstrip().lower().startswith((b'<!doctype html', b'<html'))):
            raise SmokeFailure('Production JavaScript contract failed')
        if docker.call(['exec', names['frontend'], 'id', '-u']).stdout.strip() != b'10001':
            raise SmokeFailure('Frontend must use UID 10001')
        docker.call(['exec', names['frontend'], 'test', '-s', '/tmp/nginx.pid'])
        receipt['checks'].update(frontendHTMLAndJavaScript=True, frontendWithoutRuntimePlaceholder=True,
                                 nginxNonrootPort8080AndTmpPID=True)
        receipt['containers'] = safe_state(docker, names)
        success = True
    except BaseException as error:
        receipt['errorType'] = type(error).__name__
        if isinstance(error, SmokeFailure):
            receipt['error'] = str(error)
        receipt['containers'] = safe_state(docker, names)
    finally:
        cleaned = True
        for service, name in reversed(list(names.items())):
            try:
                container = docker.inspect(name)
                if container is not None:
                    if (container['Config'].get('Labels', {}).get(label) != nonce
                            or (created.get(service) and container['Id'] != created[service])):
                        raise SmokeFailure('Fixture container identity changed; cleanup refused')
                    docker.call(['rm', '--force', container['Id']])
                if docker.inspect(name) is not None:
                    cleaned = False
            except Exception:
                cleaned = False
        receipt['cleanup'] = 'PASS' if cleaned else 'FAIL: exact fixture cleanup required'
    receipt['result'] = 'PASS' if success and cleaned else 'FAIL'
    print(json.dumps(receipt, indent=2))
    return 0 if receipt['result'] == 'PASS' else 1


if __name__ == '__main__':
    def interrupted(signum, frame):
        raise SmokeFailure('Runtime fixture interrupted')
    signal.signal(signal.SIGTERM, interrupted)
    raise SystemExit(main())
