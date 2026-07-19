// Hebrew (modern) <-> Vulgate (Greek/Septuagint) psalm-chapter numbering.
// BUILD-TIME ONLY.
//
// EMPIRICAL FINDING (see scripts/liturgy/README.md for the full evidence):
// the liturgia.up.railway.app API's `Sl N` / `Sl N(M)` psalm references
// give the VULGATE chapter number FIRST (outside/before the parenthesis),
// and the modern Hebrew chapter number in parentheses when present. This
// was verified by comparing the API's salmo `texto` against the Clementine
// Vulgate's Latin incipits for three real dates (Ps 97/98, 66/67, 24/25) —
// in every case the pre-parenthesis number matched the Vulgate content
// exactly. So resolving a psalm reference to Vulgate text does NOT require
// applying the offset table to the primary number; it's already Vulgate.
// The offset table below is kept for: (a) documentation/verification —
// resolvePsalmRef cross-checks the parenthetical number against it and
// warns on mismatch — and (b) defensive handling if a future/other-source
// reference ever gives only the modern number.

/**
 * Hebrew (modern) chapter -> Vulgate (Greek) chapter.
 * Returns a number for the simple 1:1 cases, or `{ split: [a, b], note }`
 * for the two Hebrew psalms (116, 147) that map to two Vulgate psalms each
 * (verse-level, not resolvable from the chapter number alone).
 */
export function hebrewToVulgate(h) {
  if (h >= 1 && h <= 8) return h
  if (h === 9 || h === 10) return 9
  if (h >= 11 && h <= 113) return h - 1
  if (h === 114 || h === 115) return 113
  if (h === 116) return { split: [114, 115], note: 'Heb 116 = Vulg 114 (vv1-9) + Vulg 115 (vv10-19)' }
  if (h >= 117 && h <= 146) return h - 1
  if (h === 147) return { split: [146, 147], note: 'Heb 147 = Vulg 146 (vv1-11) + Vulg 147 (vv12-20)' }
  if (h >= 148 && h <= 150) return h
  return null
}

/**
 * Vulgate (Greek) chapter -> Hebrew (modern) chapter.
 * Returns a number for the simple 1:1 cases, or `{ merge: [a, b], note }`
 * for the two Vulgate psalms (9, 113) that merge two Hebrew psalms each.
 * Vulgate 114/115 and 146/147 are each *part of* a single Hebrew psalm
 * (116 and 147 respectively); the number returned is that Hebrew psalm.
 */
export function vulgateToHebrew(v) {
  if (v >= 1 && v <= 8) return v
  if (v === 9) return { merge: [9, 10], note: 'Vulg 9 = Heb 9 + Heb 10' }
  if (v >= 10 && v <= 112) return v + 1
  if (v === 113) return { merge: [114, 115], note: 'Vulg 113 = Heb 114 + Heb 115' }
  if (v === 114 || v === 115) return 116
  if (v >= 116 && v <= 145) return v + 1
  if (v === 146 || v === 147) return 147
  if (v >= 148 && v <= 150) return v
  return null
}

/**
 * Resolve a psalm chapter token like "97(98)", "66", or "22 (23)" (as found
 * right after "Sl "/"Sal " in a referencia string) to the Vulgate chapter
 * to look up in the bundled text, plus the modern number for display/QA.
 * Returns null if the token doesn't parse.
 */
export function resolvePsalmRef(token) {
  // Tolerant alternate form seen once in the wild: "(A/B)" — the whole
  // pair inside parens, slash-separated, with the VULGATE number second
  // (opposite order from the normal "N(M)" case). Confirmed against real
  // Vulgate text: "Sl (71/70)"'s API texto ("Não me deixeis quando chegar
  // minha velhice") matches Vulgate Ps 70 ("Ne projicias me in tempore
  // senectutis") exactly, not Ps 71 — so here the *second* number is the
  // Vulgate one.
  const slash = /^\s*\(\s*(\d+)\s*\/\s*(\d+)\s*\)\s*$/.exec(token ?? '')
  if (slash) {
    const modernChapter = parseInt(slash[1], 10)
    const vulgateChapter = parseInt(slash[2], 10)
    const warnings = [`psalm-ref-slash-form: "(${slash[1]}/${slash[2]})" read as modern/vulgate (reversed from the usual "vulgate(modern)" order)`]
    return { vulgateChapter, modernChapter, warnings }
  }

  const m = /^\s*(\d+)\s*(?:\(\s*(\d+)\s*\))?/.exec(token ?? '')
  if (!m) return null
  const primary = parseInt(m[1], 10)
  const paren = m[2] ? parseInt(m[2], 10) : null
  const warnings = []

  const vulgateChapter = primary // see empirical finding above
  let modernChapter = paren

  const expectedModern = vulgateToHebrew(primary)
  if (paren != null && typeof expectedModern === 'number' && expectedModern !== paren) {
    warnings.push(
      `psalm-offset-mismatch: Sl ${primary}(${paren}) but offset table expects Sl ${primary}(${expectedModern})`,
    )
  }
  if (modernChapter == null && typeof expectedModern === 'number') {
    modernChapter = expectedModern
  }

  return { vulgateChapter, modernChapter, warnings }
}
