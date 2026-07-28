#!/usr/bin/env node
// Builds src/data/devocionario.json — the Devocionário prayer book — from the
// pt-BR Livro de Orações on opusdei.org. BUILD-TIME ONLY: the app imports the
// committed JSON, never this script.
//
//   node scripts/fetch-devocionario.mjs [--force] [--only oracoes-comuns,hinos]
//
// Sourcing rules (non-negotiable, see the project memory "opus-dei-text-sourcing"):
// the texts are the Work's own wording, so they come verbatim from opusdei.org and
// from nowhere else — not a Bible edition, not a devotional aggregator. Source
// quirks (odd capitalization, doubled words, a missing space after a rubric) are
// REPRODUCED, never "fixed"; the script prints the ones it noticed so they can be
// eyeballed instead of silently normalized.
//
// Two hard-won mechanics:
//
//   1. opusdei.org answers Node's fetch (and WebFetch) with 403 — its bot filter
//      keys off the TLS/HTTP2 client fingerprint, not the headers — so this shells
//      out to curl with a browser UA, exactly like scripts/nt/verify-pt.mjs.
//   2. The pages are full of U+00A0 (no-break space) and U+FEFF, artifacts of the
//      EPUB→CMS conversion behind them. Both are normalized away here so they never
//      reach the shipped markdown.
//
// Page structure (verified on all 11 sections): each prayer is a
// `div.prayer-wrapper` (Portuguese only) or `div.prayer-wrapper.double`
// (Portuguese + Latin side by side). `div.prayer-titles` holds one `h2` per
// language; `div.prayer` holds one body div per language, identified by its `lang`
// attribute. The presentation classes that carry meaning are:
//
//   .rub / .dot-vr   red text        → **bold**  (verse numbers, "Antífona.", ℣./℟.)
//   .rb              red + italic    → *italic*  (rubric instructions)
//   .up              uppercase       → the text is uppercased
//   .nig             black           → plain (a colour reset inside a red run)
//   .pq .md .cn .dm  size/centering  → plain (no markdown equivalent)
//   .rub2 .psp .calibre*             → plain: leftovers of the EPUB conversion with
//                                      no CSS at all, so they render as plain text
//
// Emphasis is emitted as markdown where CommonMark's flanking rules allow it and as
// <strong>/<em> where they don't (the source really does write
// `<span class="rub">Antífona.</span>Seu reinado` with no space, and `**Antífona.**Seu`
// would leak literal asterisks). Every produced string is then re-rendered with the
// app's own `marked` settings and compared to the plain text of the source HTML, so
// a conversion that dropped or mangled a character fails the build instead of
// shipping.

