import chaptersJson from './escriva_chapters.json'
import { BOOKS, bookMax, type BookKey } from './meditation'

// St. Josemaría's three books of points — Caminho, Sulco, Forja — as the Devocionário
// shows them: whole books, chapter by chapter. The point text is the same bundled
// escriva_points.json the Meditação reader draws from (lazy-loaded through
// loadEscrivaPoints in ./meditation); the chapters are small enough to ship in the
// main bundle, so a book's table of contents renders before the text has loaded.
// Both are built from escriva.org by scripts/build-escriva-points.mjs.

export interface EscrivaChapter {
  /** escriva.org's slug for the chapter, e.g. "exame-de-consciencia". */
  slug: string
  title: string
  /** First and last point number, inclusive. The chapters tile the book exactly. */
  first: number
  last: number
}

export const CHAPTERS = chaptersJson as Record<BookKey, EscrivaChapter[]>

export function isBookKey(value: string | undefined): value is BookKey {
  return BOOKS.some((b) => b.key === value)
}

export function bookLabel(book: BookKey): string {
  return BOOKS.find((b) => b.key === book)?.label ?? book
}

/** True when `n` is a point the book actually has. */
export function isPointInBook(book: BookKey, n: number): boolean {
  return Number.isInteger(n) && n >= 1 && n <= bookMax(book)
}

/** Index into CHAPTERS[book] of the chapter holding point `n`, or -1. */
export function chapterIndexOf(book: BookKey, n: number): number {
  return CHAPTERS[book].findIndex((c) => n >= c.first && n <= c.last)
}

export function chapterOf(book: BookKey, n: number): EscrivaChapter | null {
  return CHAPTERS[book][chapterIndexOf(book, n)] ?? null
}

/** In-app path of a point: the reader opens its chapter, scrolled to it. */
export function pointPath(book: BookKey, n: number): string {
  return `/devocionario/pontos/${book}/${n}`
}

/** In-app path of a book's table of contents. */
export function bookPath(book: BookKey): string {
  return `/devocionario/pontos/${book}`
}
