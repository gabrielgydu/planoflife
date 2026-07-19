// Book-id tables shared by the Vulgate loader and the reference parser.
// BUILD-TIME ONLY.

/**
 * Raw book name as it appears in the scrollmapper VulgClementine.json
 * -> stable OSIS-style book id used throughout this pipeline.
 * Deliberately omits the four non-lectionary extras present in the raw file
 * (Prayer of Manasses, I/II Esdras, Additional Psalm, Laodiceans) — they are
 * not part of the Roman lectionary and have no pt abbreviation to map from.
 */
export const RAW_NAME_TO_BOOK_ID = {
  Genesis: 'Gen',
  Exodus: 'Exod',
  Leviticus: 'Lev',
  Numbers: 'Num',
  Deuteronomy: 'Deut',
  Joshua: 'Josh',
  Judges: 'Judg',
  Ruth: 'Ruth',
  'I Samuel': '1Sam',
  'II Samuel': '2Sam',
  'I Kings': '1Kgs',
  'II Kings': '2Kgs',
  'I Chronicles': '1Chr',
  'II Chronicles': '2Chr',
  Ezra: 'Ezra',
  Nehemiah: 'Neh',
  Tobit: 'Tob',
  Judith: 'Jdt',
  Esther: 'Esth',
  Job: 'Job',
  Psalms: 'Ps',
  Proverbs: 'Prov',
  Ecclesiastes: 'Eccl',
  'Song of Solomon': 'Song',
  Wisdom: 'Wis',
  Sirach: 'Sir',
  Isaiah: 'Isa',
  Jeremiah: 'Jer',
  Lamentations: 'Lam',
  Baruch: 'Bar',
  Ezekiel: 'Ezek',
  Daniel: 'Dan',
  Hosea: 'Hos',
  Joel: 'Joel',
  Amos: 'Amos',
  Obadiah: 'Obad',
  Jonah: 'Jonah',
  Micah: 'Mic',
  Nahum: 'Nah',
  Habakkuk: 'Hab',
  Zephaniah: 'Zeph',
  Haggai: 'Hag',
  Zechariah: 'Zech',
  Malachi: 'Mal',
  'I Maccabees': '1Macc',
  'II Maccabees': '2Macc',
  Matthew: 'Matt',
  Mark: 'Mark',
  Luke: 'Luke',
  John: 'John',
  Acts: 'Acts',
  Romans: 'Rom',
  'I Corinthians': '1Cor',
  'II Corinthians': '2Cor',
  Galatians: 'Gal',
  Ephesians: 'Eph',
  Philippians: 'Phil',
  Colossians: 'Col',
  'I Thessalonians': '1Thess',
  'II Thessalonians': '2Thess',
  'I Timothy': '1Tim',
  'II Timothy': '2Tim',
  Titus: 'Titus',
  Philemon: 'Phlm',
  Hebrews: 'Heb',
  James: 'Jas',
  'I Peter': '1Pet',
  'II Peter': '2Pet',
  'I John': '1John',
  'II John': '2John',
  'III John': '3John',
  Jude: 'Jude',
  'Revelation of John': 'Rev',
}

/**
 * Brazilian lectionary (CNBB) book abbreviations -> OSIS-style book id.
 * Keys are matched case-insensitively; most are also matched with accents
 * stripped (see ref-parse.mjs `foldKey`), EXCEPT "Jó" (Job), which is
 * deliberately excluded from accent-folding because it would collide with
 * "Jo" (João / Gospel of John) once the accent is removed. Job is rare in
 * the daily lectionary; João is extremely common — the exact-match path
 * (with accent) is tried first, so this only matters for the accent-folded
 * fallback, and we bias that fallback towards John.
 */
