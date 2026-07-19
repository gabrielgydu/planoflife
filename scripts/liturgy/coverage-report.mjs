#!/usr/bin/env node
// Perpetual-replay coverage report (LITURGY_PLAN.md): runs the calendar engine over every date
// 2026-01-01..2035-12-31 (ten years — spans every sundayCycle/weekdayCycle combination several
// times over, well past the 2024-2027 harvest window this store was built from) and resolves each
// day through the SAME key rule + fallback chain the app uses, tallying contentMatch and listing
// the distinct missing identities behind the 'none'/'partial' classes.
//
// node scripts/liturgy/coverage-report.mjs

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { resolveLiturgyForDate } from '../../src/data/liturgy.ts'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const PROPERS_DIR = path.join(__dirname, '..', '..', 'src', 'data', 'liturgy', 'propers')

const chunkFs = new Map()
const fsFetcher = async (chunkId) => {
  if (chunkFs.has(chunkId)) return chunkFs.get(chunkId)
  const file = path.join(PROPERS_DIR, `${chunkId}.json`)
  const value = fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')) : undefined
  chunkFs.set(chunkId, value)
  return value
}

const START = new Date(2026, 0, 1)
const END = new Date(2035, 11, 31)

let total = 0
const counts = { exact: 0, partial: 0, none: 0 }
const missingReadings = new Map() // celebration -> count
const missingPropers = new Map()

for (let d = new Date(START); d <= END; d = new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1)) {
  const resolved = await resolveLiturgyForDate(d, fsFetcher)
  total++
  counts[resolved.contentMatch]++

  const hasReadings = Object.values(resolved.leituras).some((v) => v)
  const hasPropers = resolved.oracoes || resolved.antifonas

  if (!hasReadings) {
    missingReadings.set(resolved.liturgia, (missingReadings.get(resolved.liturgia) ?? 0) + 1)
  }
  if (!hasPropers) {
    missingPropers.set(resolved.liturgia, (missingPropers.get(resolved.liturgia) ?? 0) + 1)
  }
}

console.log(`Coverage 2026-01-01 .. 2035-12-31: ${total} days`)
console.log(`  exact:   ${counts.exact} (${((100 * counts.exact) / total).toFixed(2)}%)`)
console.log(`  partial: ${counts.partial} (${((100 * counts.partial) / total).toFixed(2)}%)`)
console.log(`  none:    ${counts.none} (${((100 * counts.none) / total).toFixed(2)}%)`)

if (missingReadings.size) {
  console.log(`\n=== Distinct celebrations with NO readings at all (${missingReadings.size}) ===`)
  for (const [name, n] of [...missingReadings.entries()].sort((a, b) => b[1] - a[1])) {
    console.log(`  ${n}x  ${name}`)
  }
}
if (missingPropers.size) {
  console.log(`\n=== Distinct celebrations with NO orações/antífonas at all (${missingPropers.size}) ===`)
  for (const [name, n] of [...missingPropers.entries()].sort((a, b) => b[1] - a[1])) {
    console.log(`  ${n}x  ${name}`)
  }
}
