// Loads and normalizes the Clementine Vulgate for the ref-resolver.
// BUILD-TIME ONLY — never imported by the app.

import { readFile, writeFile, stat } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { RAW_NAME_TO_BOOK_ID } from './books.mjs'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const CACHE_DIR = path.join(__dirname, '..', '.cache', 'vulgate')
const RAW_PATH = path.join(CACHE_DIR, 'VulgClementine.raw.json')
const NORMALIZED_PATH = path.join(CACHE_DIR, 'normalized.json')

let cached = null

async function exists(p) {
  try {
    await stat(p)
    return true
  } catch {
    return false
  }
}

/**
 * Normalize the raw scrollmapper structure into
 * { bookId: { [chapter: string]: { [verse: string]: text } } }.
 * Books not present in RAW_NAME_TO_BOOK_ID (the four non-lectionary extras)
 * are skipped.
 */
export function normalizeRaw(raw) {
  const out = {}
  for (const book of raw.books) {
    const bookId = RAW_NAME_TO_BOOK_ID[book.name]
    if (!bookId) continue // e.g. "Prayer of Manasses" — not in the lectionary
    const chapters = {}
    for (const ch of book.chapters) {
      const verses = {}
      for (const v of ch.verses) {
        verses[String(v.verse)] = v.text
      }
      chapters[String(ch.chapter)] = verses
    }
    out[bookId] = chapters
  }
  return out
}

async function buildNormalized() {
  if (!(await exists(RAW_PATH))) {
    throw new Error(
      `[vulgate] raw source not found at ${RAW_PATH} — run \`node scripts/liturgy/fetch-vulgate.mjs\` first`,
    )
  }
  const rawText = await readFile(RAW_PATH, 'utf8')
  const raw = JSON.parse(rawText)
  const normalized = normalizeRaw(raw)
  await writeFile(NORMALIZED_PATH, JSON.stringify(normalized), 'utf8')
  return normalized
}

/** Load the normalized Vulgate, building it from the raw cache if needed. Memoized. */
export async function loadVulgate() {
  if (cached) return cached
  if (await exists(NORMALIZED_PATH)) {
    cached = JSON.parse(await readFile(NORMALIZED_PATH, 'utf8'))
    return cached
  }
  cached = await buildNormalized()
  return cached
}

export async function hasBook(bookId) {
  const v = await loadVulgate()
  return Object.prototype.hasOwnProperty.call(v, bookId)
}

export async function hasChapter(bookId, chapter) {
  const v = await loadVulgate()
  const book = v[bookId]
  if (!book) return false
  return Object.prototype.hasOwnProperty.call(book, String(chapter))
}

/** Highest verse number in a chapter, or null if the chapter doesn't exist. */
export async function lastVerse(bookId, chapter) {
  const v = await loadVulgate()
  const ch = v[bookId]?.[String(chapter)]
  if (!ch) return null
  const nums = Object.keys(ch).map(Number)
  return nums.length ? Math.max(...nums) : null
}

/**
 * Verses [fromVerse, toVerse] inclusive from bookId/chapter.
 * toVerse may be the string 'end' to mean "through the last verse of the
 * chapter" (used for cross-chapter range splits — see ref-parse.mjs).
 * Returns null if the book or chapter doesn't exist. Returns an array
 * (possibly empty, if the chapter exists but the requested verses don't)
 * otherwise — callers that want to distinguish "missing chapter" from
 * "chapter exists but empty result" should use hasBook/hasChapter first.
 */
export async function getVerses(bookId, chapter, fromVerse, toVerse) {
  const v = await loadVulgate()
  const ch = v[bookId]?.[String(chapter)]
  if (!ch) return null
  const to = toVerse === 'end' ? (await lastVerse(bookId, chapter)) ?? fromVerse : toVerse
  const result = []
  for (let n = fromVerse; n <= to; n++) {
    const text = ch[String(n)]
    if (text !== undefined) result.push({ verse: n, text })
  }
  return result
}
