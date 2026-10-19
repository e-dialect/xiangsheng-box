import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { appendFile, readFile } from 'node:fs/promises'
import { existingImageDigest, inspectImage, verifiedRuntimeImages, verifyImage } from './release-image.mjs'

const sha = process.env.SOURCE_SHA
assert.match(sha ?? '', /^[0-9a-f]{40}$/)
assert.ok(process.env.GITHUB_OUTPUT, 'GitHub output path required')
const tested = verifiedRuntimeImages(JSON.parse(await readFile(process.argv[2] || 'release/production-runtime.json')))
function docker(args) {
  try { return execFileSync('docker', args).toString().trim() }
  catch { throw new Error('Exact-image publication operation failed; diagnostics withheld') }
}
for (const service of ['backend', 'frontend']) {
  const image = `ghcr.io/e-dialect/xiangsheng-box-${service}`
  const reference = `${image}:sha-${sha}`
  assert.equal(docker(['image', 'inspect', '--format', '{{.Id}}', reference]), tested[service], 'Local source tag changed after smoke')
  // Recheck immediately before each push. Existing SHA tags are only reused,
  // never replaced, including a previous run's partial publication.
  let digest = await existingImageDigest(service, sha, process.env.BUILD_DATE)
  if (!digest) {
    docker(['image', 'push', reference])
    digest = docker(['buildx', 'imagetools', 'inspect', reference, '--format', '{{.Manifest.Digest}}'])
    assert.match(digest, /^sha256:[0-9a-f]{64}$/)
  }
  const { raw, configRaw } = await inspectImage(service, digest, sha, process.env.BUILD_DATE)
  const published = verifyImage(raw, configRaw, digest, sha, process.env.BUILD_DATE)
  assert.equal(published, tested[service], 'Published raw config differs from the smoke-tested image')
  await appendFile(process.env.GITHUB_OUTPUT, `${service}_digest=${digest}\n`)
}
