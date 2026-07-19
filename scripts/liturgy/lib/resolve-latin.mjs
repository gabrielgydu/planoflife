// Resolves a Brazilian lectionary citation to Clementine Vulgate Latin text.
// BUILD-TIME ONLY.

import { parseReference } from './ref-parse.mjs'
import { getVerses, hasBook, hasChapter } from './vulgate.mjs'
import { BOOK_VERSE_MAPS } from './versification.mjs'

/**
 * Modern (Hebrew/Greek-addition-lettered) Esther citations for the deutero-
 * canonical "Additions" don't exist at those chapter/verse coordinates in
 * the Clementine Vulgate: Jerome relocated all six Greek additions to the
 * end of the book (Vulgate Esth 10:4-16:24), out of narrative order. This
 * table was built by reading the actual downloaded Vulgate text and
 * matching content (not from memory) — see README.md "Esther" section for
 * the verification transcript. Keyed by the modern chapter the addition is
 * anchored to; granularity is chapter-block only (the individual a/b/c...
 * lettered sub-verses are NOT resolved to individual Vulgate verses).
 */
const ESTHER_GREEK_ADDITIONS = {
  // Addition A (Mordecai's dream) — modern: before 1,1 / often cited as 11,2-12,6 directly (already Vulgate coords in that case)
  // Addition B (Artaxerxes' first decree) — modern: after 3,13
  3: { vulgate: [{ chapter: 13, from: 1, to: 7 }], note: 'Addition B (decree) after modern Est 3,13' },
  // Addition C (Mordecai's and Esther's prayers) — modern: after 4,17
  4: {
    vulgate: [
      { chapter: 13, from: 8, to: 18 },
      { chapter: 14, from: 1, to: 19 },
    ],
    note: 'Addition C (prayers of Mordecai and Esther) after modern Est 4,17',
  },
  // Addition D (Esther before the king) — modern: replaces 5,1-2
  5: { vulgate: [{ chapter: 15, from: 1, to: 19 }], note: 'Addition D (Esther approaches unannounced) replacing modern Est 5,1-2' },
  // Addition E (Artaxerxes' second decree) — modern: after 8,12
  8: { vulgate: [{ chapter: 16, from: 1, to: 24 }], note: 'Addition E (decree revoking Haman\'s) after modern Est 8,12' },
  // Addition F (interpretation of the dream) — modern: after 10,3
  10: { vulgate: [{ chapter: 10, from: 4, to: 13 }], note: 'Addition F (dream interpretation) after modern Est 10,3' },
}

/** True if a segment looks like a modern-numbering Esther addition citation the Vulgate can't address directly. */
function estherAdditionFor(segment) {
  if (segment.bookId !== 'Esth') return null
  return ESTHER_GREEK_ADDITIONS[segment.chapter] ?? null
}

function formatVerses(verses) {
  return verses.map((v) => v.text).join(' ')
}

/**
 * Expand a modern (chapter, from, to) verse range into one or more Vulgate
 * (chapter, from, to) runs, using a per-book versification map (see
 * versification.mjs). Maps verse-by-verse and groups consecutive results
 * into contiguous chapter runs — simple and correct even when a range
 * straddles a modern/Vulgate chapter boundary (e.g. modern Mal 3,13-20
 * splits into Vulgate 3,13-18 + Vulgate 4,1-2). `to === 'end'` (a whole-
 * chapter-onward citation) isn't exercised by any citation in the
 * harvested corpus for these books; handled as a best-effort — map just
 * `from`, then run to the end of *that* Vulgate chapter.
 */
