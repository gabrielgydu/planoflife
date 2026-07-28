import { prayerLangs, sectionName } from './devocionario'
import type { Prayer } from '../types'

// Search over the prayer book. Accent- and case-insensitive in both directions, so
// "oracao" finds "Oração" and "Oração" finds "oracao" — nobody types the Latin
// accents ("Regína cæli", "sǽcula") and half the Portuguese ones are a nuisance on
// a phone keyboard. The Latin ligatures are spelled out for the same reason:
// typing "caeli" has to find "cæli".
const LIGATURES: [RegExp, string][] = [
  [/[æǽ]/g, 'ae'],
  [/œ/g, 'oe'],
  [/ø/g, 'o'],
  [/ß/g, 'ss'],
]

/** Lowercase, strip diacritics, spell out ligatures. */
export function fold(s: string): string {
  let out = s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
  for (const [re, to] of LIGATURES) out = out.replace(re, to)
  return out
}

/**
 * Like fold(), but also returns, for every character of the result, the index it
 * came from in the input. Folding can change a string's length (æ → ae, á → a), so
 * a match found in the folded text can only be located in the ORIGINAL text through
 * this map — which is what lets a snippet quote the prayer as it is really written.
 */
function foldWithMap(s: string): { folded: string; sourceIndex: number[] } {
  let folded = ''
  const sourceIndex: number[] = []
  for (let i = 0; i < s.length; i++) {
    let piece = s[i].toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
    for (const [re, to] of LIGATURES) piece = piece.replace(re, to)
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
 * A one-line quote of the prayer around the first match, for a text-only hit — the
 * row would otherwise show a title that has nothing to do with what was typed.
 * Returns null when the query isn't in the body after all.
 */
export function matchSnippet(prayer: Prayer, query: string, radius = 40): string | null {
  const q = fold(query.trim())
  if (q.length < MIN_QUERY_LENGTH) return null

  for (const lang of prayerLangs(prayer)) {
    const text = prayer.texts[lang]
    if (!text) continue
    const { folded, sourceIndex } = foldWithMap(text)
    const at = folded.indexOf(q)
    if (at === -1) continue

    const start = sourceIndex[Math.max(0, at - radius)]
    const endFolded = Math.min(folded.length - 1, at + q.length + radius)
    const end = sourceIndex[endFolded] + 1
    // Markdown emphasis and escapes are noise in a one-line quote.
    const quote = text
      .slice(start, end)
      .replace(/<\/?(?:strong|em)>/g, '')
      .replace(/\*{1,2}/g, '')
      .replace(/\\([.)\-+*#>=_])/g, '$1')
      .replace(/\s+/g, ' ')
      .trim()
    const prefix = start > 0 ? '…' : ''
    const suffix = end < text.length ? '…' : ''
    return `${prefix}${quote}${suffix}`
  }
  return null
}
