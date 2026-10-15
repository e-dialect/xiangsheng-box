import assert from 'node:assert/strict'
import { appendFile } from 'node:fs/promises'
import { existingImageDigest } from './release-image.mjs'

const sourceSHA = process.env.SOURCE_SHA
assert.match(sourceSHA ?? '', /^[0-9a-f]{40}$/)
assert.ok(process.env.GHCR_TOKEN, 'Registry credentials required')
assert.ok(process.env.GITHUB_OUTPUT, 'GitHub output path required')
assert.match(process.env.BUILD_DATE ?? '', /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/)
for (const service of ['backend', 'frontend']) {
  const digest = await existingImageDigest(service, sourceSHA, process.env.BUILD_DATE)
  // Never replace a source tag. Verified existing objects are reused by digest;
  // only a missing service is built, so partial publications are recoverable.
  await appendFile(process.env.GITHUB_OUTPUT, `${service}_digest=${digest}\n`)
  console.log(`${service}: ${digest ? 'verified existing immutable image' : 'new build required'}`)
}
