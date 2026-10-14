import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'

export const hash = bytes => `sha256:${createHash('sha256').update(bytes).digest('hex')}`
const CONFIG_LIMIT = 1024 * 1024

function parseManifest(raw, digest) {
  assert.match(digest ?? '', /^sha256:[0-9a-f]{64}$/)
  assert.ok(hash(raw) === digest || (raw.at(-1) === 10 && hash(raw.subarray(0, -1)) === digest), 'Registry manifest digest mismatch')
  let manifest
  try { manifest = JSON.parse(raw) } catch { throw new Error('Invalid registry manifest JSON') }
  assert.ok(['application/vnd.oci.image.manifest.v1+json', 'application/vnd.docker.distribution.manifest.v2+json'].includes(manifest.mediaType), 'A single-platform image manifest is required')
  assert.match(manifest.config?.digest ?? '', /^sha256:[0-9a-f]{64}$/)
  assert.ok(Number.isSafeInteger(manifest.config.size) && manifest.config.size > 0 && manifest.config.size <= CONFIG_LIMIT, 'Invalid image config size')
  return manifest
}

export function verifyImage(raw, configRaw, digest, sourceSHA, buildDate) {
  const manifest = parseManifest(raw, digest)
  assert.equal(configRaw.length, manifest.config.size, 'Raw image config size mismatch')
  assert.equal(hash(configRaw), manifest.config.digest, 'Raw image config digest mismatch')
  let config
  try { config = JSON.parse(configRaw) } catch { throw new Error('Invalid raw image config JSON') }
  assert.ok(config.os === 'linux', 'Image must use linux')
  assert.ok(config.architecture === 'amd64', 'Image must use amd64')
  const expected = {
    'org.opencontainers.image.revision': sourceSHA,
    'org.opencontainers.image.source': 'https://github.com/e-dialect/xiangsheng-box',
    'org.opencontainers.image.version': `sha-${sourceSHA}`,
    'org.opencontainers.image.created': buildDate,
  }
  for (const [key, value] of Object.entries(expected)) {
    assert.ok(config.config?.Labels?.[key] === value, `Image label mismatch: ${key}`)
  }
  return manifest.config.digest
}

async function request(url, options = {}) {
  try {
    return await fetch(url, { ...options, signal: AbortSignal.timeout(30000) })
  } catch {
    // Do not expose bearer credentials or signed blob redirect URLs in errors.
    throw new Error('Official registry request failed')
  }
}

export async function inspectImage(service, digest, sourceSHA, buildDate) {
  assert.ok(['backend', 'frontend'].includes(service))
  assert.match(digest ?? '', /^sha256:[0-9a-f]{64}$/)
  assert.ok(process.env.GHCR_TOKEN && process.env.GITHUB_ACTOR, 'Official registry credentials required')
  const repository = `e-dialect/xiangsheng-box-${service}`
  let raw
  try {
    raw = execFileSync('docker', ['buildx', 'imagetools', 'inspect', `ghcr.io/${repository}@${digest}`, '--raw'])
  } catch {
    throw new Error('Cannot read immutable registry manifest')
  }
  const manifest = parseManifest(raw, digest)
  const query = new URLSearchParams({ service: 'ghcr.io', scope: `repository:${repository}:pull` })
  const auth = Buffer.from(`${process.env.GITHUB_ACTOR}:${process.env.GHCR_TOKEN}`).toString('base64')
  const tokenResponse = await request(`https://ghcr.io/token?${query}`, { headers: { Authorization: `Basic ${auth}` }, redirect: 'error' })
  assert.ok(tokenResponse.ok, `Registry authentication failed (${tokenResponse.status})`)
  let tokenBody
  try { tokenBody = await tokenResponse.json() } catch { throw new Error('Invalid registry authentication response') }
  const token = tokenBody.token ?? tokenBody.access_token
  assert.ok(typeof token === 'string' && token.length > 0, 'Registry pull token missing')
  let response = await request(`https://ghcr.io/v2/${repository}/blobs/${manifest.config.digest}`, {
    headers: { Authorization: `Bearer ${token}` }, redirect: 'manual',
  })
  if ([302, 307].includes(response.status)) {
    let target
    try { target = new URL(response.headers.get('location')) } catch { throw new Error('Invalid registry blob redirect') }
    assert.ok(target.protocol === 'https:' && target.hostname === 'pkg-containers.githubusercontent.com' && !target.username && !target.password, 'Untrusted registry blob redirect')
    // Signed GitHub blob URL only; never forward registry authorization.
    response = await request(target, { redirect: 'error' })
  }
  assert.ok(response.ok, `Registry config request failed (${response.status})`)
  const reader = response.body.getReader()
  const chunks = []
  let size = 0
  while (true) {
    let chunk
    try { chunk = await reader.read() } catch { throw new Error('Registry config stream failed') }
    const { done, value } = chunk
    if (done) break
    size += value.length
    if (size > CONFIG_LIMIT) { await reader.cancel(); throw new Error('Registry config exceeded size limit') }
    chunks.push(Buffer.from(value))
  }
  const configRaw = Buffer.concat(chunks)
  verifyImage(raw, configRaw, digest, sourceSHA, buildDate)
  return { raw, configRaw }
}

