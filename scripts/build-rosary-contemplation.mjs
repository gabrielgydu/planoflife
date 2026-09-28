#!/usr/bin/env node
// Builds the per-mystery quote pools of src/data/rosary_contemplation.json from
// the curated spec scripts/rosary-contemplation-spec.json. BUILD-TIME ONLY: the
// app imports the committed JSON, never this script.
//
//   node scripts/build-rosary-contemplation.mjs            # verify + write
//   node scripts/build-rosary-contemplation.mjs --check    # verify only
//
// Every quote is one self-contained unit shown alone under its mystery (the
// reader picks one at random), so the spec is hand-curated: Santo Rosário's
// paragraphs regrouped into passages that stand on their own, plus texts of St.
// Josemaría's other works and of his successors, each with its source.
//
// Sourcing rules (see the project memory "opus-dei-text-sourcing"): every unit
// is VERBATIM. The script fetches each cited page (cached under
// scripts/.cache/rosary-contemplation/), normalizes both sides (NFC, no-break
// space → space, zero-width chars dropped, whitespace collapsed) and requires
// every paragraph of the unit to be a substring of the page. A deliberate
// elision is written " […] " and each side must verify on its own. A unit that
// stops matching fails the build instead of shipping a paraphrase.
//
// The only edits to verified text are the CORRECTIONS below: defects of the
// escriva.org pt-br pages, each cross-checked against the Spanish original and
// the pt-PT edition. Each must match exactly once or the build fails.
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const specPath = path.join(root, 'scripts', 'rosary-contemplation-spec.json')
const outPath = path.join(root, 'src', 'data', 'rosary_contemplation.json')
const cacheDir = path.join(root, 'scripts', '.cache', 'rosary-contemplation')
const checkOnly = process.argv.includes('--check')
const execFileAsync = promisify(execFile)

const UA =
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36'

const CORRECTIONS = [
  {
    // The pt-br page splits this sentence across two <p> and loses the drop-cap
    // "O" (es: "Adoctrina ahora el Maestro…"; pt-PT: "O Mestre ensina agora…").
    find: 'Mestre ensina agora os seus discípulos: abriu-lhes a inteligência, para que compreendam as\nEscrituras',
    replace:
      'O Mestre ensina agora os seus discípulos: abriu-lhes a inteligência, para que compreendam as Escrituras',
  },
  // PDF ligature artifact on the pt-br page (es: "en un día sin fin").
  { find: 'num dia sem fi m', replace: 'num dia sem fim' },
  // Wrong chapter on the pt-br page; es original and pt-PT both cite Mt 17, 2.
  { find: '(Mt XVI, 2)', replace: '(Mt XVII, 2)' },
  // Wrong chapter on the pt-br page; es original and pt-PT both cite Jo 13, 1.
  { find: '(Ioh XII, 1)', replace: '(Ioh XIII, 1)' },
  // Stray space before a comma on the pt-br page of É Cristo que passa, 171.
  { find: 'o próprio Amor , seu poder', replace: 'o próprio Amor, seu poder' },
]

const ELISION = ' […] '

function normalize(s) {
  return s
    .normalize('NFC')
    .replace(/\u00a0/g, ' ')
    .replace(/[\ufeff\u200b]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

function decodeEntities(s) {
  const named = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: '\u00a0', hellip: '…', ndash: '–', mdash: '—' }
  return s
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(Number(d)))
    .replace(/&([a-z]+);/gi, (m, n) => named[n.toLowerCase()] ?? m)
}

/** The page's readable text, normalized. escriva.org: only the point body. */
function pageText(html, url) {
  let body = html
  if (url.includes('escriva.org')) {
    const a = html.indexOf('<div class="imperavi-body">')
    const b = html.indexOf('<div class="bottom-block">', a)
    if (a === -1 || b === -1) throw new Error(`${url}: escriva.org body markers not found`)
    body = html.slice(a, b)
  } else {
    body = body.replace(/<(script|style|noscript)[\s\S]*?<\/\1>/gi, ' ')
  }
  // Block-level tags become spaces so adjacent paragraphs don't fuse into one word.
  const text = body.replace(/<\/?(p|div|br|li|h\d|blockquote)[^>]*>/gi, ' ').replace(/<[^>]+>/g, '')
  return normalize(decodeEntities(text))
}

