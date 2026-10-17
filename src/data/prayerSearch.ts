import { prayerLangs, sectionName } from './devocionario'
import type { Prayer } from '../types'

// Search over the prayer book. Accent- and case-insensitive in both directions, so
// "oracao" finds "Oração" and "Oração" finds "oracao" — nobody types the Latin
// accents ("Regína cæli", "sǽcula") and half the Portuguese ones are a nuisance on
// a phone keyboard. The Latin ligatures are spelled out for the same reason:
// typing "caeli" has to find "cæli". Typographic dashes and quotes become the ones a
// keyboard types: a citation reads "Lucas 11, 1–4" and nobody long-presses for the
// en dash, while iOS turns a typed " into “ — so neither side can be trusted to
// have the plain one.
const FOLDS: [RegExp, string][] = [
  [/[æǽ]/g, 'ae'],
  [/œ/g, 'oe'],
  [/ø/g, 'o'],
  [/ß/g, 'ss'],
  [/[‐‑‒–—−]/g, '-'],
  [/[“”„]/g, '"'],
  [/[‘’]/g, "'"],
]

/** Lowercase, strip diacritics, spell out ligatures, plain dashes and quotes. */
export function fold(s: string): string {
  let out = s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
  for (const [re, to] of FOLDS) out = out.replace(re, to)
  return out
}

/**
 * Like fold(), but also returns, for every character of the result, the index it
 * came from in the input. Folding can change a string's length (æ → ae, á → a), so
 * a match found in the folded text can only be located in the ORIGINAL text through
 * this map — which is what lets a snippet quote the prayer as it is really written.
 * Character by character, so the one context-dependent lowercasing, Greek final
 * sigma, gives σ where fold() gives ς; no text in the app is Greek.
 */
function foldWithMap(s: string): { folded: string; sourceIndex: number[] } {
  let folded = ''
  const sourceIndex: number[] = []
  for (let i = 0; i < s.length; i++) {
    // ASCII folds to itself, lowercased — most of any Portuguese or Latin text, and
    // skipping the per-character normalize for it is what keeps a page of search
    // snippets cheap. Same result as the general path below.
    const code = s.charCodeAt(i)
    if (code < 0x80) {
      folded += code >= 0x41 && code <= 0x5a ? String.fromCharCode(code + 0x20) : s[i]
      sourceIndex.push(i)
      continue
    }
    let piece = s[i].toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
    for (const [re, to] of FOLDS) piece = piece.replace(re, to)
    for (const ch of piece) {
      folded += ch
      sourceIndex.push(i)
    }
  }
  return { folded, sourceIndex }
}

export interface PrayerSearchEntry {
  prayer: Prayer
  /** Folded titles (all languages) joined — matched first and ranked highest. */
  title: string
  /** Folded bodies (all languages) joined. */
  body: string
}

/** Build the folded index once per prayer list, not once per keystroke. */
export function buildSearchIndex(prayers: Prayer[]): PrayerSearchEntry[] {
  return prayers.map((prayer) => ({
    prayer,
    title: fold(
      [prayer.title.pt, prayer.title.la, sectionName(prayer.section)].filter(Boolean).join(' ')
    ),
    body: fold(prayerLangs(prayer).map((l) => prayer.texts[l]).join('\n')),
  }))
}

export interface PrayerSearchResult {
  prayer: Prayer
  /** True when the query only appears in the prayer's text, not in its title. */
  bodyOnly: boolean
}

/** Shorter queries match too much of an 88-prayer book to be worth showing. */
export const MIN_QUERY_LENGTH = 2

/**
 * Title matches first (a title starting with the query before one merely containing
 * it), then text-only matches. Within a rank the book's own order is kept, since
 * `entries` arrives already sorted.
 */
export function searchPrayers(
  entries: PrayerSearchEntry[],
  query: string
): PrayerSearchResult[] {
  const q = fold(query.trim())
  if (q.length < MIN_QUERY_LENGTH) return []

  const ranked: { result: PrayerSearchResult; rank: number }[] = []
  for (const entry of entries) {
    const at = entry.title.indexOf(q)
    if (at === 0) ranked.push({ result: { prayer: entry.prayer, bodyOnly: false }, rank: 0 })
    else if (at > 0) ranked.push({ result: { prayer: entry.prayer, bodyOnly: false }, rank: 1 })
    else if (entry.body.includes(q))
      ranked.push({ result: { prayer: entry.prayer, bodyOnly: true }, rank: 2 })
  }
  return ranked
    .map((r, i) => ({ ...r, i }))
    .sort((a, b) => a.rank - b.rank || a.i - b.i)
    .map((r) => r.result)
}

/**
 * A one-line quote of `text` around the first match of `query`, or null when it
 * isn't there. The match is found in the folded text but cut out of the ORIGINAL,
 * so the quote reads as the text is really written. `clean` tidies the cut slice
 * (e.g. drops markup) before its whitespace is collapsed.
 */
export function quoteAround(
  text: string,
  query: string,
  radius = 40,
  clean: (slice: string) => string = (slice) => slice,
  { wordStart = false }: { wordStart?: boolean } = {}
): string | null {
  const q = fold(query.trim())
  if (q.length < MIN_QUERY_LENGTH) return null

  // A space in the query matches any whitespace run, so a phrase that wraps onto
  // the next line or paragraph of the text is still found. `wordStart` quotes the
  // match a word-start search actually made ("oração", not the "coração" before it).
  const body = q
    .split(/\s+/)
    .map((word) => word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
    .join('\\s+')
  const pattern = new RegExp(wordStart ? `(^|[^\\p{L}\\p{N}])(${body})` : `()(${body})`, 'u')
  const { folded, sourceIndex } = foldWithMap(text)
  const match = pattern.exec(folded)
  if (!match) return null

  const at = match.index + match[1].length
  const start = sourceIndex[Math.max(0, at - radius)]
  const endFolded = Math.min(folded.length - 1, at + match[2].length + radius)
  const end = sourceIndex[endFolded] + 1
  const quote = clean(text.slice(start, end)).replace(/\s+/g, ' ').trim()
  const prefix = start > 0 ? '…' : ''
  const suffix = end < text.length ? '…' : ''
  return `${prefix}${quote}${suffix}`
}

// Markdown emphasis and escapes are noise in a one-line quote.
const stripPrayerMarkdown = (slice: string) =>
  slice
    .replace(/<\/?(?:strong|em)>/g, '')
    .replace(/\*{1,2}/g, '')
    .replace(/\\([.)\-+*#>=_])/g, '$1')

/**
 * A one-line quote of the prayer around the first match, for a text-only hit — the
 * row would otherwise show a title that has nothing to do with what was typed.
 * Returns null when the query isn't in the body after all.
 */
export function matchSnippet(prayer: Prayer, query: string, radius = 40): string | null {
  for (const lang of prayerLangs(prayer)) {
    const text = prayer.texts[lang]
    if (!text) continue
    const quote = quoteAround(text, query, radius, stripPrayerMarkdown)
    if (quote !== null) return quote
  }
  return null
}