function expandModernRange(mapFn, chapter, from, to) {
  if (to === 'end') {
    const start = mapFn(chapter, from)
    if (!start) return null
    return [{ chapter: start.chapter, from: start.verse, to: 'end' }]
  }
  const mapped = []
  for (let v = from; v <= to; v++) {
    const m = mapFn(chapter, v)
    if (!m) return null
    mapped.push(m)
  }
  const runs = []
  for (const m of mapped) {
    const last = runs[runs.length - 1]
    if (last && last.chapter === m.chapter && m.verse === last.to + 1) {
      last.to = m.verse
    } else {
      runs.push({ chapter: m.chapter, from: m.verse, to: m.verse })
    }
  }
  return runs
}

/**
 * Resolve one already-parsed segment to Latin text. Returns
 * { latin, warnings } — latin is '' (not null) when nothing could be
 * resolved, so callers can distinguish "resolved but empty" (shouldn't
 * happen) from a missing lookup (also surfaced via warnings either way).
 */
async function resolveSegment(segment) {
  const warnings = []
  const addition = estherAdditionFor(segment)
  if (addition) {
    warnings.push(`esther-greek-addition: ${addition.note} — mapped to approximate Vulgate chapter block, not verse-exact`)
    const parts = []
    for (const { chapter, from, to } of addition.vulgate) {
      const verses = await getVerses('Esth', chapter, from, to)
      if (verses?.length) parts.push(formatVerses(verses))
    }
    return { latin: parts.join(' '), warnings }
  }

  const versifyMap = BOOK_VERSE_MAPS[segment.bookId]
  if (versifyMap) {
    warnings.push(
      `versification-remapped: ${segment.bookId} ${segment.chapter} uses a Hebrew/Vulgate chapter split — verses remapped to Vulgate coordinates (see README)`,
    )
    const parts = []
    for (const { from, to } of segment.verses) {
      const runs = expandModernRange(versifyMap, segment.chapter, from, to)
      if (!runs) {
        warnings.push(`versification-unmapped: ${segment.bookId} ${segment.chapter}:${from}-${to} has no known Vulgate mapping`)
        continue
      }
      for (const run of runs) {
        const verses = await getVerses(segment.bookId, run.chapter, run.from, run.to)
        if (!verses || verses.length === 0) {
          warnings.push(`no verses found (after versification mapping): ${segment.bookId} ${run.chapter}:${run.from}-${run.to}`)
          continue
        }
        parts.push(formatVerses(verses))
      }
    }
    return { latin: parts.join(' '), warnings }
  }

  if (!(await hasBook(segment.bookId))) {
    warnings.push(`book not found in Vulgate: ${segment.bookId}`)
    return { latin: '', warnings }
  }
  if (!(await hasChapter(segment.bookId, segment.chapter))) {
    warnings.push(`chapter not found in Vulgate: ${segment.bookId} ${segment.chapter}`)
    return { latin: '', warnings }
  }

  const parts = []
  for (const { from, to } of segment.verses) {
    const verses = await getVerses(segment.bookId, segment.chapter, from, to)
    if (!verses || verses.length === 0) {
      warnings.push(`no verses found: ${segment.bookId} ${segment.chapter}:${from}-${to}`)
      continue
    }
    parts.push(formatVerses(verses))
  }
  return { latin: parts.join(' '), warnings }
}

/**
 * Resolve a full referencia string to Latin text.
 * Returns { latin, segments, warnings }. `latin` joins all resolved
 * segments/verses with a single space (no verse numbers inlined — plain
 * reading text, matching how the app's other bundled prayer/reading text
 * is stored as continuous prose). Never throws.
 */
export async function resolveLatin(referencia) {
  const { segments, warnings: parseWarnings, reason } = parseReference(referencia)
  if (!segments) {
    return { latin: '', segments: null, warnings: [`parse failed: ${reason}`] }
  }

  const warnings = [...(parseWarnings ?? [])]
  const latinParts = []
  for (const segment of segments) {
    const { latin, warnings: segWarnings } = await resolveSegment(segment)
    if (latin) latinParts.push(latin)
    warnings.push(...segWarnings)
  }

  return { latin: latinParts.join(' '), segments, warnings }
}
