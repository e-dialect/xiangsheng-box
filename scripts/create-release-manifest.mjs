import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { readFile, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { hash, verifyImage } from './release-image.mjs'

const directory = process.argv[2] || 'release'
const sourceSHA = process.env.SOURCE_SHA
assert.match(sourceSHA ?? '', /^[0-9a-f]{40}$/)
const git = (...args) => execFileSync('git', args)
assert.equal(git('rev-parse', 'HEAD').toString().trim(), sourceSHA, 'Manifest must describe checked-out source')
assert.equal(process.env.VERSION, `sha-${sourceSHA}`)
assert.match(process.env.BUILD_DATE ?? '', /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/)
const commitDate = new Date(Number(git('show', '-s', '--format=%ct', sourceSHA).toString().trim()) * 1000).toISOString().replace('.000Z', 'Z')
assert.equal(process.env.BUILD_DATE, commitDate, 'Retry must use the same commit-time build stamp')
const images = {}
for (const service of ['backend', 'frontend']) {
  const raw = await readFile(join(directory, `${service}-manifest.json`))
  const configRaw = await readFile(join(directory, `${service}-config.json`))
  const digest = process.env[`${service.toUpperCase()}_DIGEST`]
  const configDigest = verifyImage(raw, configRaw, digest, sourceSHA, commitDate)
  images[service] = {
    image: `ghcr.io/e-dialect/xiangsheng-box-${service}`,
    tag: `sha-${sourceSHA}`,
    digest,
    configDigest,
    platform: 'linux/amd64',
    revision: sourceSHA,
  }
}
const requirements = git('show', `${sourceSHA}:backend/guantou/requirements.txt`).toString()
const djangoVersion = requirements.match(/^django==([^\s#]+)\s*$/mi)?.[1]
assert.ok(djangoVersion, 'Django version must be pinned explicitly')
// Canonical digest: SHA256 of UTF-8 JSON.stringify(sorted [{path,sha256}]),
// no final newline; include every tracked app migration module, including init.
const migrations = git('ls-tree', '-rz', '--full-tree', sourceSHA, '--', 'backend/guantou')
  .toString().split('\0').filter(Boolean).flatMap(entry => {
    const [metadata, path] = entry.split('\t')
    if (!/^backend\/guantou\/[^/]+\/migrations\/[^/]+\.py$/.test(path)) return []
    const [mode, type, object] = metadata.split(' ')
    assert.ok(['100644', '100755'].includes(mode) && type === 'blob', 'Migration input must be a tracked regular file')
    return [{ path, sha256: hash(git('cat-file', 'blob', object)).slice(7) }]
  }).sort((a, b) => a.path < b.path ? -1 : a.path > b.path ? 1 : 0)
assert.ok(migrations.length > 0, 'Migration inventory must not be empty')
const release = {
  schemaVersion: 1,
  repository: 'e-dialect/xiangsheng-box',
  sourceSHA,
  branch: 'main',
  platform: 'linux/amd64',
  workflowRunId: process.env.GITHUB_RUN_ID,
  ciRunId: process.env.CI_RUN_ID,
  createdAt: new Date().toISOString(),
  build: {
    frontend: { VITE_BACKEND_URL: '' },
    backend: {},
  },
  recovery: {
    kind: 'django-sqlite', djangoVersion, dataFormat: 'django-sqlite-media',
    migrationDigest: hash(Buffer.from(JSON.stringify(migrations))),
    compatibility: 'server-local-attestation-required', rollbackSafe: false,
  },
  images,
}
await writeFile(join(directory, 'release-manifest.json'), `${JSON.stringify(release, null, 2)}\n`)
