#!/usr/bin/env node
// Builds the keyed liturgy propers content store (LITURGY_PLAN.md §B) from the harvested API
// corpus: for every cached date, compute its liturgical identity via the engine, derive its
// readings/propers content keys (src/data/liturgy/contentKey.ts — the SAME rule the runtime
// loader uses), attach Clementine-Vulgate Latin to reading items, dedup across the years that
// share a key, and write chunked JSON + a manifest + a Vite-safe dynamic-import thunk module.
//
// node scripts/liturgy/build-propers.mjs

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { liturgicalDay } from '../../src/utils/liturgy/calendar.ts'
import { readingsKeyFor, propersKeyFor, chunkIdForKey } from '../../src/data/liturgy/contentKey.ts'
import { resolveLatin } from './lib/resolve-latin.mjs'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const CACHE_DIR = path.join(__dirname, '.cache', 'api')
const OUT_DIR = path.join(__dirname, '..', '..', 'src', 'data', 'liturgy', 'propers')

// Dates whose payload is a documented upstream glitch (scripts/liturgy/verify-calendar.mjs
// KNOWN_ANOMALIES) — excluded as CONTENT SOURCES so they can't poison a pool with wrong content:
//  - 2024-03-22: byte-identical duplicate of the Jan 25 "Conversão de São Paulo" payload served on
//    a Friday of Lent week 5, where a privileged Lent feria should have won. The engine correctly
//    computes T:Lent-5-Fri for this date; sourcing it would corrupt that pool with São Paulo content.
//  - 2027-03-27: Easter Vigil payload is missing `evangelho` entirely. The other three harvested
//    Vigils (2024/2025/2026) are complete, so this date is dropped rather than sourcing a
//    known-incomplete entry.
// (2025-01-16/2026-01-15 have a `cor` glitch only — content is fine, kept as sources. 2025-09-02/
// 2026-09-01 lack oracoes.comunhao only — kept; dedup naturally prefers the complete years.)
const EXCLUDE_DATES = new Set(['2024-03-22', '2027-03-27'])

function normWS(s) {
  return typeof s === 'string' ? s.replace(/\s+/g, ' ').trim() : s
}

/** Deep-normalize whitespace on every string field, for signature comparison only (stored content
 * keeps the original text — normalization happens again, identically, in verify-propers.mjs). */
function normalizeDeep(v) {
  if (Array.isArray(v)) return v.map(normalizeDeep)
  if (v && typeof v === 'object') {
    const out = {}
    for (const k of Object.keys(v).sort()) out[k] = normalizeDeep(v[k])
    return out
  }
  return normWS(v)
}

function signatureOf(entry) {
  return JSON.stringify(normalizeDeep(entry))
}

// ---------------------------------------------------------------------------------------------
// 1. Load corpus, compute identity, bucket raw candidate entries per pool key
// ---------------------------------------------------------------------------------------------

const files = fs
  .readdirSync(CACHE_DIR)
  .filter((f) => /^\d{4}-\d{2}-\d{2}\.json$/.test(f))
  .sort()

/** poolName -> Map<key, Array<{date, entry}>> */
const pools = { readings: new Map(), propers: new Map() }

function pushCandidate(poolName, key, date, entry) {
  const pool = pools[poolName]
  if (!pool.has(key)) pool.set(key, [])
  pool.get(key).push({ date, entry })
}

let sourced = 0
let excluded = 0
let unreadable = 0

for (const file of files) {
  const dateStr = file.replace('.json', '')
  if (EXCLUDE_DATES.has(dateStr)) {
    excluded++
    continue
  }
  const raw = JSON.parse(fs.readFileSync(path.join(CACHE_DIR, file), 'utf8'))
  if (!raw.liturgia || !raw.cor) {
    unreadable++
    continue
  }
  const [y, m, dd] = dateStr.split('-').map(Number)
  const date = new Date(y, m - 1, dd)
  const day = liturgicalDay(date)

  const readingsEntry = {}
  if (raw.leituras) {
    for (const field of ['primeiraLeitura', 'segundaLeitura', 'evangelho']) {
      const arr = raw.leituras[field]
      if (Array.isArray(arr) && arr.length) {
        readingsEntry[field] = arr.map((r) => ({ referencia: r.referencia, titulo: r.titulo, texto: r.texto }))
      }
    }
    if (Array.isArray(raw.leituras.salmo) && raw.leituras.salmo.length) {
      readingsEntry.salmo = raw.leituras.salmo.map((s) => ({ referencia: s.referencia, refrao: s.refrao, texto: s.texto }))
    }
    if (Array.isArray(raw.leituras.extras) && raw.leituras.extras.length) {
      readingsEntry.extras = raw.leituras.extras.map((e) => ({ tipo: e.tipo, referencia: e.referencia, titulo: e.titulo, texto: e.texto }))
    }
  }

  const propersEntry = {}
  if (raw.oracoes) {
    const oracoes = {}
    if (raw.oracoes.coleta) oracoes.coleta = raw.oracoes.coleta
    if (raw.oracoes.oferendas) oracoes.oferendas = raw.oracoes.oferendas
    if (raw.oracoes.comunhao) oracoes.comunhao = raw.oracoes.comunhao
    if (Array.isArray(raw.oracoes.extras) && raw.oracoes.extras.length) {
      oracoes.extras = raw.oracoes.extras.map((e) => ({ titulo: e.titulo, texto: e.texto }))
    }
    if (Object.keys(oracoes).length) propersEntry.oracoes = oracoes
  }
  if (raw.antifonas) {
    const antifonas = {}
    if (raw.antifonas.entrada) antifonas.entrada = raw.antifonas.entrada
    if (raw.antifonas.comunhao) antifonas.comunhao = raw.antifonas.comunhao
    if (Object.keys(antifonas).length) propersEntry.antifonas = antifonas
  }

  if (Object.keys(readingsEntry).length) {
    pushCandidate('readings', readingsKeyFor(day), dateStr, readingsEntry)
  }
  if (Object.keys(propersEntry).length) {
    pushCandidate('propers', propersKeyFor(day), dateStr, propersEntry)
  }
  sourced++
}

