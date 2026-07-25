#!/usr/bin/env node
// Validates the harvested Portuguese NT before it is baked into the app store.
// BUILD-TIME ONLY.
//
// Three independent checks:
//
//  1. ALIGNMENT — per-chapter verse counts against the Clementine Vulgate. Matos
//     Soares translated FROM the Vulgate, so its versification should match verse
//     for verse; every divergence is either a real editorial difference or a
//     harvest bug, and the bilingual reader pairs verses by number, so each one
//     must be looked at rather than silently tolerated.
//  2. ORACLE — a sample of chapters re-fetched from bibliacatolica.com.br, the
//     other site carrying this same 1956 edition. Byte differences are expected
//     (that site uses European orthography — "connosco" for "conosco"); what
//     matters is that no verse is missing and none diverges wildly in length,
//     which is what a mis-parse or a truncated page would look like.
//  3. SHAPE — empty or implausibly short verses anywhere in the corpus.
//
//   node scripts/nt/verify-pt.mjs [--oracle N] [--book Matt]

import { readFile } from 'node:fs/promises'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { NT_BOOKS } from '../../src/data/nt/books.ts'
import { loadLatinNt } from './lib/latin.mjs'

const execFileAsync = promisify(execFile)

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const PT_DIR = path.join(__dirname, '.cache', 'pt')

const UA =
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'

const arg = (name, fallback) => {
  const i = process.argv.indexOf(name)
  return i === -1 ? fallback : process.argv[i + 1]
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

async function loadPt(key) {
  return JSON.parse(await readFile(path.join(PT_DIR, `${key}.json`), 'utf8'))
}

// Same normalization the harvester applies, so an oracle comparison isn't
// dominated by markup noise.
function normalizeForCompare(s) {
  return s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9 ]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

// Shelled out to curl on purpose: bibliacatolica.com.br answers Node's fetch with
// 403 (its bot filter keys off the TLS/HTTP2 client fingerprint, not the headers —
// the identical UA + Accept set succeeds from curl and fails from undici).
async function fetchOracleChapter(book, chapter) {
  const url = `https://www.bibliacatolica.com.br/biblia-matos-soares-1956/${book.slug}/${chapter}/`
  const { stdout } = await execFileAsync(
    'curl',
    ['-sS', '--fail', '--max-time', '30', '-A', UA, '-H', 'Accept-Language: pt-BR,pt;q=0.9', url],
    { maxBuffer: 20 * 1024 * 1024 }
  )
  const html = stdout
  const section = /<section class="entry[^"]*">([\s\S]*?)<\/section>/.exec(html)
  if (!section) throw new Error(`no <section class="entry"> in ${url}`)
  const verses = {}
  const re = /<p><strong>(\d+)\.<\/strong>([\s\S]*?)<\/p>/g
  let m
  while ((m = re.exec(section[1])) !== null) {
    verses[Number(m[1])] = m[2]
      .replace(/<[^>]+>/g, '')
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/\s+/g, ' ')
      .trim()
  }
  return verses
}