import { execFile } from 'node:child_process'
import { mkdir, readFile, stat, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { promisify } from 'node:util'
import { fileURLToPath } from 'node:url'
import { marked } from 'marked'

const execFileAsync = promisify(execFile)
const __dirname = path.dirname(fileURLToPath(import.meta.url))
const CACHE_DIR = path.join(__dirname, '.cache', 'devocionario')
const OUT_PATH = path.join(__dirname, '..', 'src', 'data', 'devocionario.json')

const UA =
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36'
const DELAY_MS = 1200

// The eleven sections of the pt-BR prayer book, in the order the site lists them.
// `count` is the number of prayers the section is expected to yield — a cheap
// tripwire for a page that changed shape or came back truncated. Section 202
// ("Estampas") is deliberately absent: it is a gallery of prayer-card IMAGES with
// no section2 parameter and no extractable text.
const SECTIONS = [
  { slug: 'oracoes-comuns', section1: 191, section2: 31, namePt: 'Orações comuns', count: 9 },
  { slug: 'ssma-trindade', section1: 192, section2: 32, namePt: 'Santíssima Trindade', count: 6 },
  { slug: 'adoracao-eucaristica', section1: 193, section2: 33, namePt: 'Adoração Eucarística', count: 7 },
  { slug: 'espirito-santo', section1: 194, section2: 34, namePt: 'Espírito Santo', count: 3 },
  { slug: 'nossa-senhora', section1: 195, section2: 35, namePt: 'Nossa Senhora', count: 12 },
  { slug: 'antes-da-missa', section1: 196, section2: 36, namePt: 'Preparação para a Santa Missa', count: 4 },
  { slug: 'depois-da-missa', section1: 197, section2: 37, namePt: 'Ação de Graças após a Santa Missa', count: 9 },
  { slug: 'outras-devocoes', section1: 198, section2: 38, namePt: 'Outras devoções e salmos', count: 9 },
  { slug: 'hinos', section1: 199, section2: 64, namePt: 'Hinos', count: 13 },
  { slug: 'falecidos', section1: 200, section2: 39, namePt: 'Orações pelos Defuntos', count: 3 },
  { slug: 'doutrina', section1: 201, section2: 52, namePt: 'Fórmulas de Doutrina Católica', count: 13 },
]

// --- fetching -----------------------------------------------------------------

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

async function exists(p) {
  try {
    await stat(p)
    return true
  } catch {
    return false
  }
}

async function fetchSection(section, force) {
  const cached = path.join(CACHE_DIR, `${section.section1}.html`)
  if (!force && (await exists(cached))) return readFile(cached, 'utf8')

  const url = `https://opusdei.org/pt-br/prayers/section/?section1=${section.section1}&section2=${section.section2}`
  const { stdout } = await execFileAsync(
    'curl',
    ['-sS', '--fail', '-L', '--max-time', '60', '-A', UA, '-H', 'Accept-Language: pt-BR,pt;q=0.9', url],
    { maxBuffer: 32 * 1024 * 1024 }
  )
  await mkdir(CACHE_DIR, { recursive: true })
  await writeFile(cached, stdout)
  await sleep(DELAY_MS)
  return stdout
}

// --- HTML helpers -------------------------------------------------------------

/** Inner HTML of the element starting at `openTagEnd`, matching `<tag>` nesting. */
function sliceElement(html, tag, openTagEnd) {
  const re = new RegExp(`<${tag}\\b|</${tag}>`, 'g')
  re.lastIndex = openTagEnd
  let depth = 1
  let m
  while ((m = re.exec(html)) !== null) {
    depth += m[0] === `</${tag}>` ? -1 : 1
    if (depth === 0) return { inner: html.slice(openTagEnd, m.index), end: re.lastIndex }
  }
  throw new Error(`unbalanced <${tag}>`)
}

/** Every div.prayer-wrapper on the page, in document order. */
function prayerWrappers(html) {
  const start = html.indexOf('<div id="prayersWrapper">')
  const end = html.indexOf('</main>')
  if (start === -1 || end === -1) throw new Error('no #prayersWrapper / </main> on page')
  const body = html.slice(start, end)

  const out = []
  const re = /<div class="prayer-wrapper( double)?">/g
  let m
  while ((m = re.exec(body)) !== null) {
    const { inner, end: after } = sliceElement(body, 'div', m.index + m[0].length)
    out.push({ isDouble: !!m[1], inner })
    re.lastIndex = after
  }
  return out
}

/** The named element's inner HTML, or null. `openRe` must match its opening tag. */
function findElement(html, tag, openRe) {
  const m = openRe.exec(html)
  if (!m) return null
  return sliceElement(html, tag, m.index + m[0].length).inner
}

const ENTITIES = {
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
  nbsp: ' ',
  ndash: '–',
  mdash: '—',
  hellip: '…',
  laquo: '«',
  raquo: '»',
  ldquo: '“',
  rdquo: '”',
  lsquo: '‘',
  rsquo: '’',
  aelig: 'æ',
  AElig: 'Æ',
  oelig: 'œ',
  OElig: 'Œ',
  deg: '°',
  middot: '·',
  eacute: 'é',
  aacute: 'á',
}

function decodeEntities(s) {
  return s
    .replace(/&#x([0-9a-fA-F]+);/g, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(Number(d)))
    .replace(/&([a-zA-Z]+);/g, (full, name) => ENTITIES[name] ?? full)
}

/** U+00A0 → space and U+FEFF → nothing: EPUB→CMS artifacts, never shipped. */
function normalizeSpaces(s) {
  return s.replace(/ /g, ' ').replace(/﻿/g, '')
}

// --- title -------------------------------------------------------------------

function parseTitles(wrapperHtml) {
  const titlesHtml = findElement(wrapperHtml, 'div', /<div class="prayer-titles">/)
  if (titlesHtml === null) throw new Error('prayer-wrapper without .prayer-titles')

  const titles = {}
  const re = /<h2\b([^>]*)>([\s\S]*?)<\/h2>/g
  let m
  while ((m = re.exec(titlesHtml)) !== null) {
    const lang = /lang="([^"]+)"/.exec(m[1])?.[1] ?? ''
    // `<span class="info-langs">pt-BR</span>` is a UI badge marking a prayer the
    // site has in Portuguese only — not part of the title.
    const text = normalizeSpaces(
      decodeEntities(m[2].replace(/<span class="info-langs">[\s\S]*?<\/span>/g, '').replace(/<[^>]+>/g, ''))
    )
      .replace(/\s+/g, ' ')
      .trim()
    if (lang.startsWith('pt')) titles.pt = text
    else if (lang === 'la') titles.la = text
  }
  // Portuguese is usually present, but not always: several hymns and the two
  // responsories for the dead exist only in Latin on the site (the `info-langs`
  // badge reads "la"), so a prayer may legitimately have no pt title at all.
  if (!titles.pt && !titles.la) throw new Error('prayer-wrapper without any title')
  return titles
}

