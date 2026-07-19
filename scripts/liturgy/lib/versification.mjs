// Hebrew (modern) <-> Vulgate chapter/verse mappings for the few OT books
// where Jerome's Vulgate splits chapters differently from the modern
// (Hebrew-based) numbering the Brazilian lectionary API uses. Unlike the
// Psalms (a uniform, book-wide offset — see psalm-map.mjs), each of these
// is a one-off structural difference confined to specific chapters.
// BUILD-TIME ONLY.
//
// Every mapping below was built the same way as the psalm-direction
// finding: fetch a real API date, take the pt `texto` (which is annotated
// with the modern verse numbers inline, e.g. "14Rejubila..."), and match
// its content word-for-word against the Clementine Vulgate text to find
// the actual Vulgate chapter/verse. See README.md "Versification" section
// for the full evidence transcripts. Ranges not covered by a direct
// citation are noted as inferred (from verse-count fit and/or universally
// recognized content, e.g. "the Pentecost prophecy is modern Joel 3") —
// still a documented, checkable claim, just not confirmed against an API
// citation, because none exists in the harvested corpus.

/**
 * ZECHARIAH — confirmed against 4 verses of one real citation (Zc 2,14-17,
 * matched word-for-word to Vulgate Zech 2,10-13) plus a second real
 * citation (Zc 2,5-9, matched word-for-word to Vulgate Zech 2,1-5 — e.g.
 * modern 2,9 "Eu serei... muralha de fogo" = Vulgate 2,5 "ego ero...
 * murus ignis", confirming the same -4 offset down to the chapter's start).
 * The ch1/ch2 boundary (modern 2,1-4 = Vulgate 1,18-21, the "four horns"
 * vision) is inferred from Vulgate content — that vision is universally
 * chapter 2 vv1-4 in every modern Bible — not independently confirmed via
 * an API citation, since none appears in the harvested corpus. Chapters
 * 3-14 are unaffected (same numbering both traditions).
 */
function mapZech(chapter, verse) {
  if (chapter === 1) return verse >= 1 && verse <= 17 ? { chapter: 1, verse } : null
  if (chapter === 2) {
    if (verse >= 1 && verse <= 4) return { chapter: 1, verse: verse + 17 } // -> Vulg 1,18-21
    if (verse >= 5 && verse <= 17) return { chapter: 2, verse: verse - 4 } // -> Vulg 2,1-13
    return null
  }
  if (chapter >= 3 && chapter <= 14) return { chapter, verse }
  return null
}

/**
 * JOEL — modern ch4 = Vulgate ch3, same verse numbers, confirmed
 * word-for-word against a real citation (Jl 4,12-21: "vale de Josafá" =
 * "vallem Josaphat" at Vulg 3,12). Modern ch1 and ch2 vv1-18 confirmed
 * identical to Vulgate (same chapter/verse numbers) against two more real
 * citations (Jl 1,13-15;2,1-2 and Jl 2,12-18). Modern ch2 vv19-27 is
 * inferred (no citation touches it; Vulgate ch2 continues past v18 with
 * nothing to suggest a break). Modern ch3 (the 5-verse "I will pour out my
 * spirit" chapter) = Vulgate 2,28-32 is inferred from an exact verse-count
 * fit (5 Hebrew verses = Vulg 2,28-32, 5 verses) plus Vulg 2,28's content
 * ("effundam spiritum meum super omnem carnem") being the universally
 * recognized identity of that chapter — not confirmed via an API citation.
 */
function mapJoel(chapter, verse) {
  if (chapter === 1) return { chapter: 1, verse }
  if (chapter === 2) return verse >= 1 && verse <= 27 ? { chapter: 2, verse } : null
  if (chapter === 3) return verse >= 1 && verse <= 5 ? { chapter: 2, verse: verse + 27 } : null
  if (chapter === 4) return { chapter: 3, verse }
  return null
}

/**
 * MALACHI — modern 3,19-24 = Vulgate 4,1-6 confirmed word-for-word against
 * a real citation (Ml 3,19-20: "abrasador como fornalha" = "succensa quasi
 * caminus" at Vulg 4,1). Modern ch1-2 and ch3 vv1-18 = Vulgate same
 * numbering, confirmed against real citations that stay within that range
 * (Ml 3,1-4; Ml 3,13-20 straddles the boundary — its 13-18 portion matches
 * Vulg 3,13-18 directly). Vulgate ch3 has exactly 18 verses, consistent
 * with the boundary sitting at 18/19.
 */
function mapMal(chapter, verse) {
  if (chapter === 1 || chapter === 2) return { chapter, verse }
  if (chapter === 3) {
    if (verse >= 1 && verse <= 18) return { chapter: 3, verse }
    if (verse >= 19 && verse <= 24) return { chapter: 4, verse: verse - 18 }
    return null
  }
  return null
}

/**
 * bookId -> (modernChapter, modernVerse) -> {chapter, verse} in Vulgate
 * coordinates, or null if out of the mapped range. Only books with a
 * confirmed chapter/verse split are listed; every other book uses the
 * same numbering in both traditions (verified true for the Psalms'
 * *chapter* numbers too — see psalm-map.mjs — but psalms are handled
 * separately since that offset is uniform book-wide, not chapter-specific).
 */
export const BOOK_VERSE_MAPS = {
  Zech: mapZech,
  Joel: mapJoel,
  Mal: mapMal,
}
