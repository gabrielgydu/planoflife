import { BOOKS, type BookKey, type EscrivaPoints } from './meditation'
import { CHAPTERS, isPointInBook, type EscrivaChapter } from './escriva'
import { REF_HEADING, pointPlainText } from './escrivaText'
import { MIN_QUERY_LENGTH, fold, quoteAround } from './prayerSearch'

// Search over Caminho, Sulco and Forja (3054 points) for the Devocionário. Same
// folding as the prayer search — case, accents and ligatures never matter — plus
// two things a book of numbered points needs: a number is a reference ("238" is
// that point in all three books, "sulco 35" is one point), and several words match
// a point that holds them all in any order, ranked after the points that hold the
// exact phrase.

/** Every alias a book answers to in a reference, folded; the Spanish titles too. */
const BOOK_ALIASES: { book: BookKey; names: string[] }[] = [
  { book: 'caminho', names: ['caminho', 'camino'] },
  { book: 'sulco', names: ['sulco', 'surco'] },
  { book: 'forja', names: ['forja'] },
]

export interface PointRef {
  /** null = the number in every book that has it. */
  book: BookKey | null
  n: number
}

/**
 * "238", "nº 238", "c238", "cam. 238", "Caminho, 238", "sulco 35", "f 1000" → a
 * reference; anything else → null. A book is named by any prefix of its title (one
 * letter is enough: the three start with different letters).
 */
