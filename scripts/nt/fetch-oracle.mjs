#!/usr/bin/env node
// Downloads every NT chapter of the Matos Soares 1956 text from bibliacatolica.com.br
// into scripts/nt/.cache/oracle-html/<book>/<chapter>.html. BUILD-TIME ONLY.
//
// The site carries the same digitization as liriocatolico.com.br (our source): ~90%
// of verses are byte-identical, and each site has some typos the other fixed. So it
// is a second witness for proofreading (scripts/nt/lib/pt-corrections.mjs), not a
// replacement source.
//
//   node scripts/nt/fetch-oracle.mjs [--book John]
//
// Cached: a chapter already on disk is not fetched again. Polite: one request at a
// time, 1.2 s apart (260 chapters ≈ 7 minutes).
//
// Shelled out to curl on purpose, as in verify-pt.mjs: the site answers Node's fetch
// with 403 (its bot filter keys off the TLS/HTTP2 fingerprint, not the headers).

import { existsSync } from 'node:fs'
import { mkdir, writeFile } from 'node:fs/promises'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { NT_BOOKS } from '../../src/data/nt/books.ts'

const execFileAsync = promisify(execFile)
const __dirname = path.dirname(fileURLToPath(import.meta.url))
export const ORACLE_DIR = path.join(__dirname, '.cache', 'oracle-html')

const UA =
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

async function main() {
  const i = process.argv.indexOf('--book')
  const only = i === -1 ? null : process.argv[i + 1]
  let fetched = 0
  let cached = 0
  for (const book of NT_BOOKS.filter((b) => !only || b.key === only)) {
    await mkdir(path.join(ORACLE_DIR, book.key), { recursive: true })
    for (let c = 1; c <= book.chapters; c++) {
      const file = path.join(ORACLE_DIR, book.key, `${c}.html`)
      if (existsSync(file)) {
        cached++
        continue
      }
      const url = `https://www.bibliacatolica.com.br/biblia-matos-soares-1956/${book.slug}/${c}/`
      const { stdout } = await execFileAsync(
        'curl',
        ['-sS', '--fail', '--max-time', '30', '--retry', '3', '-A', UA, '-H', 'Accept-Language: pt-BR,pt;q=0.9', url],
        { maxBuffer: 20 * 1024 * 1024 }
      )
      if (!/<section class="entry/.test(stdout)) throw new Error(`no <section class="entry"> in ${url}`)
      await writeFile(file, stdout, 'utf8')
      fetched++
      console.log(`[fetch-oracle] ${book.key} ${c}`)
      await sleep(1200)
    }
  }
  console.log(`[fetch-oracle] done: ${fetched} fetched, ${cached} already cached`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