console.log(`Sourced ${sourced} dates (excluded ${excluded} known-anomalous, ${unreadable} unreadable).`)
console.log(`Distinct readings keys: ${pools.readings.size}, distinct propers keys: ${pools.propers.size}`)

// ---------------------------------------------------------------------------------------------
// 2. Dedup each pool key across the years that share it; report disagreements
// ---------------------------------------------------------------------------------------------

function pickCanonical(candidates) {
  const groups = new Map() // signature -> { dates: [], entry }
  for (const c of candidates) {
    const sig = signatureOf(c.entry)
    if (!groups.has(sig)) groups.set(sig, { dates: [], entry: c.entry })
    groups.get(sig).dates.push(c.date)
  }
  if (groups.size === 1) {
    return { canonical: candidates[0].entry, agreement: true, groups }
  }
  // Prefer the group covering the most source years; tie-break toward the most RECENT date so
  // later (presumably more complete/consistent) harvest formatting wins.
  const sorted = [...groups.values()].sort((a, b) => {
    if (b.dates.length !== a.dates.length) return b.dates.length - a.dates.length
    return b.dates[b.dates.length - 1].localeCompare(a.dates[a.dates.length - 1])
  })
  return { canonical: sorted[0].entry, agreement: false, groups }
}

const canonicalPools = { readings: new Map(), propers: new Map() }
const disagreements = { readings: [], propers: [] }

for (const poolName of ['readings', 'propers']) {
  for (const [key, candidates] of pools[poolName]) {
    const { canonical, agreement, groups } = pickCanonical(candidates)
    canonicalPools[poolName].set(key, canonical)
    if (!agreement) {
      disagreements[poolName].push({
        key,
        groupCount: groups.size,
        totalDates: candidates.length,
        groups: [...groups.entries()].map(([, g]) => ({ dates: g.dates, chars: JSON.stringify(g.entry).length })),
      })
    }
  }
}

console.log(
  `Disagreements: readings ${disagreements.readings.length}/${pools.readings.size} keys, ` +
    `propers ${disagreements.propers.length}/${pools.propers.size} keys (canonical = majority year-group, ties -> most recent).`
)

// ---------------------------------------------------------------------------------------------
// 3. Attach Latin to reading items (readings pool only), cached by referencia
// ---------------------------------------------------------------------------------------------

const latinCache = new Map()
let latinEmpty = 0
let latinWarnings = 0

async function latinFor(referencia) {
  if (latinCache.has(referencia)) return latinCache.get(referencia)
  const { latin, warnings } = await resolveLatin(referencia)
  if (!latin) latinEmpty++
  if (warnings?.length) latinWarnings++
  latinCache.set(referencia, latin)
  return latin
}

async function attachLatin(entry) {
  for (const field of ['primeiraLeitura', 'segundaLeitura', 'evangelho', 'extras']) {
    const arr = entry[field]
    if (!arr) continue
    for (const item of arr) {
      const latin = await latinFor(item.referencia)
      if (latin) item.textoLatim = latin
    }
  }
  if (entry.salmo) {
    for (const item of entry.salmo) {
      const latin = await latinFor(item.referencia)
      if (latin) item.textoLatim = latin
    }
  }
}

for (const entry of canonicalPools.readings.values()) {
  await attachLatin(entry)
}

console.log(`Latin resolved for ${latinCache.size} distinct referências (${latinEmpty} empty, ${latinWarnings} with warnings).`)

// ---------------------------------------------------------------------------------------------
// 4. Chunk by season, write JSON + manifest + Vite-safe dynamic-import thunks
// ---------------------------------------------------------------------------------------------

fs.mkdirSync(OUT_DIR, { recursive: true })
// Clean previously generated chunk files (not manifest.json/chunks.ts — overwritten below anyway)
// so a rerun after a key-rule change doesn't leave stale chunks behind.
for (const f of fs.readdirSync(OUT_DIR)) {
  if (f.endsWith('.json') || f === 'chunks.ts') fs.unlinkSync(path.join(OUT_DIR, f))
}