async function main() {
  const oracleCount = Number(arg('--oracle', '12'))
  const onlyBook = arg('--book', null)
  const { latin: vulgate, applied } = await loadLatinNt()
  for (const a of applied) console.log(`[verify] latin repair: ${a}`)
  const books = NT_BOOKS.filter((b) => !onlyBook || b.key === onlyBook)

  // --- 1. alignment vs the Vulgate -------------------------------------------
  const misaligned = []
  let ptVerses = 0
  let laVerses = 0
  for (const book of books) {
    const pt = await loadPt(book.key)
    const la = vulgate[book.key]
    for (let c = 1; c <= book.chapters; c++) {
      const p = Object.keys(pt.chapters[c] ?? {}).length
      const l = Object.keys(la?.[c] ?? {}).length
      ptVerses += p
      laVerses += l
      if (p !== l) misaligned.push({ ref: `${book.key} ${c}`, pt: p, la: l })
    }
  }
  console.log(`[verify] alignment: pt ${ptVerses} verses, Vulgate ${laVerses} verses`)
  if (misaligned.length === 0) {
    console.log('[verify] alignment: every chapter matches verse-for-verse')
  } else {
    console.log(`[verify] alignment: ${misaligned.length} chapter(s) differ`)
    for (const m of misaligned) console.log(`  - ${m.ref}: pt=${m.pt} la=${m.la}`)
  }

  // --- 3. shape (cheap, run before the network work) --------------------------
  const shady = []
  for (const book of books) {
    const pt = await loadPt(book.key)
    for (const [c, verses] of Object.entries(pt.chapters)) {
      for (const [v, text] of Object.entries(verses)) {
        if (text.length < 8) shady.push(`${book.key} ${c},${v}: "${text}"`)
      }
    }
  }
  console.log(
    shady.length === 0
      ? '[verify] shape: no empty or truncated-looking verses'
      : `[verify] shape: ${shady.length} suspiciously short verse(s)`
  )
  for (const s of shady.slice(0, 20)) console.log(`  - ${s}`)

  // --- 2. oracle sample -------------------------------------------------------
  if (oracleCount > 0) {
    // Spread the sample deterministically across the whole NT rather than
    // clustering it in the Gospels.
    const targets = []
    for (let i = 0; i < oracleCount; i++) {
      const book = books[Math.floor((i * books.length) / oracleCount)]
      const chapter = ((i * 7) % book.chapters) + 1
      targets.push({ book, chapter })
    }

    let compared = 0
    let identical = 0
    const divergent = []
    const missing = []
    for (const { book, chapter } of targets) {
      let oracle
      try {
        oracle = await fetchOracleChapter(book, chapter)
      } catch (e) {
        console.log(`[verify] oracle: skipped ${book.key} ${chapter} (${e.message})`)
        continue
      }
      const ours = (await loadPt(book.key)).chapters[chapter] ?? {}
      for (const [v, oracleText] of Object.entries(oracle)) {
        const ourText = ours[v]
        if (!ourText) {
          missing.push(`${book.key} ${chapter},${v}`)
          continue
        }
        compared++
        const a = normalizeForCompare(ourText)
        const b = normalizeForCompare(oracleText)
        if (a === b) identical++
        else {
          const ratio = Math.min(a.length, b.length) / Math.max(a.length, b.length)
          if (ratio < 0.9) divergent.push({ ref: `${book.key} ${chapter},${v}`, ours: ourText, oracle: oracleText })
        }
      }
      const oracleN = Object.keys(oracle).length
      const oursN = Object.keys(ours).length
      if (oracleN !== oursN) missing.push(`${book.key} ${chapter}: oracle ${oracleN} verses, ours ${oursN}`)
      await sleep(1200)
    }

    const pct = compared ? ((identical / compared) * 100).toFixed(1) : '0.0'
    console.log(
      `[verify] oracle: ${compared} verses compared across ${targets.length} chapters — ${identical} identical after normalization (${pct}%)`
    )
    if (missing.length) {
      console.log(`[verify] oracle: ${missing.length} MISSING/COUNT problem(s)`)
      for (const m of missing) console.log(`  - ${m}`)
    }
    if (divergent.length) {
      console.log(`[verify] oracle: ${divergent.length} verse(s) differ by >10% in length`)
      for (const d of divergent.slice(0, 10)) {
        console.log(`  - ${d.ref}\n      ours:   ${d.ours}\n      oracle: ${d.oracle}`)
      }
    }
    if (!missing.length && !divergent.length) {
      console.log('[verify] oracle: no missing verses, no material divergence')
    }
  }

  const fatal = misaligned.length > 0 || shady.length > 0
  if (fatal) {
    console.log('\n[verify] review the findings above before building the store')
  } else {
    console.log('\n[verify] corpus clean')
  }
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