export async function existingImageDigest(service, sourceSHA, buildDate) {
  assert.ok(['backend', 'frontend'].includes(service))
  assert.match(sourceSHA ?? '', /^[0-9a-f]{40}$/)
  assert.ok(process.env.GHCR_TOKEN, 'Registry credentials required')
  const tag = `sha-${sourceSHA}`
  const matches = []
  for (let page = 1; ; page += 1) {
    const response = await fetch(`https://api.github.com/orgs/e-dialect/packages/container/xiangsheng-box-${service}/versions?per_page=100&page=${page}`, {
      headers: {
        Authorization: `Bearer ${process.env.GHCR_TOKEN}`,
        Accept: 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
      },
    })
    // A new package returns 404. All other failures block publication.
    if (response.status === 404 && page === 1) break
    assert.ok(response.ok, `Cannot establish existing image identity (${response.status})`)
    const versions = await response.json()
    assert.ok(Array.isArray(versions), 'Invalid package-version response')
    matches.push(...versions.filter(version => version.metadata?.container?.tags?.includes(tag)))
    if (versions.length < 100) break
  }
  assert.ok(matches.length <= 1, 'Source tag must identify exactly one registry version')
  let digest = ''
  if (matches.length) {
    digest = matches[0].name
    assert.match(digest ?? '', /^sha256:[0-9a-f]{64}$/)
    await inspectImage(service, digest, sourceSHA, buildDate)
  }
  return digest
}

export function verifiedRuntimeImages(receipt) {
  assert.ok(receipt.result === 'PASS' && receipt.cleanup === 'PASS' && receipt.phase === 'complete', 'Exact production image pair did not pass smoke')
  const required = ['capabilitiesWithoutTLSRedirect', 'productionAdminStaticCSS', 'untrustedHostRejected', 'corsExactOrigin', 'phoneDemoDisabled', 'httpsRedirect', 'gunicornIsPID1', 'backendUnprivilegedUID', 'productionStateDefaults', 'frontendHTMLAndJavaScript', 'frontendWithoutRuntimePlaceholder', 'nginxNonrootPort8080AndTmpPID']
  assert.ok(required.every(key => receipt.checks?.[key] === true), 'Production runtime acceptance incomplete')
  const images = {}
  for (const service of ['backend', 'frontend']) {
    const container = receipt.containers?.[service]
    assert.ok(container?.present === true && container.status === 'running', 'Smoke container was not running')
    assert.match(container.imageId ?? '', /^sha256:[0-9a-f]{64}$/)
    images[service] = container.imageId
  }
  return images
}
