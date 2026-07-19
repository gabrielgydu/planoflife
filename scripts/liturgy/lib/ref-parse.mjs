// Parses Brazilian lectionary citations (the `referencia` fields of the
// liturgia.up.railway.app API) into book/chapter/verse segments.
// BUILD-TIME ONLY. Never throws — unparseable input returns { segments:
// null, reason }.

import { resolveBookId, ABBREV_KEYS_BY_LENGTH, SINGLE_CHAPTER_BOOKS } from './books.mjs'
import { resolvePsalmRef } from './psalm-map.mjs'

// Longest-first so e.g. "1Cor" is tried before shorter prefixes that could
// otherwise match first.
const SORTED_ABBREVS = ABBREV_KEYS_BY_LENGTH

/** Strip a lectionary-style verse-letter subdivision, e.g. "17a" -> 17, "12b" -> 12. */
function stripVerseLetter(token) {
  const m = /^(\d+)\s*[a-zA-Z]*$/.exec(token.trim())
  return m ? parseInt(m[1], 10) : null
}

/**
 * Per-piece cleanup run before any structural parsing:
 *  - drops stray artifact characters seen in the harvested corpus (e.g. "¬¬")
 *  - drops a trailing " ou <alternate form>" clause, keeping only the
 *    primary ("forma longa") reading — the API represents optional
 *    shorter alternatives this way; there's no single "correct" Latin for
 *    an either/or reading, so we keep the fuller one and warn
 *  - strips trailing descriptive/annotation parentheticals, e.g.
 *    "(mais breve)", "(Entrada em Jerusalém)", "(R. 4a)", "(R. cf. 7c)".
 *    Only parens preceded by whitespace are stripped, so a psalm's dual-
 *    numbering paren ("97(98)", no space before "(") is never touched.
 */
function cleanPiece(rawPiece) {
  const warnings = []
  let s = rawPiece.replace(/¬/g, '')

  const ouIdx = s.search(/\s+ou\s+/i)
  if (ouIdx !== -1) {
    warnings.push(`alternate-form-dropped: kept "${s.slice(0, ouIdx).trim()}", discarded "${s.slice(ouIdx).trim()}"`)
    s = s.slice(0, ouIdx)
  }

  while (true) {
    const m = /\s+\([^()]*\)\s*$/.exec(s)
    if (!m) break
    // Don't strip if nothing digit-bearing would remain — that means the
    // paren IS the reference content (a canticle substitution like
    // "Sl (Tb 13)"), not a descriptive annotation.
    const remainder = s.slice(0, m.index).trim()
    if (!/\d/.test(remainder)) break
    warnings.push(`annotation-stripped: "${m[0].trim()}"`)
    s = s.slice(0, m.index)
  }

  return { cleaned: s.trim(), warnings }
}

/** Try to match a book abbreviation at the start of `s`. Returns {bookId, rest} or null. */
function matchBook(s) {
  // Collapse "1 Cor" -> "1Cor" etc. (space between a leading ordinal digit
  // and the book name) without touching anything further in the string.
  const trimmed = s.trimStart().replace(/^(\d)\s+(?=[A-Za-zÀ-ÿ])/, '$1')
  for (const abbrev of SORTED_ABBREVS) {
    if (trimmed.toLowerCase().startsWith(abbrev.toLowerCase())) {
      const after = trimmed.slice(abbrev.length)
      // Require a boundary: whitespace, digit, or comma right after the
      // abbrev (a stray "Book, chapter,verse" comma is tolerated defensively).
      if (after.length === 0 || /^[\s\d,]/.test(after)) {
        const bookId = resolveBookId(abbrev)
        if (bookId) return { bookId, rest: after }
      }
    }
  }
  return null
}

/** Parse a same-chapter span with no chapter jump: "3-7", "20", "17a". */
function parseSameChapterSpan(s) {
  const dashIdx = s.search(/[-–—]/)
  if (dashIdx === -1) {
    const v = stripVerseLetter(s)
    if (v == null) return null
    return { from: v, to: v }
  }
  const left = s.slice(0, dashIdx).trim()
  const right = s.slice(dashIdx + 1).trim()
  const leftV = stripVerseLetter(left)
  const rightV = stripVerseLetter(right)
  if (leftV == null || rightV == null) return null
  return { from: leftV, to: rightV }
}

/**
 * Parse one verse-spec group (no "." in it) into a {chapter, from, to}
 * list, given the current chapter context. Handles same-chapter ranges
 * ("3-7"), single verses ("20", "17a"), self-contained "chapter,verse[-verse]"
 * groups that restate the chapter ("4,14-21", as in "Lc 1,1-4.4,14-21"),
 * and trailing cross-chapter jumps — "<left>-<chapter>,<verse>" where
 * <left> is whatever came before (a bare verse, "1-19,42", or itself a
 * same-chapter range, "13-18-5, 1" — a malformed-but-real citation meaning
 * "13-18" in the current chapter, then on to chapter 5 verse 1; the
 * explicit "18" is redundant with the chapter's actual last verse, so
 * <left>'s own upper bound is discarded in favor of 'end'). Returns an
 * array — usually length 1, length 2+ if a jump spans multiple chapters.
 */