// --- body → markdown ---------------------------------------------------------

// Emphasis is staged as sentinels so the decision between markdown and raw HTML
// can be made once the surrounding characters are known (see resolveEmphasis).
const B_OPEN = '\u0001'
const B_CLOSE = '\u0002'
const I_OPEN = '\u0003'
const I_CLOSE = '\u0004'
const PARA = '\u0005' // paragraph boundary, collapsed at the end

const RED_CLASSES = ['rub', 'dot-vr']

function classList(attrs) {
  const m = /class="([^"]*)"/.exec(attrs)
  return m ? m[1].trim().split(/\s+/) : []
}

/**
 * One prayer body (the inner HTML of a `.prayer > div[lang]`) as markdown.
 *
 * `plain: true` drops every emphasis marker, which is how the verification pass
 * gets the source's own plain text to compare the rendered markdown against.
 */
function bodyToMarkdown(html, { plain = false } = {}) {
  let s = html

  // LanguageTool's browser extension left `<lt-highlighter>` scaffolding inside a
  // couple of paragraphs when the text was pasted into the CMS. Drop it whole.
  s = s.replace(/<lt-highlighter[\s\S]*?<\/lt-highlighter>/g, '')

  // ℣ and ℟ are drawn as SVG icons followed by a separate red period. Both parts
  // are red, so they become ONE emphasized run rather than two adjacent ones.
  s = s.replace(
    /<svg class="icon-prayer-v"[\s\S]*?<\/svg>\s*(?:<span class="dot-vr">\.<\/span>)?/g,
    (full) => (full.includes('dot-vr') ? `${B_OPEN}℣.${B_CLOSE}` : `${B_OPEN}℣${B_CLOSE}`)
  )
  s = s.replace(
    /<svg class="icon-prayer-r"[\s\S]*?<\/svg>\s*(?:<span class="dot-vr">\.<\/span>)?/g,
    (full) => (full.includes('dot-vr') ? `${B_OPEN}℟.${B_CLOSE}` : `${B_OPEN}℟${B_CLOSE}`)
  )
  // Any other icon (the bookmark button) is pure chrome.
  s = s.replace(/<svg[\s\S]*?<\/svg>/g, '')
  s = s.replace(/<button[\s\S]*?<\/button>/g, '')

  // `figure.emptyparagraph` is the site's blank-line spacer.
  s = s.replace(/<figure\b[^>]*>[\s\S]*?<\/figure>/g, PARA)

  s = s.replace(/<br\s*\/?>/g, '\n')
  s = s.replace(/<\/p>/g, PARA).replace(/<p\b[^>]*>/g, '')

  // Innermost-out: a span with no span inside it is resolved, then the loop sees
  // its parent as innermost. Handles the `.nig > .up > .pq` stacks in Via Sacra.
  const spanRe = /<span\b([^>]*)>((?:(?!<span\b)[\s\S])*?)<\/span>/
  for (let guard = 0; guard < 500; guard++) {
    const m = spanRe.exec(s)
    if (!m) break
    const classes = classList(m[1])
    let inner = m[2]
    if (classes.includes('up')) inner = inner.toUpperCase()
    let replacement = inner
    if (!plain && inner.trim()) {
      if (classes.includes('rb')) replacement = `${I_OPEN}${inner}${I_CLOSE}`
      else if (classes.some((c) => RED_CLASSES.includes(c))) replacement = `${B_OPEN}${inner}${B_CLOSE}`
    }
    s = s.slice(0, m.index) + replacement + s.slice(m.index + m[0].length)
  }

  s = s.replace(/<(em|i)\b[^>]*>([\s\S]*?)<\/\1>/g, (_, __, inner) =>
    plain || !inner.trim() ? inner : `${I_OPEN}${inner}${I_CLOSE}`
  )
  s = s.replace(/<(strong|b)\b[^>]*>([\s\S]*?)<\/\1>/g, (_, __, inner) =>
    plain || !inner.trim() ? inner : `${B_OPEN}${inner}${B_CLOSE}`
  )

  s = s.replace(/<[^>]+>/g, '')
  s = decodeEntities(s)
  s = normalizeSpaces(s)

  // Whitespace: the source is minified HTML, so runs of spaces are never meaningful.
  // Each `</p>` (and each blank-line figure) opens a markdown paragraph; the `<br>`
  // newlines inside one stay single, which `breaks: true` renders as line breaks.
  s = s
    .replace(/[ \t]+/g, ' ')
    .split(PARA)
    .map((block) =>
      block
        .split('\n')
        .map((line) => line.trim())
        .join('\n')
        .replace(/^\n+|\n+$/g, '')
    )
    .filter(Boolean)
    .join('\n\n')
    .replace(/\n{3,}/g, '\n\n')

  // Trim again once the emphasis markers are real characters: a `<br>` INSIDE an
  // `<em>` leaves the sentinel, not the space, at the head of the next line, so the
  // earlier per-line trim can't see it (Via Sacra's list of stations).
  const trimLines = (t) =>
    t
      .split('\n')
      .map((line) => line.trim())
      .join('\n')

  return plain
    ? trimLines(stripSentinels(s))
    : escapeBlockStarts(trimLines(resolveEmphasis(s)))
}

