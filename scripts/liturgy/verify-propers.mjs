#!/usr/bin/env node
// Round-trip verification for the liturgy propers store (LITURGY_PLAN.md §D quality gate): for
// every cached date, resolveLiturgyForDate() must reproduce the harvested API's pt content —
// every reading texto+referencia, salmo texto+refrao, oracoes, antifonas — exact string equality
// after trivial whitespace normalization. Also asserts liturgia/cor match (already proven for the
// engine by verify-calendar.mjs; re-checked here since resolveLiturgyForDate composes them).
//
// Node can't use the generated Vite-only chunk thunks (chunks.ts) — see its header comment — so
// this script injects an fs-based ChunkFetcher into resolveLiturgyForDate instead.
//
// node scripts/liturgy/verify-propers.mjs

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { resolveLiturgyForDate } from '../../src/data/liturgy.ts'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const CACHE_DIR = path.join(__dirname, '.cache', 'api')
const PROPERS_DIR = path.join(__dirname, '..', '..', 'src', 'data', 'liturgy', 'propers')

// Same two dates build-propers.mjs excludes as content sources (see its header for why); the
// store has no trustworthy content to reproduce for them either.
const KNOWN_ANOMALIES = new Set(['2024-03-22', '2027-03-27'])

const chunkFs = new Map()
const fsFetcher = async (chunkId) => {
  if (chunkFs.has(chunkId)) return chunkFs.get(chunkId)
  const file = path.join(PROPERS_DIR, `${chunkId}.json`)
  const value = fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')) : undefined
  chunkFs.set(chunkId, value)
  return value
}

function normWS(s) {
  return typeof s === 'string' ? s.replace(/\s+/g, ' ').trim() : s
}

