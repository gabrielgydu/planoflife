#!/usr/bin/env node
// Fetches every point of Caminho, Sulco and Forja from escriva.org (pt-br) into a
// local cache, for scripts/build-escriva-points.mjs to turn into the shipped JSON.
// BUILD-TIME ONLY and resumable: a point already in the cache is never re-fetched
// unless --force is given.
//
//   node scripts/fetch-escriva-points.mjs [--force] [--only caminho,sulco]
//
// Why not the `om` cache (~/.cache/om) alone: om strips the HTML without a
// separator, so a point's paragraphs arrive glued into one ("…do teu amor.Apaga, com
// a tua vida…" is two <p> on the site), and its inline italics are lost. The om
// cache stays useful as an INDEPENDENT cross-check of the words — the build compares
// the two — but the paragraphs can only come from the pages themselves.
//
// What is cached is the <article id="contenido"> fragment only (a few KB) rather than
// the 70 KB page: it holds the point number, the text and the scripture-reference
// block, which is everything the build reads. The three book index pages are cached
// whole — the build reads the chapter list (title + point range) from them.
//
// escriva.org sits behind Cloudflare: Node's fetch gets a 403 (TLS fingerprint),
// curl with a browser UA gets the page. The slugs are the Spanish ones
// (`camino`, `surco`, `forja`) even on the pt-br site.

import { execFile } from 'node:child_process'
import { mkdir, stat, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { promisify } from 'node:util'
import { fileURLToPath } from 'node:url'

const execFileAsync = promisify(execFile)
const __dirname = path.dirname(fileURLToPath(import.meta.url))
export const CACHE_DIR = path.join(__dirname, '.cache', 'escriva')

const UA =
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36'
const DELAY_MS = 150
const RETRIES = 4

export const BOOKS = [
  { key: 'caminho', slug: 'camino', max: 999 },
  { key: 'sulco', slug: 'surco', max: 1000 },
  { key: 'forja', slug: 'forja', max: 1055 },
]

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

async function exists(p) {
  try {
    await stat(p)
    return true
  } catch {
    return false
  }
}

async function curl(url) {
  const { stdout } = await execFileAsync(
    'curl',
    ['-sS', '--fail', '-L', '--max-time', '60', '-A', UA, '-H', 'Accept-Language: pt-BR,pt;q=0.9', url],
    { maxBuffer: 32 * 1024 * 1024 }
  )
  return stdout
}

/** The <article id="contenido"> element, tags and all, or null. */
function articleFragment(html) {
  const start = html.indexOf('<article id="contenido">')
  if (start === -1) return null
  const end = html.indexOf('</article>', start)
  if (end === -1) return null
  return html.slice(start, end + '</article>'.length)
}

/** The number in the point's own heading — the tripwire for a wrong or 404 page. */
function headingNumber(fragment) {
  const m = /<div class="point-number"><h1>(\d+)<\/h1><\/div>/.exec(fragment)
  return m ? Number(m[1]) : null
}

async function fetchWithRetry(url, validate) {
  let lastErr
  for (let attempt = 1; attempt <= RETRIES; attempt++) {
    try {
      const html = await curl(url)
      const problem = validate(html)
      if (!problem) return html
      lastErr = new Error(problem)
    } catch (err) {
      lastErr = err
    }
    await sleep(DELAY_MS * 4 * attempt)
  }
  throw lastErr
}

async function main() {
  const args = process.argv.slice(2)
  const force = args.includes('--force')
  const onlyArg = args.find((a) => a.startsWith('--only'))
  const only = onlyArg
    ? (onlyArg.includes('=') ? onlyArg.split('=')[1] : args[args.indexOf(onlyArg) + 1]).split(',')
    : null
  const books = BOOKS.filter((b) => !only || only.includes(b.key))

  const failures = []
  for (const book of books) {
    const dir = path.join(CACHE_DIR, book.key)
    await mkdir(dir, { recursive: true })

    const indexPath = path.join(dir, 'index.html')
    if (force || !(await exists(indexPath))) {
      const html = await fetchWithRetry(`https://escriva.org/pt-br/${book.slug}/`, (h) =>
        articleFragment(h) ? null : 'no <article id="contenido"> on the index page'
      )
      await writeFile(indexPath, html)
      await sleep(DELAY_MS)
    }

    let fetched = 0
    for (let n = 1; n <= book.max; n++) {
      const file = path.join(dir, `${n}.html`)
      if (!force && (await exists(file))) continue
      const url = `https://escriva.org/pt-br/${book.slug}/${n}/`
      try {
        const html = await fetchWithRetry(url, (h) => {
          const frag = articleFragment(h)
          if (!frag) return 'no <article id="contenido">'
          const got = headingNumber(frag)
          if (got !== n) return `heading reads ${got}, expected ${n}`
          return null
        })
        await writeFile(file, articleFragment(html))
        fetched++
      } catch (err) {
        failures.push(`${book.key} ${n}: ${err.message}`)
      }
      if (n % 50 === 0) console.log(`  ${book.key} ${n}/${book.max}`)
      await sleep(DELAY_MS)
    }
    console.log(`${book.key}: ${fetched} fetched, cache ${dir}`)
  }

  if (failures.length) {
    console.error(`\n${failures.length} point(s) failed:`)
    for (const f of failures) console.error(`  ${f}`)
    process.exit(1)
  }
  console.log('done')
}

// Importable: the build takes BOOKS and CACHE_DIR from here.
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main().catch((err) => {
    console.error(err)
    process.exit(1)
  })
}