const pages = new Map()
async function fetchPage(url) {
  if (pages.has(url)) return pages.get(url)
  await mkdir(cacheDir, { recursive: true })
  const file = path.join(cacheDir, url.replace(/^https?:\/\//, '').replace(/[^a-z0-9]+/gi, '_') + '.html')
  let html
  if (existsSync(file)) {
    html = await readFile(file, 'utf8')
  } else {
    // curl, not fetch: escriva.org/opusdei.org's bot filter answers Node's fetch
    // with 403 (it keys off the TLS fingerprint) — see fetch-devocionario.mjs.
    const { stdout } = await execFileAsync(
      'curl',
      ['-sS', '--fail', '-L', '--max-time', '60', '-A', UA, '-H', 'Accept-Language: pt-BR,pt;q=0.9', url],
      { maxBuffer: 32 * 1024 * 1024 },
    )
    html = stdout
    await writeFile(file, html)
    await new Promise((r) => setTimeout(r, 700))
  }
  const text = pageText(html, url)
  pages.set(url, text)
  return text
}

function verifyUnit(unit, page, label) {
  for (const para of unit.text.split('\n')) {
    const whole = normalize(para)
    if (page.includes(whole)) continue
    const pieces = para.split(ELISION).map(normalize)
    if (pieces.length > 1 && pieces.every((p) => page.includes(p))) continue
    throw new Error(`${label}: not verbatim in ${unit.url}\n  «${whole.slice(0, 160)}»`)
  }
}

function applyCorrections(text, used) {
  let out = text
  CORRECTIONS.forEach((c, i) => {
    const at = out.indexOf(c.find)
    if (at === -1) return
    if (out.indexOf(c.find, at + 1) !== -1) throw new Error(`correction ${i} matches twice: ${c.find}`)
    out = out.replace(c.find, c.replace)
    used[i] += 1
  })
  return out
}

/** Display form: no zero-width junk, plain spaces, one "\n" between paragraphs. */
function clean(text) {
  return text
    .split('\n')
    .map((p) => p.normalize('NFC').replace(/\u00a0/g, ' ').replace(/[\ufeff\u200b]/g, '').replace(/[ \t]+/g, ' ').trim())
    .filter(Boolean)
    .join('\n')
}

const spec = JSON.parse(await readFile(specPath, 'utf8'))
const data = JSON.parse(await readFile(outPath, 'utf8'))
const used = CORRECTIONS.map(() => 0)
let total = 0

for (const [setKey, set] of Object.entries(data.sets)) {
  const specSet = spec.sets[setKey]
  if (!specSet) throw new Error(`spec has no set "${setKey}"`)
  if (specSet.length !== set.mysteries.length) throw new Error(`${setKey}: spec has ${specSet.length} mysteries`)
  set.mysteries.forEach((mystery, mi) => {
    const specMystery = specSet[mi]
    if (specMystery.title !== mystery.title)
      throw new Error(`${setKey}[${mi}]: title mismatch «${specMystery.title}» vs «${mystery.title}»`)
    if (!specMystery.units.length) throw new Error(`${setKey}[${mi}]: no units`)
  })
}

for (const [setKey, set] of Object.entries(data.sets)) {
  for (const [mi, mystery] of set.mysteries.entries()) {
    const quotes = []
    for (const [ui, unit] of spec.sets[setKey][mi].units.entries()) {
      const label = `${setKey} › ${mystery.title} › #${ui} (${unit.ref})`
      if (!unit.ref || !unit.url || !unit.text) throw new Error(`${label}: unit needs text, ref and url`)
      verifyUnit(unit, await fetchPage(unit.url), label)
      quotes.push({ t: applyCorrections(clean(unit.text), used), ref: unit.ref })
      total += 1
    }
    mystery.quotes = quotes
  }
}

const unused = CORRECTIONS.filter((_, i) => used[i] === 0)
if (unused.length) throw new Error(`corrections never applied: ${unused.map((c) => c.find).join(' | ')}`)

data.source = spec.source

console.log(`verified ${total} units across ${pages.size} pages; ${CORRECTIONS.length} corrections applied`)
if (!checkOnly) {
  await writeFile(outPath, JSON.stringify(data, null, 2) + '\n')
  console.log(`wrote ${path.relative(root, outPath)}`)
}
