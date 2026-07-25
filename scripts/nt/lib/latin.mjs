// Clementine Vulgate New Testament, loaded from the liturgy build's cache and
// repaired. BUILD-TIME ONLY — never imported by the app.
//
// The Latin comes from the SAME cache the Liturgia do Dia store was built from
// (scripts/liturgy/.cache/vulgate/normalized.json, scrollmapper's VulgClementine),
// so the daily readings and this reader can never disagree about a verse.
//
// That upstream data has three defects in the NT, all found by diffing per-chapter
// verse counts against the Portuguese (Matos Soares translated from the Vulgate, so
// the two versifications should agree verse for verse):
//
//   - John 11:57 and 2Cor 1:24 are EMPTY, because the verse's text was concatenated
//     onto the end of the preceding verse. Repaired below by splitting at the known
//     boundary — each split point is verifiable against the Portuguese, which has
//     both verses intact and separate.
//   - 3John 1:15 is empty because the Clementine numbering ends at 14; there is no
//     verse 15 to recover. Dropped as a phantom.
//
// Everything else is passed through untouched.

import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { NT_BOOKS } from '../../../src/data/nt/books.ts'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const VULGATE_PATH = path.join(
  __dirname,
  '..',
  '..',
  'liturgy',
  '.cache',
  'vulgate',
  'normalized.json'
)

/**
 * Verses whose text was merged into the previous verse upstream. `splitAt` is the
 * first word(s) of the verse that went missing; everything from there to the end of
 * the host verse belongs to `verse`, and the host keeps the rest.
 *
 * `hostReplacement`/`verseReplacement`, when given, override the split result — used
 * only for 2Cor 1:24, where the upstream text also carries the typo "fidei vestæ"
 * for "fidei vestræ" inside the stretch being moved.
 */
const MERGED_VERSE_FIXES = [
  {
    book: 'John',
    chapter: 11,
    host: 56,
    verse: 57,
    splitAt: 'Dederant autem pontifices',
  },
  {
    book: '2Cor',
    chapter: 1,
    host: 23,
    verse: 24,
    splitAt: 'non quia dominamur',
    verseReplacement:
      'non quia dominamur fidei vestræ, sed adjutores sumus gaudii vestri: nam fide statis.',
  },
]

/** Empty upstream verses that are NOT recoverable text — they simply don't exist. */
const PHANTOM_VERSES = [{ book: '3John', chapter: 1, verse: 15 }]

/**
 * Load the NT half of the Vulgate with the repairs applied.
 * Returns { [bookKey]: { [chapter]: { [verse]: latinText } } } and a report of what
 * was changed, so callers can print it instead of silently rewriting scripture.
 */
export async function loadLatinNt() {
  let rawText
  try {
    rawText = await readFile(VULGATE_PATH, 'utf8')
  } catch {
    throw new Error(
      `[latin] Vulgate cache not found at ${VULGATE_PATH} — run \`node scripts/liturgy/fetch-vulgate.mjs\` first (it also regenerates normalized.json on next use)`
    )
  }
  const all = JSON.parse(rawText)
  const out = {}
  for (const book of NT_BOOKS) {
    const src = all[book.key]
    if (!src) throw new Error(`[latin] Vulgate cache has no book "${book.key}"`)
    const chapters = {}
    for (const [c, verses] of Object.entries(src)) chapters[c] = { ...verses }
    out[book.key] = chapters
  }

  const applied = []

  for (const fix of MERGED_VERSE_FIXES) {
    const chapter = out[fix.book]?.[String(fix.chapter)]
    const hostText = chapter?.[String(fix.host)]
    if (!chapter || hostText === undefined) {
      throw new Error(`[latin] repair target missing: ${fix.book} ${fix.chapter}:${fix.host}`)
    }
    // Already correct upstream (a future re-fetch may fix it) — leave it alone.
    if (chapter[String(fix.verse)]) continue
    const at = hostText.indexOf(fix.splitAt)
    if (at === -1) {
      throw new Error(
        `[latin] repair for ${fix.book} ${fix.chapter}:${fix.verse} no longer applies — "${fix.splitAt}" not found in verse ${fix.host}. Re-check the upstream data before building.`
      )
    }
    chapter[String(fix.host)] = fix.hostReplacement ?? hostText.slice(0, at).trim()
    chapter[String(fix.verse)] = fix.verseReplacement ?? hostText.slice(at).trim()
    applied.push(`split ${fix.book} ${fix.chapter}:${fix.host} → ${fix.chapter}:${fix.verse}`)
  }

  for (const phantom of PHANTOM_VERSES) {
    const chapter = out[phantom.book]?.[String(phantom.chapter)]
    if (chapter && chapter[String(phantom.verse)] !== undefined && !chapter[String(phantom.verse)].trim()) {
      delete chapter[String(phantom.verse)]
      applied.push(`dropped phantom ${phantom.book} ${phantom.chapter}:${phantom.verse}`)
    }
  }

  // Nothing else may be empty: an empty verse would render as a blank line in the
  // reader and silently break the verse pairing.
  const stillEmpty = []
  for (const [bookKey, chapters] of Object.entries(out)) {
    for (const [c, verses] of Object.entries(chapters)) {
      for (const [v, text] of Object.entries(verses)) {
        if (!text.trim()) stillEmpty.push(`${bookKey} ${c}:${v}`)
      }
    }
  }
  if (stillEmpty.length) {
    throw new Error(`[latin] ${stillEmpty.length} empty verse(s) remain: ${stillEmpty.join(', ')}`)
  }

  return { latin: out, applied }
}
