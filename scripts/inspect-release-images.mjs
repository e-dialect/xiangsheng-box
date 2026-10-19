import assert from 'node:assert/strict'
import { mkdir, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { inspectImage } from './release-image.mjs'

const directory = process.argv[2] || 'release'
assert.match(process.env.SOURCE_SHA ?? '', /^[0-9a-f]{40}$/)
await mkdir(directory, { recursive: true })
for (const service of ['backend', 'frontend']) {
  const digest = process.env[`${service.toUpperCase()}_DIGEST`]
  const { raw, configRaw } = await inspectImage(service, digest, process.env.SOURCE_SHA, process.env.BUILD_DATE)
  await writeFile(join(directory, `${service}-manifest.json`), raw)
  await writeFile(join(directory, `${service}-config.json`), configRaw)
}