function stripSentinels(s) {
  return s.replace(/[\u0001-\u0005]/g, '')
}

const WORDISH = /[\p{L}\p{N}]/u
// CommonMark's "punctuation" for the flanking rules: the Unicode punctuation and
// symbol categories.
const PUNCT = /[\p{P}\p{S}]/u

/**
 * Turn the emphasis sentinels into markdown, or into `<strong>`/`<em>` where
 * CommonMark's flanking rules would refuse to close the run.
 *
 * The case that forces this: `<span class="rub">Antífona.</span>Seu reinado` (no
 * space after the rubric — a real quirk of the source, kept as-is). `**Antífona.**Seu`
 * has a closing delimiter preceded by punctuation and followed by a letter, which is
 * not right-flanking, so `marked` would print the asterisks literally. Innermost
 * pairs resolve first so nesting composes.
 */
function resolveEmphasis(s) {
  const pairs = [
    { open: B_OPEN, close: B_CLOSE, md: '**', tag: 'strong' },
    { open: I_OPEN, close: I_CLOSE, md: '*', tag: 'em' },
  ]
  // Empty runs (the source has a few stray `<span class="rub"></span>`) carry no
  // text, and two runs of the same kind that touch are one visual run — the doubled
  // `<span class="dot-vr">.</span><span class="dot-vr">.</span>` in Preces, or the
  // split `(` + `T. P.` rubric in the Athanasian antiphon. Both must go before the
  // flanking analysis: emitting `**a****b**` would leave literal asterisks.
  for (const p of pairs) {
    let previous
    do {
      previous = s
      s = s.split(p.open + p.close).join('').split(p.close + p.open).join('')
    } while (s !== previous)
  }

  const SENTINELS = new Set([B_OPEN, B_CLOSE, I_OPEN, I_CLOSE])

  for (let guard = 0; guard < 5000; guard++) {
    // The first closing sentinel always belongs to the nearest opening one before
    // it, and that pair is innermost by construction.
    let best = -1
    let kind = null
    for (const p of pairs) {
      const i = s.indexOf(p.close)
      if (i !== -1 && (best === -1 || i < best)) {
        best = i
        kind = p
      }
    }
    if (best === -1) break
    const openAt = s.lastIndexOf(kind.open, best)
    if (openAt === -1) {
      // Unpaired close (cannot happen with well-formed input) — drop it.
      s = s.slice(0, best) + s.slice(best + 1)
      continue
    }
    const raw = s.slice(openAt + 1, best)
    const lead = /^\s*/.exec(raw)[0]
    const trail = /\s*$/.exec(raw)[0]
    const core = raw.slice(lead.length, raw.length - trail.length)
    const before = s[openAt - 1] ?? ''
    const after = s[best + 1] ?? ''

    let body
    if (!core) {
      body = raw
    } else {
      // A neighbour that is still a sentinel will become some character we cannot
      // see yet, so the flanking analysis can't clear it — fall back to HTML, which
      // is safe whatever ends up next to it.
      const unknownNeighbour = SENTINELS.has(before) || SENTINELS.has(after)
      const openUnsafe = lead === '' && WORDISH.test(before) && PUNCT.test(core[0])
      const closeUnsafe = trail === '' && PUNCT.test(core[core.length - 1]) && WORDISH.test(after)
      const hasMarker = core.includes('*') || core.includes('_')
      body =
        unknownNeighbour || openUnsafe || closeUnsafe || hasMarker
          ? `${lead}<${kind.tag}>${core}</${kind.tag}>${trail}`
          : `${lead}${kind.md}${core}${kind.md}${trail}`
    }
    s = s.slice(0, openAt) + body + s.slice(best + 1)
  }
  return s
}

