#!/usr/bin/env node
// Battery test for resolveLatin() over real lectionary citations.
// BUILD-TIME ONLY.

import { readdir, readFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { resolveLatin } from './lib/resolve-latin.mjs'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const API_CACHE_DIR = path.join(__dirname, '.cache', 'api')

const FALLBACK_BATTERY = [
  'Mc 1,14-20',
  'Lc 2,22-32.39-40',
  'Sl 95(96)',
  'Is 52,7-10',
  'Hb 1,1-6',
  'Jo 1,1-18',
  'Eclo 3,3-7.14-17a',
  'Tb 12,1.5-15.20',
  'Est 4,17',
]

async function collectFromCache() {
  let files = []
  try {
    files = await readdir(API_CACHE_DIR)
  } catch {
    return []
  }
  const refs = new Set()
  for (const f of files) {
    if (!f.endsWith('.json')) continue
    try {
      const d = JSON.parse(await readFile(path.join(API_CACHE_DIR, f), 'utf8'))
      const buckets = [
        d?.leituras?.primeiraLeitura,
        d?.leituras?.segundaLeitura,
        d?.leituras?.evangelho,
        d?.leituras?.salmo,
        d?.leituras?.extras,
      ]
      for (const b of buckets) {
        for (const item of b ?? []) {
          if (item?.referencia) refs.add(item.referencia)
        }
      }
    } catch {
      // ignore malformed cache file
    }
  }
  return [...refs]
}

async function main() {
  const cached = await collectFromCache()
  const battery = cached.length ? cached : FALLBACK_BATTERY
  console.log(`[test-vulgate] running battery of ${battery.length} refs (source: ${cached.length ? 'cached API files' : 'fallback list'})\n`)

  let failCount = 0
  const results = []
  for (const ref of battery) {
    const { latin, segments, warnings } = await resolveLatin(ref)
    const ok = latin.length > 0
    if (!ok) failCount++
    results.push({ ref, latin, segments, warnings, ok })
    const status = ok ? 'OK  ' : 'FAIL'
    console.log(`[${status}] ${ref}`)
    if (warnings.length) {
      for (const w of warnings) console.log(`         warn: ${w}`)
    }
    if (ok) {
      const preview = latin.length > 140 ? latin.slice(0, 140) + '…' : latin
      console.log(`         ${preview}`)
    }
  }

  console.log(`\n[test-vulgate] ${battery.length - failCount}/${battery.length} produced non-empty Latin`)
  if (failCount > 0) {
    console.log(`[test-vulgate] ${failCount} FAILED (empty Latin) — see FAIL lines above`)
    process.exitCode = 1
  }
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
