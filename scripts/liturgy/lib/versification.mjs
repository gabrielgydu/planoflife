// Hebrew (modern) <-> Vulgate chapter/verse mappings for the few OT books
// where Jerome's Vulgate splits chapters differently from the modern
// (Hebrew-based) numbering the Brazilian lectionary API uses — and for the
// few NT chapters whose verse division differs (see the NT section). Unlike the
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

// --- New Testament ------------------------------------------------------------
// The NT differences are verse-level, not chapter splits: in a few chapters the
// Clementine Vulgate joins two modern verses into one (or splits one in two), and
// everything after it shifts by one. Found and confirmed by matching every
// inline-numbered verse of every NT reading's pt `texto` (modern numbering) against
// the Matos Soares translation in src/data/nt/books (Clementine numbering — it was
// translated from the Vulgate and is verse-for-verse identical to it): in exactly
// these chapters a whole RUN of consecutive verses matched the neighbouring verse
// instead of their own, and nowhere else. See README.md "Versification — New
// Testament" for the evidence. Until this map existed these readings carried Latin
// that was one verse off (e.g. Mc 9,2-10, the Transfiguration, opened on "Et
// vestimenta ejus" — the second verse).

/**
 * MATTHEW 17 — modern 17,14-15 = Vulgate 17,14 ("Et cum venisset ad turbam,
 * accessit ad eum homo genibus provolutus ante eum, dicens: Domine, miserere filio
 * meo, quia lunaticus est" is the modern man-kneels verse AND his plea), so modern
 * 17,15-27 = Vulgate 17,14-26. Confirmed against Mt 17,14-20 and Mt 17,22-27
 * (modern 22 "reunidos na Galileia" = Vulgate 17,21 "Conversantibus autem eis in
 * Galilæa"). Chapters other than 17 are unaffected.
 */
function mapMatt(chapter, verse) {
  if (chapter !== 17 || verse <= 14) return { chapter, verse }
  return { chapter: 17, verse: verse - 1 }
}

/**
 * MARK 4 — modern 4,40-41 = Vulgate 4,40 (the rebuke "Quid timidi estis?" and the
 * disciples' "Quis, putas, est iste?" are one Vulgate verse); Vulgate ch.4 ends at 40.
 * MARK 9 — modern 9,1 ("there are some standing here who will not taste death") is
 * the last verse of Vulgate ch.8 (8,39), so modern 9,n = Vulgate 9,n-1 throughout
 * the chapter (Vulgate ch.9 has 49 verses to the modern 50). Confirmed against every
 * Mc 9 reading in the corpus (2-10, 14-29, 30-37, 38-40, 38-43.45.47-48, 41-50) and
 * Mc 8,34-9,1; e.g. modern 9,2 "Jesus tomou consigo Pedro, Tiago e João" = Vulgate
 * 9,1 "Et post dies sex assumit Jesus Petrum, et Jacobum, et Joannem".
 */
function mapMark(chapter, verse) {
  if (chapter === 4 && verse === 41) return { chapter: 4, verse: 40 }
  if (chapter !== 9) return { chapter, verse }
  if (verse === 1) return { chapter: 8, verse: 39 }
  return { chapter: 9, verse: verse - 1 }
}

/**
 * JOHN 6 — modern 6,51 is TWO Vulgate verses: 6,51 "Ego sum panis vivus, qui de cælo
 * descendi" and 6,52 "Si quis manducaverit ex hoc pane, vivet in æternum: et panis
 * quem ego dabo, caro mea est pro mundi vita". So modern 6,52-71 = Vulgate 6,53-72.
 * Confirmed against Jo 6,44-51, 6,51-58, 6,52-59 and 6,60-69 (modern 52 "os judeus
 * discutiam entre si" = Vulgate 6,53 "Litigabant ergo Judæi ad invicem").
 */
function mapJohn(chapter, verse) {
  if (chapter !== 6 || verse <= 50) return { chapter, verse }
  if (verse === 51) return [{ chapter: 6, verse: 51 }, { chapter: 6, verse: 52 }]
  return { chapter: 6, verse: verse + 1 }
}

/**
 * ACTS 7 — modern 7,55-56 = Vulgate 7,55 (Stephen's gaze into heaven and his "Ecce
 * video cælos apertos" are one Vulgate verse), so modern 7,57-60 = Vulgate 7,56-59.
 * Confirmed against At 6,8-10;7,54-59 (St. Stephen, 26 Dec): modern 59 "Senhor
 * Jesus, acolhe o meu espírito" = Vulgate 7,58 "Domine Jesu, suscipe spiritum meum".
 * Vulgate 7,59 also carries modern 8,1a ("Saulus autem erat consentiens neci ejus").
 * Modern 8,1 itself stays on Vulgate 8,1: the parser drops verse letters, the only
 * citations are "7,51-8,1a" and "8,1b-8", and Vulgate 8,1 is exactly modern 8,1b —
 * so 8,1b-8 is exact and 7,51-8,1a keeps the whole-verse overrun every other
 * half-verse citation already has.
 */
function mapActs(chapter, verse) {
  if (chapter !== 7 || verse <= 55) return { chapter, verse }
  if (verse === 56) return { chapter: 7, verse: 55 }
  return { chapter: 7, verse: verse - 1 }
}

/**
 * bookId -> (modernChapter, modernVerse) -> Vulgate coordinates: one
 * {chapter, verse}, an ARRAY of them when one modern verse is two Vulgate
 * verses (John 6,51), or null if out of the mapped range. Several modern
 * verses may map to the same Vulgate verse (Mt 17,14-15); the resolver drops
 * the repeat. Only books with a confirmed difference are listed; every other
 * book uses the same numbering in both traditions (verified true for the
 * Psalms' *chapter* numbers too — see psalm-map.mjs — but psalms are handled
 * separately since that offset is uniform book-wide, not chapter-specific).
 */
export const BOOK_VERSE_MAPS = {
  Zech: mapZech,
  Joel: mapJoel,
  Mal: mapMal,
  Matt: mapMatt,
  Mark: mapMark,
  John: mapJohn,
  Acts: mapActs,
}