/**
 * Escape line starts that markdown would read as block syntax. The Via Sacra's
 * list of stations is plain text in the source (`1.`, `2.`, … in a class with no
 * CSS at all), and `breaks: true` does not stop `marked` from turning those lines
 * into an ordered list. The backslashes are invisible once rendered.
 */
function escapeBlockStarts(s) {
  return s
    .split('\n')
    .map((line) =>
      line
        .replace(/^(\s*)(\d{1,9})([.)])(\s)/, '$1$2\\$3$4')
        .replace(/^(\s*)([-+*])(\s)/, '$1\\$2$3')
        .replace(/^(\s*)(#{1,6})(\s)/, '$1\\$2$3')
        .replace(/^(\s*)(>)/, '$1\\$2')
        // A lone run of -, = or _ would become a thematic break or a setext heading
        // for the line above it.
        .replace(/^(\s*)([-=_])(\s*\2)+\s*$/, (full, indent) => `${indent}\\${full.trim()}`)
    )
    .join('\n')
}

// --- verification -------------------------------------------------------------

// Inline tags vanish, block tags become a space: `<strong>1</strong>.` must compare
// as "1." and not as "1 .", while `<p>a</p><p>b</p>` must not become "ab".
const INLINE_TAG = /^<\/?(?:strong|em|b|i|a|code|span|sup|sub|u|s|del|ins|mark|small)\b/i

const collapse = (s) =>
  decodeEntities(s.replace(/<[^>]+>/g, (t) => (INLINE_TAG.test(t) ? '' : ' ')))
    .replace(/\s+/g, ' ')
    .trim()

/**
 * Re-render the produced markdown with the app's own `marked` options and compare
 * its plain text to the source's. Catches a dropped character, a leaked `*`, and a
 * line that silently became a list.
 */
function verifyRoundTrip(markdown, sourceHtml) {
  const rendered = collapse(marked.parse(markdown, { async: false, breaks: true }))
  const expected = collapse(bodyToMarkdown(sourceHtml, { plain: true }))
  if (rendered === expected) return null
  let i = 0
  while (i < rendered.length && rendered[i] === expected[i]) i++
  const from = Math.max(0, i - 60)
  return {
    at: i,
    rendered: rendered.slice(from, i + 60),
    expected: expected.slice(from, i + 60),
  }
}

// --- ids ----------------------------------------------------------------------

// The ligatures the Latin titles are full of (æ, œ, ǽ) don't decompose under NFD, so
// they are spelled out first — otherwise "Regína cæli" would slug to "regina-c-li".
const SLUG_LIGATURES = [
  [/[æǽ]/g, 'ae'],
  [/[ÆǼ]/g, 'ae'],
  [/[œ]/g, 'oe'],
  [/[Œ]/g, 'oe'],
  [/ø/gi, 'o'],
  [/ß/g, 'ss'],
]

function slugify(title) {
  let s = title.normalize('NFD').replace(/[̀-ͯ]/g, '')
  for (const [re, to] of SLUG_LIGATURES) s = s.replace(re, to)
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

// --- main ---------------------------------------------------------------------

async function main() {
  const args = process.argv.slice(2)
  const force = args.includes('--force')
  const onlyArg = args.find((a) => a.startsWith('--only'))
  const only = onlyArg ? new Set((onlyArg.split('=')[1] ?? args[args.indexOf(onlyArg) + 1]).split(',')) : null

  const prayers = []
  const notes = []
  const failures = []

  for (const section of SECTIONS) {
    if (only && !only.has(section.slug)) continue
    const html = await fetchSection(section, force)
    const wrappers = prayerWrappers(html)
    if (wrappers.length !== section.count) {
      failures.push(`${section.slug}: expected ${section.count} prayers, parsed ${wrappers.length}`)
    }

    wrappers.forEach((wrapper, index) => {
      const titles = parseTitles(wrapper.inner)
      const label = titles.pt ?? titles.la
      const prayerHtml = findElement(wrapper.inner, 'div', /<div class="prayer">/)
      if (prayerHtml === null) {
        failures.push(`${section.slug} #${index} (${label}): no .prayer div`)
        return
      }

      // One body div per language, keyed by its lang attribute rather than by its
      // left/right class — the column a language sits in is presentation.
      const bodies = {}
      const re = /<div\b([^>]*lang="([^"]+)"[^>]*)>/g
      let m
      while ((m = re.exec(prayerHtml)) !== null) {
        const { inner, end } = sliceElement(prayerHtml, 'div', m.index + m[0].length)
        const lang = m[2].startsWith('pt') ? 'pt' : m[2] === 'la' ? 'la' : null
        if (lang && !bodies[lang]) bodies[lang] = inner
        re.lastIndex = end
      }
      if (!bodies.pt && !bodies.la) {
        failures.push(`${section.slug} #${index} (${label}): no body in any language`)
        return
      }
      // A wrapper's `double` class and the languages it actually carries must agree,
      // and each title must have a body of its own language.
      if (wrapper.isDouble !== !!(bodies.pt && bodies.la)) {
        notes.push(
          `${section.slug} / ${label}: wrapper marked ${
            wrapper.isDouble ? 'double' : 'single'
          } but carries ${Object.keys(bodies).join('+') || 'nothing'}`
        )
      }
      for (const lang of ['pt', 'la']) {
        if (!!titles[lang] !== !!bodies[lang]) {
          notes.push(
            `${section.slug} / ${label}: ${lang} ${titles[lang] ? 'title without a body' : 'body without a title'}`
          )
        }
      }

      const texts = {}
      for (const lang of ['pt', 'la']) {
        if (!bodies[lang]) continue
        const md = bodyToMarkdown(bodies[lang])
        if (!md) {
          failures.push(`${section.slug} / ${label} [${lang}]: empty body`)
          continue
        }
        const diff = verifyRoundTrip(md, bodies[lang])
        if (diff) {
          failures.push(
            `${section.slug} / ${label} [${lang}]: round-trip mismatch at char ${diff.at}\n` +
              `      rendered: …${diff.rendered}…\n` +
              `      expected: …${diff.expected}…`
          )
        }
        texts[lang] = md
      }

      const title = {}
      if (titles.pt) title.pt = titles.pt
      if (titles.la) title.la = titles.la

      prayers.push({
        id: slugify(label),
        section: section.slug,
        title,
        texts,
        sortOrder: index,
      })
    })
  }

  // Deterministic ids: a slug collision is disambiguated with the section slug,
  // then with an ordinal. Both devices seed from this same file, so the ids are
  // what makes the no-tombstone sync merge converge on one row per prayer.
  const byId = new Map()
  for (const p of prayers) {
    const list = byId.get(p.id) ?? []
    list.push(p)
    byId.set(p.id, list)
  }
  for (const [id, list] of byId) {
    if (list.length === 1) continue
    notes.push(`id collision "${id}" → ${list.map((p) => `${p.section}`).join(', ')}`)
    const seen = new Set()
    for (const p of list) {
      let candidate = `${id}-${p.section}`
      let n = 2
      while (seen.has(candidate) || (byId.has(candidate) && byId.get(candidate)[0] !== p)) {
        candidate = `${id}-${p.section}-${n++}`
      }
      seen.add(candidate)
      p.id = candidate
    }
  }

  // Source quirks worth a human's eyes rather than a silent normalization: the site
  // often omits the space after a rubric ("Antífona.Seu reinado…"). Kept verbatim.
  const missingSpace = prayers
    // Detectable via the HTML fallback: markdown emphasis is only ever emitted where
    // it is safe, so a rubric that abuts a letter is always a <strong>/<em> run.
    .filter((p) => Object.values(p.texts).some((t) => /<\/(?:strong|em)>\p{L}/u.test(t)))
    .map((p) => p.id)
  if (missingSpace.length) {
    notes.push(
      `${missingSpace.length} prayer(s) run a rubric straight into the next word with no space, ` +
        `as the source does: ${missingSpace.join(', ')}`
    )
  }

  if (failures.length) {
    console.error(`\n${failures.length} FAILURE(S):`)
    for (const f of failures) console.error(`  - ${f}`)
  }
  if (notes.length) {
    console.log(`\n${notes.length} note(s):`)
    for (const n of notes) console.log(`  - ${n}`)
  }

  if (failures.length) {
    console.error('\nNot writing devocionario.json.')
    process.exit(1)
  }

  const out = {
    sections: SECTIONS.map(({ slug, namePt }) => ({ slug, namePt })),
    prayers,
  }
  await writeFile(OUT_PATH, `${JSON.stringify(out, null, 2)}\n`)

  const bytes = Buffer.byteLength(JSON.stringify(out))
  const withLatin = prayers.filter((p) => p.texts.la).length
  console.log(
    `\nWrote ${prayers.length} prayers (${withLatin} bilingual) across ${out.sections.length} sections — ${(
      bytes / 1024
    ).toFixed(0)} KB → ${path.relative(process.cwd(), OUT_PATH)}`
  )
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
