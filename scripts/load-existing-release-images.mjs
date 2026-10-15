import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'

const sha = process.env.SOURCE_SHA
assert.match(sha ?? '', /^[0-9a-f]{40}$/)
for (const service of ['backend', 'frontend']) {
  const digest = process.env[`${service.toUpperCase()}_DIGEST`]
  if (!digest) continue
  assert.match(digest, /^sha256:[0-9a-f]{64}$/)
  const image = `ghcr.io/e-dialect/xiangsheng-box-${service}`
  try {
    execFileSync('docker', ['pull', '--platform', 'linux/amd64', `${image}@${digest}`])
    execFileSync('docker', ['image', 'tag', `${image}@${digest}`, `${image}:sha-${sha}`])
  } catch {
    throw new Error('Verified existing release image could not be loaded')
  }
}
