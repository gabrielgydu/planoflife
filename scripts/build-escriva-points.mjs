#!/usr/bin/env node
/**
 * Build the bundled Escrivá points used by the Meditação practice.
 *
 * Source of truth is the `om` CLI's on-disk cache (~/.cache/om/{book}_{num}.txt),
 * which the `cache-all.sh` script in the `om` repo populates by scraping
 * escriva.org once. This script just folds that cache into a single JSON the app
 * ships — so the build does NOT hit escriva.org, and the app works fully offline.
 *
 * Point counts (the books differ in length — a single drawn number won't resolve
 * in all three; the reader renders "(sem ponto)" for a missing card, matching om):
 *   Caminho  1–999
 *   Sulco    1–1000
 *   Forja    1–1055
 *
 * Output shape (keyed by book, then by point number as a string):
 *   { caminho: { "1": "…", … }, sulco: { … }, forja: { … } }
 *
 * Re-run after a fresh `cache-all.sh` if escriva.org content ever changes:
 *   node scripts/build-escriva-points.mjs
 */
import { readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))

const CACHE_DIR =
  process.env.OM_CACHE_DIR ??
  join(process.env.XDG_CACHE_HOME ?? join(homedir(), '.cache'), 'om')

const OUT_PATH = resolve(__dirname, '..', 'src', 'data', 'escriva_points.json')

// Cache filename prefix → output book key. (They already match, but keep the map
// explicit so the source-of-truth filenames and the shipped keys can diverge.)
const BOOKS = ['caminho', 'sulco', 'forja']

// `om` (and cache-all.sh) strips <p> tags without a separator, so ~13% of points
// have a sentence end glued to the next sentence's capital — "…teu amor.Apaga…".
// That's a scraping defect, not the text: re-insert the missing space after
// sentence punctuation (incl. a closing quote/guillemet) when it abuts an
// uppercase letter. \p{Lu} is the *correct* uppercase class — [A-ZÀ-Ÿ] wrongly
// includes lowercase accented letters (U+00E0–U+00FF), which is what made an
// earlier audit read 95% instead of the real ~13%.
function repairSpacing(text) {
  return text.replace(/([.!?…])([»”"]?)(\p{Lu})/gu, '$1$2 $3')
}

function buildBook(book) {
  let files
  try {
    files = readdirSync(CACHE_DIR)
  } catch (err) {
    console.error(`Cannot read cache dir ${CACHE_DIR}: ${err.message}`)
    console.error('Populate it first with cache-all.sh from the om repo.')
    process.exit(1)
  }

  const prefix = `${book}_`
  const points = {}
  for (const file of files) {
    if (!file.startsWith(prefix) || !file.endsWith('.txt')) continue
    const num = file.slice(prefix.length, -'.txt'.length)
    if (!/^\d+$/.test(num)) continue
    const text = repairSpacing(readFileSync(join(CACHE_DIR, file), 'utf8').trim())
    if (text.length < 5) continue // mirror cache-all.sh's validity floor
    points[num] = text
  }
  return points
}

const out = {}
const summary = []
for (const book of BOOKS) {
  const points = buildBook(book)
  out[book] = points
  const nums = Object.keys(points).map(Number)
  summary.push({
    book,
    count: nums.length,
    min: Math.min(...nums),
    max: Math.max(...nums),
  })
}

// Sort each book's keys numerically so the JSON diffs cleanly across rebuilds.
const sorted = {}
for (const book of BOOKS) {
  sorted[book] = Object.fromEntries(
    Object.entries(out[book]).sort(([a], [b]) => Number(a) - Number(b)),
  )
}

writeFileSync(OUT_PATH, JSON.stringify(sorted) + '\n')

console.log(`Wrote ${OUT_PATH}`)
for (const s of summary) {
  console.log(`  ${s.book.padEnd(8)} ${s.count} points (${s.min}–${s.max})`)
}
const bytes = readFileSync(OUT_PATH).length
console.log(`  size: ${(bytes / 1024).toFixed(0)} KB`)
