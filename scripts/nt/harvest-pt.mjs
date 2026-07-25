#!/usr/bin/env node
// Harvests the Portuguese New Testament (Pe. Matos Soares, 1956 edition) into the
// build-time cache. BUILD-TIME ONLY — never imported by the app.
//
// Source: liriocatolico.com.br, which serves a whole book per request via its
// `/completo/` view (27 requests for the entire NT instead of 260 per-chapter
// ones). Its markup is regular: one `<h2 id="cap-N">` per chapter, one
// `<strong><sup><small>V</small></sup></strong>` per verse. The second site
// carrying this same edition (bibliacatolica.com.br) is used by verify-pt.mjs as
// an independent oracle rather than as the primary, because it renders European
// orthography ("connosco") where this one renders Brazilian ("conosco").
//
// Idempotent: raw HTML is cached under .cache/pt-html/ and reused; pass --force to
// re-download. Parsed output lands in .cache/pt/<key>.json, which build-nt.mjs joins
// against the Clementine Vulgate.
//
//   node scripts/nt/harvest-pt.mjs [--force] [--only Matt,Mark]

import { mkdir, writeFile, readFile, stat } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { NT_BOOKS } from '../../src/data/nt/books.ts'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const CACHE_DIR = path.join(__dirname, '.cache')
const HTML_DIR = path.join(CACHE_DIR, 'pt-html')
const OUT_DIR = path.join(CACHE_DIR, 'pt')

const BASE = 'https://www.liriocatolico.com.br/biblia_online/biblia_matos_soares'
const UA =
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
const DELAY_MS = 1200

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

async function exists(p) {
  try {
    await stat(p)
    return true
  } catch {
    return false
  }
}

const ENTITIES = {
  '&nbsp;': ' ',
  '&amp;': '&',
  '&lt;': '<',
  '&gt;': '>',
  '&quot;': '"',
  '&#39;': "'",
  '&apos;': "'",
  '&hellip;': '…',
  '&mdash;': '—',
  '&ndash;': '–',
  '&laquo;': '«',
  '&raquo;': '»',
  '&ldquo;': '“',
  '&rdquo;': '”',
  '&lsquo;': '‘',
  '&rsquo;': '’',
}

function unescapeHtml(s) {
  return s
    .replace(/&[a-z]+;|&#39;/gi, (m) => ENTITIES[m] ?? ENTITIES[m.toLowerCase()] ?? m)
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)))
}

/**
 * Verse text cleanup. The source wraps embedded scripture cross-references with
 * padded parentheses ("( Is 7, 14 )") and occasionally leaves a space before a
 * comma; both are typographic noise from its own templating, not the printed
 * edition. Portuguese has no French spacing, so tightening punctuation is safe.
 */
function cleanVerse(raw) {
  return unescapeHtml(raw.replace(/<a\b[\s\S]*?<\/a>/gi, '').replace(/<[^>]+>/g, ''))
    .replace(/\s+/g, ' ')
    .replace(/\(\s+/g, '(')
    .replace(/\s+\)/g, ')')
    .replace(/\s+([,;:!?])/g, '$1')
    .trim()
}

const VERSE_MARKER = /<strong><sup><small>(\d+)<\/small><\/sup><\/strong>/

function parseBook(html) {
  const title = /<title>([^<]*)<\/title>/i.exec(html)?.[1]?.split(' - ')[0]?.trim() ?? ''
  const parts = html.split(/<h2 id="cap-(\d+)"/)
  const chapters = {}
  for (let i = 1; i < parts.length; i += 2) {
    const chapterNum = Number(parts[i])
    const body = parts[i + 1]
    const verses = {}
    const re = new RegExp(
      `${VERSE_MARKER.source}([\\s\\S]*?)(?=${VERSE_MARKER.source}|<h2 id="cap-|<\\/div>)`,
      'g'
    )
    let m
    while ((m = re.exec(body)) !== null) {
      const text = cleanVerse(m[2])
      if (text) verses[Number(m[1])] = text
    }
    chapters[chapterNum] = verses
  }
  return { title, chapters }
}

async function fetchBook(book, force) {
  const htmlPath = path.join(HTML_DIR, `${book.key}.html`)
  if (!force && (await exists(htmlPath))) {
    return { html: await readFile(htmlPath, 'utf8'), cached: true }
  }
  const url = `${BASE}/${book.slug}/completo/`
  const res = await fetch(url, { headers: { 'user-agent': UA, 'accept-language': 'pt-BR,pt' } })
  if (!res.ok) throw new Error(`${book.key}: HTTP ${res.status} ${res.statusText} for ${url}`)
  const html = await res.text()
  await writeFile(htmlPath, html, 'utf8')
  return { html, cached: false }
}

async function main() {
  const force = process.argv.includes('--force')
  const onlyArg = process.argv.indexOf('--only')
  const only = onlyArg !== -1 ? new Set(process.argv[onlyArg + 1].split(',')) : null

  await mkdir(HTML_DIR, { recursive: true })
  await mkdir(OUT_DIR, { recursive: true })

  const books = NT_BOOKS.filter((b) => !only || only.has(b.key))
  const problems = []
  let totalVerses = 0

  for (const book of books) {
    const { html, cached } = await fetchBook(book, force)
    const { title, chapters } = parseBook(html)

    const chapterNums = Object.keys(chapters).map(Number).sort((a, b) => a - b)
    const verseCount = chapterNums.reduce((n, c) => n + Object.keys(chapters[c]).length, 0)
    totalVerses += verseCount

    if (chapterNums.length !== book.chapters) {
      problems.push(`${book.key}: parsed ${chapterNums.length} chapters, books.ts says ${book.chapters}`)
    }
    for (const c of chapterNums) {
      const vs = Object.keys(chapters[c]).map(Number).sort((a, b) => a - b)
      // The reader walks verses in order and the position anchor addresses them by
      // number, so a gap would silently swallow text — fail loudly instead.
      if (vs.length === 0) problems.push(`${book.key} ${c}: no verses parsed`)
      else if (vs[0] !== 1) problems.push(`${book.key} ${c}: starts at verse ${vs[0]}`)
      else if (vs[vs.length - 1] !== vs.length) {
        const missing = []
        for (let v = 1; v <= vs[vs.length - 1]; v++) if (!(v in chapters[c])) missing.push(v)
        problems.push(`${book.key} ${c}: missing verses ${missing.join(',')}`)
      }
    }

    await writeFile(
      path.join(OUT_DIR, `${book.key}.json`),
      JSON.stringify({ key: book.key, sourceTitle: title, chapters }, null, 0),
      'utf8'
    )
    console.log(
      `[harvest-pt] ${book.key.padEnd(7)} "${title}" ${chapterNums.length} ch / ${verseCount} vv${cached ? ' (cached html)' : ''}`
    )
    if (!cached) await sleep(DELAY_MS)
  }

  console.log(`\n[harvest-pt] ${books.length} books, ${totalVerses} verses`)
  if (problems.length) {
    console.error(`\n[harvest-pt] ${problems.length} PROBLEM(S):`)
    for (const p of problems) console.error(`  - ${p}`)
    process.exit(1)
  }
  console.log('[harvest-pt] structure OK')
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