const chunks = new Map() // chunkId -> { readings: {}, propers: {} }
function chunkFor(id) {
  if (!chunks.has(id)) chunks.set(id, { readings: {}, propers: {} })
  return chunks.get(id)
}

const manifest = { readings: {}, propers: {} }

for (const [key, entry] of canonicalPools.readings) {
  const chunkId = chunkIdForKey(key)
  chunkFor(chunkId).readings[key] = entry
  manifest.readings[key] = chunkId
}
for (const [key, entry] of canonicalPools.propers) {
  const chunkId = chunkIdForKey(key)
  chunkFor(chunkId).propers[key] = entry
  manifest.propers[key] = chunkId
}

let totalBytes = 0
const chunkSizes = []
for (const [id, content] of [...chunks.entries()].sort()) {
  const json = JSON.stringify(content)
  const file = path.join(OUT_DIR, `${id}.json`)
  fs.writeFileSync(file, json)
  totalBytes += Buffer.byteLength(json)
  chunkSizes.push({ id, bytes: Buffer.byteLength(json), readings: Object.keys(content.readings).length, propers: Object.keys(content.propers).length })
}

manifest._meta = {
  generatedBy: 'scripts/liturgy/build-propers.mjs',
  generatedAt: new Date().toISOString(),
  readingsKeys: canonicalPools.readings.size,
  propersKeys: canonicalPools.propers.size,
  chunkCount: chunks.size,
  totalRawBytes: totalBytes,
}
// A .ts module, NOT .json: liturgy.ts's manifest lookup is a plain top-level (static) import, and
// unlike the CHUNK_LOADERS thunks below it can't be routed through the injectable ChunkFetcher —
// it has to work identically, with no import attribute, whether Vite or Node loads it. A static
// `import x from './manifest.json'` hits the exact same Node-vs-browser MIME/attribute mismatch
// chunks.ts's header describes for dynamic imports, but here there's no seam to inject an
// alternative at, so the fix is simpler: don't make it a JSON file at all.
const manifestSrc = [
  '// generated by scripts/liturgy/build-propers.mjs — do not edit by hand.',
  '// A .ts module rather than .json so the static import in ../../liturgy.ts needs no import',
  '// attribute — see chunks.ts for why that matters under Node vs Vite.',
  `export const MANIFEST = ${JSON.stringify(manifest)} as const`,
  '',
].join('\n')
fs.writeFileSync(path.join(OUT_DIR, 'manifest.ts'), manifestSrc)

const chunkIds = [...chunks.keys()].sort()
const thunksSrc = [
  '// generated by scripts/liturgy/build-propers.mjs — do not edit by hand.',
  "// Vite-safe: plain dynamic import() of a .json file, NO import attribute. Vite/Rollup inline",
  '// JSON into a JS module at build time regardless (verified: the emitted dynamic-import chunk is',
  "// already .js, not .json), and the dev server serves it as `text/javascript` — an import",
  "// attribute of `{ with: { type: 'json' } }` here would make a real browser reject that response",
  '// (MIME mismatch) even though it round-trips fine at build time. Node executing this file',
  "// directly would fail (`ERR_IMPORT_ATTRIBUTE_MISSING`) for the same reason browsers would reject",
  "// the attributed form — which is why resolveLiturgyForDate() accepts an injectable ChunkFetcher:",
  '// Node-side callers (verify-propers.mjs, coverage-report.mjs) supply an fs-based one instead of',
  '// importing this module at all.',
  'export const CHUNK_LOADERS = {',
  ...chunkIds.map((id) => `  '${id}': () => import('./${id}.json'),`),
  '}',
  '',
].join('\n')
fs.writeFileSync(path.join(OUT_DIR, 'chunks.ts'), thunksSrc)

console.log(`\nWrote ${chunks.size} chunks to ${path.relative(process.cwd(), OUT_DIR)}:`)
for (const c of chunkSizes) {
  console.log(`  ${c.id}.json: ${(c.bytes / 1024).toFixed(1)} KB (${c.readings} readings keys, ${c.propers} propers keys)`)
}
console.log(`Total raw JSON: ${(totalBytes / 1024 / 1024).toFixed(2)} MB`)

if (disagreements.readings.length) {
  console.log(`\n=== READINGS disagreements (${disagreements.readings.length}) ===`)
  for (const d of disagreements.readings) {
    console.log(`  ${d.key}: ${d.groupCount} distinct versions across ${d.totalDates} years`)
    for (const g of d.groups) console.log(`    [${g.chars}ch] ${g.dates.join(', ')}`)
  }
}
if (disagreements.propers.length) {
  console.log(`\n=== PROPERS disagreements (${disagreements.propers.length}) ===`)
  for (const d of disagreements.propers) {
    console.log(`  ${d.key}: ${d.groupCount} distinct versions across ${d.totalDates} years`)
    for (const g of d.groups) console.log(`    [${g.chars}ch] ${g.dates.join(', ')}`)
  }
}