function parseVerseGroup(group, currentChapter) {
  const g = group.trim()

  const selfChapter = /^(\d+)\s*,\s*(\d+)\s*[a-zA-Z]*\s*(?:[-–—]\s*(\d+)\s*[a-zA-Z]*)?$/.exec(g)
  if (selfChapter) {
    const chapter = parseInt(selfChapter[1], 10)
    const from = parseInt(selfChapter[2], 10)
    const to = selfChapter[3] ? parseInt(selfChapter[3], 10) : from
    return [{ chapter, from, to }]
  }

  // Trailing "-chapter,verse" jump. Greedy `(.*)` finds the *last* such
  // jump in the group, so "13-18-5, 1" splits as left="13-18", jump="5,1".
  const jump = /^(.*)[-–—]\s*(\d+)\s*,\s*(\d+)\s*[a-zA-Z]*$/.exec(g)
  if (jump) {
    const left = jump[1].trim()
    const jumpChapter = parseInt(jump[2], 10)
    const jumpVerse = parseInt(jump[3], 10)
    const leftFromMatch = /^(\d+)/.exec(left)
    if (!leftFromMatch) return null
    const leftFrom = parseInt(leftFromMatch[1], 10)
    if (jumpChapter === currentChapter) {
      return [{ chapter: currentChapter, from: leftFrom, to: jumpVerse }]
    }
    const out = [{ chapter: currentChapter, from: leftFrom, to: 'end' }]
    for (let c = currentChapter + 1; c < jumpChapter; c++) {
      out.push({ chapter: c, from: 1, to: 'end' })
    }
    out.push({ chapter: jumpChapter, from: 1, to: jumpVerse })
    return out
  }

  const span = parseSameChapterSpan(g)
  if (!span) return null
  return [{ chapter: currentChapter, from: span.from, to: span.to }]
}

/**
 * Split a verse-spec (the part after the first comma) on "." or " e "
 * (Portuguese "and", used the same way in some psalm refs, e.g.
 * "10 e 12.24 e 35c") into groups, resolving each in turn. The chapter
 * context carries forward across groups, so a group that jumps chapter
 * (e.g. "15-4,1") makes the *next* group resolve against the new chapter
 * (needed for e.g. "2Cor 3,15-4,1.3-6", where "3-6" means 2Cor 4:3-6).
 */
function splitVerseSpec(spec, baseChapter) {
  if (!spec) return null
  const parts = spec.split(/\.|(?:\s+e\s+)/)
  const out = []
  let currentChapter = baseChapter
  for (const part of parts) {
    const trimmedPart = part.trim()
    if (!trimmedPart) continue
    const parsed = parseVerseGroup(trimmedPart, currentChapter)
    if (parsed == null) return null
    out.push(...parsed)
    currentChapter = parsed[parsed.length - 1].chapter
  }
  return out.length ? out : null
}

/**
 * Parse a single (already-cleaned) ";"-delimited piece. `prevBookId`/
 * `prevChapter` supply continuation context for pieces that omit the book
 * and/or chapter (e.g. the second half of "Mt 5,1-12a; 6,1-6"). Returns
 * { bookId, chapter, verses, chapterEnd?, psalmWarnings? } or null on failure.
 */
