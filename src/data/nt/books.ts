// The 27 New Testament books, in canonical order — the single source of truth
// shared by the build pipeline (scripts/nt/*.mjs) and the app (NovoTestamentoView).
//
// `.ts` extension on the imports elsewhere in this folder is deliberate: like
// utils/liturgy/calendar.ts, this module is loaded BOTH by Vite and by plain Node
// (type stripping) so the harvest/build scripts can't drift from the app's idea of
// what a book is.
//
// `key` doubles as the Clementine Vulgate key in scripts/liturgy/.cache/vulgate/
// normalized.json AND as the generated chunk id (src/data/nt/books/<key>.json).
// `slug` is only ever used by the harvester (liriocatolico.com.br URL segment).

export interface NtBook {
  /** Canonical key: Vulgate book key + chunk id, e.g. 'Matt'. */
  key: string
  /** liriocatolico.com.br URL segment — harvest-time only. */
  slug: string
  /** Portuguese display name, as the Matos Soares edition titles it. */
  name: string
  /** Short form for the header/picker, e.g. 'Mt'. */
  abbr: string
  /** Vulgate title, shown as the header subtitle in Latin mode. */
  latinName: string
  chapters: number
}

export const NT_BOOKS: NtBook[] = [
  { key: 'Matt', slug: 'sao-mateus', name: 'São Mateus', abbr: 'Mt', latinName: 'Evangelium secundum Matthæum', chapters: 28 },
  { key: 'Mark', slug: 'sao-marcos', name: 'São Marcos', abbr: 'Mc', latinName: 'Evangelium secundum Marcum', chapters: 16 },
  { key: 'Luke', slug: 'sao-lucas', name: 'São Lucas', abbr: 'Lc', latinName: 'Evangelium secundum Lucam', chapters: 24 },
  { key: 'John', slug: 'sao-joao', name: 'São João', abbr: 'Jo', latinName: 'Evangelium secundum Joannem', chapters: 21 },
  { key: 'Acts', slug: 'atos-dos-apostolos', name: 'Atos dos Apóstolos', abbr: 'At', latinName: 'Actus Apostolorum', chapters: 28 },
  { key: 'Rom', slug: 'romanos', name: 'Romanos', abbr: 'Rm', latinName: 'Epistola ad Romanos', chapters: 16 },
  { key: '1Cor', slug: 'i-corintios', name: 'I Coríntios', abbr: '1Cor', latinName: 'Epistola I ad Corinthios', chapters: 16 },
  { key: '2Cor', slug: 'ii-corintios', name: 'II Coríntios', abbr: '2Cor', latinName: 'Epistola II ad Corinthios', chapters: 13 },
  { key: 'Gal', slug: 'galatas', name: 'Gálatas', abbr: 'Gl', latinName: 'Epistola ad Galatas', chapters: 6 },
  { key: 'Eph', slug: 'efesios', name: 'Efésios', abbr: 'Ef', latinName: 'Epistola ad Ephesios', chapters: 6 },
  { key: 'Phil', slug: 'filipenses', name: 'Filipenses', abbr: 'Fp', latinName: 'Epistola ad Philippenses', chapters: 4 },
  { key: 'Col', slug: 'colossenses', name: 'Colossenses', abbr: 'Cl', latinName: 'Epistola ad Colossenses', chapters: 4 },
  { key: '1Thess', slug: 'i-tessalonicenses', name: 'I Tessalonicenses', abbr: '1Ts', latinName: 'Epistola I ad Thessalonicenses', chapters: 5 },
  { key: '2Thess', slug: 'ii-tessalonicenses', name: 'II Tessalonicenses', abbr: '2Ts', latinName: 'Epistola II ad Thessalonicenses', chapters: 3 },
  { key: '1Tim', slug: 'i-timoteo', name: 'I Timóteo', abbr: '1Tm', latinName: 'Epistola I ad Timotheum', chapters: 6 },
  { key: '2Tim', slug: 'ii-timoteo', name: 'II Timóteo', abbr: '2Tm', latinName: 'Epistola II ad Timotheum', chapters: 4 },
  { key: 'Titus', slug: 'tito', name: 'Tito', abbr: 'Tt', latinName: 'Epistola ad Titum', chapters: 3 },
  { key: 'Phlm', slug: 'filemon', name: 'Filêmon', abbr: 'Fm', latinName: 'Epistola ad Philemonem', chapters: 1 },
  { key: 'Heb', slug: 'hebreus', name: 'Hebreus', abbr: 'Hb', latinName: 'Epistola ad Hebræos', chapters: 13 },
  { key: 'Jas', slug: 'sao-tiago', name: 'São Tiago', abbr: 'Tg', latinName: 'Epistola catholica Jacobi', chapters: 5 },
  { key: '1Pet', slug: 'i-sao-pedro', name: 'I São Pedro', abbr: '1Pd', latinName: 'Epistola I Petri', chapters: 5 },
  { key: '2Pet', slug: 'ii-sao-pedro', name: 'II São Pedro', abbr: '2Pd', latinName: 'Epistola II Petri', chapters: 3 },
  { key: '1John', slug: 'i-sao-joao', name: 'I São João', abbr: '1Jo', latinName: 'Epistola I Joannis', chapters: 5 },
  { key: '2John', slug: 'ii-sao-joao', name: 'II São João', abbr: '2Jo', latinName: 'Epistola II Joannis', chapters: 1 },
  { key: '3John', slug: 'iii-sao-joao', name: 'III São João', abbr: '3Jo', latinName: 'Epistola III Joannis', chapters: 1 },
  { key: 'Jude', slug: 'sao-judas', name: 'São Judas', abbr: 'Jd', latinName: 'Epistola Judæ', chapters: 1 },
  { key: 'Rev', slug: 'apocalipse', name: 'Apocalipse', abbr: 'Ap', latinName: 'Apocalypsis Joannis', chapters: 22 },
]

const BY_KEY = new Map(NT_BOOKS.map((b) => [b.key, b]))

export function getNtBook(key: string): NtBook | undefined {
  return BY_KEY.get(key)
}

export function ntBookIndex(key: string): number {
  return NT_BOOKS.findIndex((b) => b.key === key)
}

/** The next/previous book in canonical order, or undefined at either end. */
export function nextNtBook(key: string): NtBook | undefined {
  const i = ntBookIndex(key)
  return i === -1 ? undefined : NT_BOOKS[i + 1]
}

export function prevNtBook(key: string): NtBook | undefined {
  const i = ntBookIndex(key)
  return i <= 0 ? undefined : NT_BOOKS[i - 1]
}

/** First book of the NT — where a reader with no saved position starts. */
export const NT_FIRST_BOOK = NT_BOOKS[0]