export function parsePointRef(query: string): PointRef | null {
  const q = fold(query)
    .replace(/[,#]/g, ' ')
    // "nº 238", "n.º 238", "n. 238", "no 238" — the number sign, however it is typed.
    .replace(/\bn(?:\.?[º°]|\.|o)\s*(?=\d)/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
  const m = /^(?:([a-z]+)\.?\s*)?(\d{1,4})$/.exec(q)
  if (!m) return null
  const n = Number(m[2])
  if (n < 1) return null
  if (!m[1]) return { book: null, n }
  const word = m[1]
  const hit = BOOK_ALIASES.find((a) => a.names.some((name) => name.startsWith(word)))
  return hit ? { book: hit.book, n } : null
}

/** Shorter text queries match too much; a bare number is a reference at any length. */
export function isSearchQuery(query: string): boolean {
  return fold(query.trim()).length >= MIN_QUERY_LENGTH || parsePointRef(query) !== null
}

/** The points a reference resolves to, in book order; an out-of-range number drops out. */
export function resolvePointRef(ref: PointRef): { book: BookKey; n: number }[] {
  return BOOKS.filter((b) => (ref.book === null || ref.book === b.key) && isPointInBook(b.key, ref.n)).map(
    (b) => ({ book: b.key, n: ref.n })
  )
}

export interface PointIndexEntry {
  book: BookKey
  n: number
  /** The point as plain text (see pointPlainText), for quotes. */
  text: string
  /** Folded, whitespace collapsed, without the reference block's heading. */
  folded: string
}

// Folding all 3054 points is the one slow step (~75 ms on a laptop, several times
// that on a phone), so the index is built once per loaded corpus, in small slices
// between frames (warmPointIndex) — and whatever is left is finished on the spot if
// a search needs it before then (buildPointIndex).
interface IndexBuild {
  points: EscrivaPoints
  queue: { book: BookKey; n: number; markdown: string }[]
  entries: PointIndexEntry[]
}
let build: IndexBuild | null = null

function buildFor(points: EscrivaPoints): IndexBuild {
  if (build?.points !== points) {
    const queue = BOOKS.flatMap(({ key }) =>
      Object.entries(points[key] ?? {})
        .map(([num, markdown]) => ({ book: key, n: Number(num), markdown }))
        .sort((a, b) => a.n - b.n)
    )
    build = { points, queue, entries: [] }
  }
  return build
}

function indexSome(b: IndexBuild, count: number) {
  const end = Math.min(b.queue.length, b.entries.length + count)
  for (let i = b.entries.length; i < end; i++) {
    const { book, n, markdown } = b.queue[i]
    const text = pointPlainText(markdown)
    // The citations of the "Referências da Sagrada Escritura" block stay searchable
    // ("Lucas 11" finds the points that cite it); its heading does not, or "sagrada
    // escritura" would match every point that has the block.
    const folded = fold(text.split(REF_HEADING).join(' ')).replace(/\s+/g, ' ')
    b.entries.push({ book, n, text, folded })
  }
}

/** The complete index, in book order then point order. */
function buildPointIndex(points: EscrivaPoints): PointIndexEntry[] {
  const b = buildFor(points)
  indexSome(b, Infinity)
  return b.entries
}

/** Build the index in the background, a slice per task. Returns a cancel function. */
export function warmPointIndex(points: EscrivaPoints): () => void {
  let timer: ReturnType<typeof setTimeout> | undefined
  const tick = () => {
    const b = buildFor(points)
    indexSome(b, 250)
    if (b.entries.length < b.queue.length) timer = setTimeout(tick, 0)
  }
  timer = setTimeout(tick, 0)
  return () => clearTimeout(timer)
}

function bookOrder(book: BookKey): number {
  return BOOKS.findIndex((b) => b.key === book)
}

const escapeRegExp = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

/**
 * Matches `phrase` where a word starts — "oração" must not find every "coração",
 * and "fe" not every "café". A word may still continue ("amor" finds "amoroso").
 */
function wordStartPattern(phrase: string): RegExp {
  return new RegExp(`(?:^|[^\\p{L}\\p{N}])${escapeRegExp(phrase)}`, 'u')
}

export interface PointHit {
  entry: PointIndexEntry
  /** True when the point holds the exact phrase, not just every word of it. */
  phrase: boolean
}

/**
 * Text matches, grouped by book in book order; inside a book the phrase matches
 * come first, then the all-words ones, each in point order. A query too short to
 * search returns before the index is touched, so it never forces the build.
 */
export function searchPoints(points: EscrivaPoints, query: string): PointHit[] {
  const q = fold(query.trim()).replace(/\s+/g, ' ')
  if (q.length < MIN_QUERY_LENGTH) return []
  const entries = buildPointIndex(points)
  const phrase = wordStartPattern(q)
  const words = q.split(' ')
  const each = words.length > 1 ? words.map(wordStartPattern) : []

  const hits: (PointHit & { rank: number; i: number })[] = []
  entries.forEach((entry, i) => {
    // A cheap substring test first: most points hold neither, and skip the regex.
    if (entry.folded.includes(q) && phrase.test(entry.folded)) {
      hits.push({ entry, phrase: true, rank: 0, i })
    } else if (each.length && each.every((re) => re.test(entry.folded))) {
      hits.push({ entry, phrase: false, rank: 1, i })
    }
  })
  return hits
    .sort((a, b) => bookOrder(a.entry.book) - bookOrder(b.entry.book) || a.rank - b.rank || a.i - b.i)
    .map(({ entry, phrase }) => ({ entry, phrase }))
}

/** One line of the point around what was typed — the phrase, else its first word. */
export function pointSnippet(hit: PointHit, query: string): string {
  const text = hit.entry.text
  const opts = { wordStart: true }
  if (hit.phrase) return quoteAround(text, query, 40, undefined, opts) ?? text
  for (const word of fold(query.trim()).split(/\s+/)) {
    const quote = word.length >= MIN_QUERY_LENGTH ? quoteAround(text, word, 40, undefined, opts) : null
    if (quote) return quote
  }
  return text
}

export interface ChapterHit {
  book: BookKey
  chapter: EscrivaChapter
}

/** Chapters whose title holds the query ("oração" → Caminho 81–117, Sulco 444–481). */
export function searchChapters(query: string): ChapterHit[] {
  const q = fold(query.trim()).replace(/\s+/g, ' ')
  if (q.length < MIN_QUERY_LENGTH) return []
  const pattern = wordStartPattern(q)
  return BOOKS.flatMap(({ key }) =>
    CHAPTERS[key].filter((c) => pattern.test(fold(c.title))).map((chapter) => ({ book: key, chapter }))
  )
}

/** Books whose title the query is the start of ("cam" → Caminho). */
export function searchBooks(query: string): BookKey[] {
  const q = fold(query.trim())
  if (q.length < 3) return []
  return BOOK_ALIASES.filter((a) => a.names.some((name) => name.startsWith(q))).map((a) => a.book)
}