function parsePiece(piece, prevBookId, prevChapter) {
  let s = piece.trim().replace(/^cf\.?\s*/i, '')
  if (!s) return null

  let bookId = prevBookId
  const bookMatch = matchBook(s)
  if (bookMatch) {
    bookId = bookMatch.bookId
    // Drop a stray comma directly after the book name (e.g. "Ecl, 3,1-11"),
    // distinct from the normal "chapter,verses" comma that comes later.
    s = bookMatch.rest.trim().replace(/^,\s*/, '')
  }
  if (!bookId) return null

  // Single-chapter books are cited as "Book V[-V][.V...]" with no chapter
  // number at all (e.g. "Jd 17.20b-25", "Fm 9-10.12-17").
  if (SINGLE_CHAPTER_BOOKS.has(bookId)) {
    const versePart = s.replace(/^1\s*,\s*/, '') // tolerate a redundant explicit "1,"
    const groups = splitVerseSpec(versePart, 1)
    if (groups == null) return null
    return { bookId, chapter: 1, verses: groups, chapterEnd: 1 }
  }

  const isPsalm = bookId === 'Ps'

  if (isPsalm) {
    // Canticle substituted for a numbered psalm, e.g. "Sl (Tb 13)", "Sl Dn 3".
    const canticleMatch = /^\(?\s*([A-Za-zÀ-ÿ][A-Za-zÀ-ÿ0-9]*)\s+(\d+)\s*\)?\s*$/.exec(s)
    if (canticleMatch) {
      const innerBookId = resolveBookId(canticleMatch[1])
      if (innerBookId) {
        const chapter = parseInt(canticleMatch[2], 10)
        return { bookId: innerBookId, chapter, verses: [{ chapter, from: 1, to: 'end' }], chapterEnd: chapter }
      }
    }
  }

  const chapterMatch = isPsalm
    ? /^(\d+\s*(?:\(\s*\d+\s*\))?|\(\s*\d+\s*\/\s*\d+\s*\))/.exec(s)
    : /^(\d+)/.exec(s)
  if (!chapterMatch) {
    // No chapter given at all — only valid as a bare verse-continuation,
    // which requires both a previous book AND a previous chapter.
    if (prevChapter == null) return null
    const verseSpec = s.replace(/^,\s*/, '')
    const groups = splitVerseSpec(verseSpec, prevChapter)
    if (groups == null) return null
    return { bookId, chapter: prevChapter, verses: groups, chapterEnd: prevChapter }
  }

  let chapter, modernChapter
  let psalmWarnings = []
  if (isPsalm) {
    const resolved = resolvePsalmRef(chapterMatch[1])
    if (!resolved) return null
    chapter = resolved.vulgateChapter
    modernChapter = resolved.modernChapter
    psalmWarnings = resolved.warnings
  } else {
    chapter = parseInt(chapterMatch[1], 10)
  }
  let rest = s.slice(chapterMatch[0].length).trim()

  if (rest.startsWith(',')) {
    rest = rest.slice(1).trim()
    if (!rest) {
      // e.g. "Sl 97(98), (R. 1a)" after annotation-stripping leaves just a
      // trailing comma — treat as "whole chapter", same as no comma at all.
      return { bookId, chapter, modernChapter, verses: [{ chapter, from: 1, to: 'end' }], psalmWarnings }
    }
    const groups = splitVerseSpec(rest, chapter)
    if (groups == null) return null
    return { bookId, chapter, modernChapter, verses: groups, psalmWarnings }
  }

  // No comma -> whole chapter (or a chapter range "3-5" with no verses,
  // rare but handled: treat as "whole chapters 3 through 5").
  if (rest.startsWith('-')) {
    const m = /^-\s*(\d+)/.exec(rest)
    if (m) {
      const endChapter = parseInt(m[1], 10)
      const verses = [{ chapter, from: 1, to: 'end' }]
      for (let c = chapter + 1; c <= endChapter; c++) verses.push({ chapter: c, from: 1, to: 'end' })
      return { bookId, chapter, modernChapter, verses, psalmWarnings }
    }
  }
  return { bookId, chapter, modernChapter, verses: [{ chapter, from: 1, to: 'end' }], psalmWarnings }
}

/**
 * Fold same-chapter {chapter, from, to} entries produced by parsePiece into
 * the required output shape: [{bookId, chapter, verses:[{from,to}]}], one
 * element per distinct chapter, preserving order.
 */
function foldByChapter(bookId, entries) {
  const segments = []
  let cur = null
  for (const e of entries) {
    if (!cur || cur.chapter !== e.chapter) {
      cur = { bookId, chapter: e.chapter, verses: [] }
      segments.push(cur)
    }
    cur.verses.push({ from: e.from, to: e.to })
  }
  return segments
}

/**
 * Parse a full Brazilian lectionary citation into segments.
 * Returns { segments: [{bookId, chapter, verses:[{from,to}]}], warnings }
 * on success, or { segments: null, reason } on failure. Never throws.
 */
export function parseReference(referencia) {
  if (!referencia || typeof referencia !== 'string') {
    return { segments: null, reason: 'empty or non-string input' }
  }
  const pieces = referencia.split(';')
  const allSegments = []
  const warnings = []
  let prevBookId = null
  let prevChapter = null

  for (const rawPiece of pieces) {
    const { cleaned, warnings: cleanWarnings } = cleanPiece(rawPiece)
    warnings.push(...cleanWarnings)
    const parsed = parsePiece(cleaned, prevBookId, prevChapter)
    if (!parsed) {
      return { segments: null, reason: `could not parse piece "${cleaned}" of "${referencia}"` }
    }
    if (parsed.psalmWarnings?.length) warnings.push(...parsed.psalmWarnings)
    const folded = foldByChapter(parsed.bookId, parsed.verses)
    allSegments.push(...folded)
    prevBookId = parsed.bookId
    prevChapter = parsed.chapterEnd ?? parsed.chapter
  }

  return { segments: allSegments, warnings }
}
