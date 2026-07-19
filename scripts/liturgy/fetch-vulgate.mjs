#!/usr/bin/env node
// Downloads the Clementine Vulgate (public domain, includes the deuterocanon)
// as structured JSON into the build-time cache. BUILD-TIME ONLY — never
// imported by the app. Idempotent: skips the download if the raw file is
// already cached; pass --force to re-fetch.
//
// Source: scrollmapper/bible_databases, VulgClementine.json (the Clementine
// Vulgate, one of five Vulgate editions that repo ships — see README.md for
// why this one was chosen over VulgHetzenauer/VulgSistine/VulgConte/Vulgate).

import { mkdir, writeFile, stat } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const CACHE_DIR = path.join(__dirname, '.cache', 'vulgate')
const RAW_PATH = path.join(CACHE_DIR, 'VulgClementine.raw.json')
const SOURCE_URL =
  'https://raw.githubusercontent.com/scrollmapper/bible_databases/master/formats/json/VulgClementine.json'

async function exists(p) {
  try {
    await stat(p)
    return true
  } catch {
    return false
  }
}

async function main() {
  const force = process.argv.includes('--force')
  await mkdir(CACHE_DIR, { recursive: true })

  if (!force && (await exists(RAW_PATH))) {
    console.log(`[fetch-vulgate] already cached: ${RAW_PATH} (use --force to re-fetch)`)
    return
  }

  console.log(`[fetch-vulgate] fetching ${SOURCE_URL}`)
  const res = await fetch(SOURCE_URL)
  if (!res.ok) {
    throw new Error(`[fetch-vulgate] fetch failed: HTTP ${res.status} ${res.statusText}`)
  }
  const text = await res.text()
  await writeFile(RAW_PATH, text, 'utf8')
  console.log(`[fetch-vulgate] saved ${text.length} bytes to ${RAW_PATH}`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