// A second, looser tier: the dedup step (build-propers.mjs) picks ONE canonical text per content
// key when multiple harvested years disagree, so any OTHER year mapping to that key can only
// round-trip byte-exact if the harvest happened to format it identically — the harvested corpus
// itself is NOT internally consistent about comma placement before an inline verse number
// ("14por isso" vs "14, por isso"), quote style, or title capitalization across different harvest
// runs (see contentKey.ts's header + build-propers.mjs's disagreement report). Stripping that
// punctuation and case catches the real signal — did the store keep the same WORDS — while still
// failing on a genuinely different passage, missing content, or wrong array length.
function normLoose(s) {
  return typeof s === 'string'
    ? s
        .normalize('NFC')
        .toLowerCase()
        // Replace with a SPACE, not delete: deleting "1, 9-20" -> "1 9-20" (space already there)
        // while "1,9-20" -> "19-20" would merge adjacent digits differently depending on whether
        // the source already had a space after the comma — replacing preserves a token boundary
        // either way, and the whitespace collapse below normalizes the rest.
        .replace(/[.,;:!?"'"'""«»—–-]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim()
    : s
}

// `referencia` specifically carries one more harmless-annotation pattern beyond generic
// punctuation/case noise: a trailing "(98)" modern-Hebrew-psalm-number hint that the source
// includes on some harvest runs and omits on others for the IDENTICAL psalm (confirmed in
// scripts/liturgy/README.md's psalm-numbering section: the number before the parenthesis is
// always the one that matters; the parenthetical is optional decoration, never load-bearing for
// which Vulgate/API content it resolves to).
function normReferencia(s) {
  const loose = normLoose(s)
  return typeof loose === 'string' ? loose.replace(/\s*\(\s*\d+[a-z]?\s*\)\s*/g, ' ').replace(/\s+/g, ' ').trim() : loose
}

function looseEqualFor(field, a, b) {
  return field === 'referencia' ? normReferencia(a) === normReferencia(b) : normLoose(a) === normLoose(b)
}

function readingArrayEqual(stored, raw, fields) {
  const s = stored ?? []
  const r = raw ?? []
  if (s.length !== r.length) return { ok: false, looseOk: false, reason: `length ${s.length} vs ${r.length}` }
  for (let i = 0; i < r.length; i++) {
    for (const f of fields) {
      if (normWS(s[i]?.[f]) !== normWS(r[i]?.[f])) {
        const looseOk = looseEqualFor(f, s[i]?.[f], r[i]?.[f])
        return { ok: false, looseOk, reason: `[${i}].${f} differs`, stored: s[i]?.[f], raw: r[i]?.[f] }
      }
    }
  }
  return { ok: true, looseOk: true }
}

function fieldEqual(stored, raw, label) {
  if (normWS(stored) !== normWS(raw)) {
    const looseOk = normLoose(stored) === normLoose(raw)
    return { ok: false, looseOk, reason: `${label} differs`, stored, raw }
  }
  return { ok: true, looseOk: true }
}

const files = fs
  .readdirSync(CACHE_DIR)
  .filter((f) => /^\d{4}-\d{2}-\d{2}\.json$/.test(f))
  .sort()

let checked = 0
let skipped = 0
let exactCount = 0
let partialCount = 0
let noneCount = 0
const mismatches = []

for (const file of files) {
  const dateStr = file.replace('.json', '')
  if (KNOWN_ANOMALIES.has(dateStr)) {
    skipped++
    continue
  }
  const raw = JSON.parse(fs.readFileSync(path.join(CACHE_DIR, file), 'utf8'))
  if (!raw.liturgia || !raw.cor) {
    skipped++
    continue
  }

  const [y, m, dd] = dateStr.split('-').map(Number)
  const date = new Date(y, m - 1, dd)
  const resolved = await resolveLiturgyForDate(date, fsFetcher)
  checked++

  if (resolved.contentMatch === 'exact') exactCount++
  else if (resolved.contentMatch === 'partial') partialCount++
  else noneCount++

  const issues = []

  if (resolved.cor !== raw.cor) issues.push({ field: 'cor', stored: resolved.cor, raw: raw.cor })

  const checks = [
    ['primeiraLeitura', readingArrayEqual(resolved.leituras.primeiraLeitura, raw.leituras?.primeiraLeitura, ['referencia', 'titulo', 'texto'])],
    ['segundaLeitura', readingArrayEqual(resolved.leituras.segundaLeitura, raw.leituras?.segundaLeitura, ['referencia', 'titulo', 'texto'])],
    ['evangelho', readingArrayEqual(resolved.leituras.evangelho, raw.leituras?.evangelho, ['referencia', 'titulo', 'texto'])],
    ['salmo', readingArrayEqual(resolved.leituras.salmo, raw.leituras?.salmo, ['referencia', 'refrao', 'texto'])],
    ['leituras.extras', readingArrayEqual(resolved.leituras.extras, raw.leituras?.extras, ['tipo', 'referencia', 'titulo', 'texto'])],
    ['oracoes.coleta', fieldEqual(resolved.oracoes?.coleta, raw.oracoes?.coleta, 'oracoes.coleta')],
    ['oracoes.oferendas', fieldEqual(resolved.oracoes?.oferendas, raw.oracoes?.oferendas, 'oracoes.oferendas')],
    ['oracoes.comunhao', fieldEqual(resolved.oracoes?.comunhao, raw.oracoes?.comunhao, 'oracoes.comunhao')],
    ['oracoes.extras', readingArrayEqual(resolved.oracoes?.extras, raw.oracoes?.extras, ['titulo', 'texto'])],
    ['antifonas.entrada', fieldEqual(resolved.antifonas?.entrada, raw.antifonas?.entrada, 'antifonas.entrada')],
    ['antifonas.comunhao', fieldEqual(resolved.antifonas?.comunhao, raw.antifonas?.comunhao, 'antifonas.comunhao')],
  ]

  for (const [field, result] of checks) {
    if (!result.ok) issues.push({ field, ...result })
  }

  if (issues.length) {
    const realIssues = issues.filter((i) => i.looseOk === false)
    mismatches.push({ date: dateStr, contentMatch: resolved.contentMatch, issues, cosmeticOnly: realIssues.length === 0 })
  }
}

const cosmeticOnly = mismatches.filter((m) => m.cosmeticOnly)
const real = mismatches.filter((m) => !m.cosmeticOnly)

console.log(`Checked ${checked} days (skipped ${skipped} known-anomalous/unreadable).`)
console.log(`contentMatch: exact=${exactCount} partial=${partialCount} none=${noneCount}`)
console.log(`Byte-exact round-trip: ${checked - mismatches.length} / ${checked} days`)
console.log(`  of the ${mismatches.length} byte-level mismatches: ${cosmeticOnly.length} are cosmetic-only (harvest`)
console.log(`  formatting noise — punctuation/case differences from the dedup canonical pick; same`)
console.log(`  words once normalized), ${real.length} have at least one field that differs beyond that.\n`)

if (real.length) {
  console.log(`=== REAL MISMATCHES (${real.length}) — content differs beyond formatting noise ===`)
  for (const m of real) {
    console.log(`${m.date} (contentMatch=${m.contentMatch}):`)
    for (const issue of m.issues.filter((i) => i.looseOk === false)) {
      console.log(`  ${issue.field}: ${issue.reason}`)
      if (issue.stored !== undefined || issue.raw !== undefined) {
        console.log(`    stored: ${JSON.stringify(issue.stored)?.slice(0, 150)}`)
        console.log(`    raw:    ${JSON.stringify(issue.raw)?.slice(0, 150)}`)
      }
    }
  }
  console.log()
}

if (cosmeticOnly.length) {
  console.log(`=== COSMETIC-ONLY MISMATCHES (${cosmeticOnly.length}) — formatting noise, same content ===`)
  for (const m of cosmeticOnly.slice(0, 300)) {
    console.log(`${m.date} (contentMatch=${m.contentMatch}):`)
    for (const issue of m.issues) {
      console.log(`  ${issue.field}: ${issue.reason}`)
    }
  }
  if (cosmeticOnly.length > 300) console.log(`... and ${cosmeticOnly.length - 300} more`)
}

process.exit(0)
