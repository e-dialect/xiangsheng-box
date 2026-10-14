import assert from 'node:assert/strict'
import { appendFile } from 'node:fs/promises'
import { inspectImage } from './release-image.mjs'

const sourceSHA = process.env.SOURCE_SHA
assert.match(sourceSHA ?? '', /^[0-9a-f]{40}$/)
assert.ok(process.env.GHCR_TOKEN, 'Registry credentials required')
assert.ok(process.env.GITHUB_OUTPUT, 'GitHub output path required')
assert.match(process.env.BUILD_DATE ?? '', /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/)
const tag = `sha-${sourceSHA}`
for (const service of ['backend', 'frontend']) {
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
    await inspectImage(service, digest, sourceSHA, process.env.BUILD_DATE)
  }
  // Never replace a source tag. Verified existing objects are reused by digest;
  // only a missing service is built, so partial publications are recoverable.
  await appendFile(process.env.GITHUB_OUTPUT, `${service}_digest=${digest}\n`)
  console.log(`${service}: ${digest ? 'verified existing immutable image' : 'new build required'}`)
}