export const PT_ABBREV_TO_BOOK_ID = {
  Gn: 'Gen',
  Ex: 'Exod',
  Lv: 'Lev',
  Nm: 'Num',
  Dt: 'Deut',
  Js: 'Josh',
  Jz: 'Judg',
  Rt: 'Ruth',
  '1Sm': '1Sam',
  '2Sm': '2Sam',
  '1Rs': '1Kgs',
  '2Rs': '2Kgs',
  '1Cr': '1Chr',
  '2Cr': '2Chr',
  Esd: 'Ezra',
  Ne: 'Neh',
  Tb: 'Tob',
  Jt: 'Jdt',
  Est: 'Esth',
  Jó: 'Job',
  Sl: 'Ps',
  Sal: 'Ps', // occasionally spelled out
  Pr: 'Prov',
  Ecl: 'Eccl',
  Qo: 'Eccl', // Qohelet, alternate CNBB abbrev
  Ct: 'Song',
  Sb: 'Wis',
  Eclo: 'Sir',
  Sr: 'Sir',
  '1Mc': '1Macc',
  '2Mc': '2Macc',
  Is: 'Isa',
  Jr: 'Jer',
  Lm: 'Lam',
  Br: 'Bar',
  Ez: 'Ezek',
  Dn: 'Dan',
  Os: 'Hos',
  Jl: 'Joel',
  Am: 'Amos',
  Ab: 'Obad',
  Jn: 'Jonah',
  Mq: 'Mic',
  Na: 'Nah',
  Hab: 'Hab',
  Sf: 'Zeph',
  Ag: 'Hag',
  Zc: 'Zech',
  Ml: 'Mal',
  Mt: 'Matt',
  Mc: 'Mark',
  Lc: 'Luke',
  Jo: 'John',
  At: 'Acts',
  Rm: 'Rom',
  '1Cor': '1Cor',
  '2Cor': '2Cor',
  Gl: 'Gal',
  Ef: 'Eph',
  Fl: 'Phil',
  Cl: 'Col',
  '1Ts': '1Thess',
  '2Ts': '2Thess',
  '1Tm': '1Tim',
  '2Tm': '2Tim',
  Tt: 'Titus',
  Fm: 'Phlm',
  Hb: 'Heb',
  Tg: 'Jas',
  '1Pd': '1Pet',
  '2Pd': '2Pet',
  '1Jo': '1John',
  '2Jo': '2John',
  '3Jo': '3John',
  Jd: 'Jude',
  Ap: 'Rev',

  // Alternate/full-name forms observed in the wild (the API is not always
  // consistent about using the canonical CNBB abbreviation).
  '1Co': '1Cor',
  '2Co': '2Cor',
  Miqueias: 'Mic',
  '1Timóteo': '1Tim',
  '2Timóteo': '2Tim',
  '1Samuel': '1Sam',
  '2Samuel': '2Sam',
}

/** Single-chapter books: the lectionary cites these as "Book V-V" with no chapter number at all. */
export const SINGLE_CHAPTER_BOOKS = new Set(['Obad', 'Phlm', '2John', '3John', 'Jude'])

/** Book ids that must never be reached by the accent-folded fallback lookup. */
export const ACCENT_FOLD_EXCLUDE = new Set(['Jó'])

export function stripAccents(s) {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '')
}

/**
 * Resolve a raw abbreviation token (as it appears in a `referencia` string,
 * e.g. "1Cor", "Sl", "Jó") to an OSIS book id. Exact match (case-insensitive)
 * first; accent-folded fallback second (excluding "Jó" to avoid the João
 * collision described above). Returns null if nothing matches.
 */
export function resolveBookId(token) {
  if (!token) return null
  // Exact, case-insensitive.
  for (const [abbrev, id] of Object.entries(PT_ABBREV_TO_BOOK_ID)) {
    if (abbrev.toLowerCase() === token.toLowerCase()) return id
  }
  // Accent-folded fallback.
  const folded = stripAccents(token).toLowerCase()
  for (const [abbrev, id] of Object.entries(PT_ABBREV_TO_BOOK_ID)) {
    if (ACCENT_FOLD_EXCLUDE.has(abbrev)) continue
    if (stripAccents(abbrev).toLowerCase() === folded) return id
  }
  return null
}

/** Longest-first list of abbreviation keys, for greedy prefix matching. */
export const ABBREV_KEYS_BY_LENGTH = Object.keys(PT_ABBREV_TO_BOOK_ID).sort(
  (a, b) => b.length - a.length,
)
