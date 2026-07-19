// Liturgia do Dia — runtime content loader (LITURGY_PLAN.md §D).
//
// CONTRACT FILE: the UI (LiturgiaView) imports ONLY these exported types and
// `resolveLiturgyForDate`. Engine → content key (./liturgy/contentKey.ts, the SAME rule
// scripts/liturgy/build-propers.mjs used to build the store) → lazy chunk import → composed
// LiturgyDay. `liturgia`/`cor` always come fresh from the engine (never stored — the engine is
// already validated against the harvested oracle, see calendar.ts's header), so a day with zero
// bundled content still renders a correct title/color with contentMatch: 'none'.

import { liturgicalDay, type LiturgicalDay } from '../utils/liturgy/calendar.ts'
import { readingsKeyVariants, propersKeyFor } from './liturgy/contentKey.ts'
import { MANIFEST } from './liturgy/propers/manifest.ts'
import { CHUNK_LOADERS } from './liturgy/propers/chunks.ts'

export interface LiturgyReading {
  /** Absent for the handful of non-scripture "extras" (e.g. the Christmas Vigil's traditional
   * "Anúncio do Natal" proclamation) that carry no citation. */
  referencia?: string
  titulo?: string
  texto: string
  /** Clementine Vulgate Latin, resolved at build time. Readings/psalms only —
   * the propers (orações/antífonas) have no free Novus Ordo Latin. */
  textoLatim?: string
  /** For extra readings (Easter Vigil): "Terceira Leitura" … "Epístola". */
  tipo?: string
}

export interface LiturgyPsalm {
  referencia: string
  refrao?: string
  texto: string
  textoLatim?: string
}

export type LiturgyColor = 'Branco' | 'Verde' | 'Vermelho' | 'Roxo' | 'Rosa'

export interface LiturgyDay {
  /** YYYY-MM-DD of the viewed civil date. */
  date: string
  /** Display name, e.g. "16º Domingo do Tempo Comum" (engine-computed). */
  liturgia: string
  cor: LiturgyColor
  antifonas?: { entrada?: string; comunhao?: string }
  /** `extras` (Easter Vigil blessings, All Souls' extra collects, …) is carried for round-trip
   * fidelity; the UI currently only reads coleta/oferendas/comunhao. */
  oracoes?: { coleta?: string; oferendas?: string; comunhao?: string; extras?: { titulo: string; texto: string }[] }
  leituras: {
    primeiraLeitura?: LiturgyReading[]
    salmo?: LiturgyPsalm[]
    segundaLeitura?: LiturgyReading[]
    evangelho?: LiturgyReading[]
    extras?: LiturgyReading[]
  }
  /** 'exact' = store hit for this day's liturgical identity; 'partial' = a
   * fallback variant (e.g. other cycle) filled gaps; 'none' = calendar info
   * only, no bundled content for this identity. */
  contentMatch: 'exact' | 'partial' | 'none'
}

// ---------------------------------------------------------------------------------------------
// Chunk store plumbing
// ---------------------------------------------------------------------------------------------

interface RawReadingsEntry {
  primeiraLeitura?: LiturgyReading[]
  salmo?: LiturgyPsalm[]
  segundaLeitura?: LiturgyReading[]
  evangelho?: LiturgyReading[]
  extras?: LiturgyReading[]
}

interface RawPropersEntry {
  oracoes?: LiturgyDay['oracoes']
  antifonas?: LiturgyDay['antifonas']
}

interface ProperChunk {
  readings?: Record<string, RawReadingsEntry>
  propers?: Record<string, RawPropersEntry>
}

interface Manifest {
  readings: Record<string, string>
  propers: Record<string, string>
}

// The generated manifest is a plain key->chunkId object; small (tens of KB of strings), so it's
// fine to bundle eagerly rather than lazy-loading it too.
const manifest = MANIFEST as unknown as Manifest

/**
 * Fetches one generated chunk by id, returning its parsed `{ readings, propers }` maps (or
 * `undefined` if the chunk id is unknown). Injectable so Node-side callers (verify-propers.mjs,
 * coverage-report.mjs) can supply an fs-based implementation instead of going through
 * `CHUNK_LOADERS`'s Vite-only dynamic `import()` — see chunks.ts's header comment for why the two
 * environments can't share one dynamic-import call.
 */
export type ChunkFetcher = (chunkId: string) => Promise<ProperChunk | undefined>

const chunkCache = new Map<string, Promise<ProperChunk | undefined>>()

const defaultFetcher: ChunkFetcher = (chunkId) => {
  let pending = chunkCache.get(chunkId)
  if (!pending) {
    const loader = (CHUNK_LOADERS as Record<string, () => Promise<{ default: ProperChunk }>>)[chunkId]
    pending = loader ? loader().then((m) => m.default) : Promise.resolve(undefined)
    chunkCache.set(chunkId, pending)
  }
  return pending
}

// ---------------------------------------------------------------------------------------------
// Lookup with fallback
// ---------------------------------------------------------------------------------------------

async function lookupReadings(
  day: LiturgicalDay,
  fetcher: ChunkFetcher
): Promise<{ entry: RawReadingsEntry | undefined; exact: boolean }> {
  const variants = readingsKeyVariants(day)
  for (let i = 0; i < variants.length; i++) {
    const key = variants[i]
    const chunkId = manifest.readings[key]
    if (!chunkId) continue
    const chunk = await fetcher(chunkId)
    const entry = chunk?.readings?.[key]
    if (entry) return { entry, exact: i === 0 }
  }
  return { entry: undefined, exact: false }
}

async function lookupPropers(day: LiturgicalDay, fetcher: ChunkFetcher): Promise<RawPropersEntry | undefined> {
  const key = propersKeyFor(day)
  const chunkId = manifest.propers[key]
  if (!chunkId) return undefined
  const chunk = await fetcher(chunkId)
  return chunk?.propers?.[key]
}

function isoDate(date: Date): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

/**
 * Resolve the full liturgy for a civil date: the calendar engine computes the day's liturgical
 * identity, the matching propers chunk(s) are lazy-imported, and pt + Latin content is composed.
 * `fetcher` defaults to the generated Vite-safe chunk thunks; pass an fs-based one from Node.
 */
export async function resolveLiturgyForDate(date: Date, fetcher: ChunkFetcher = defaultFetcher): Promise<LiturgyDay | undefined> {
  const day = liturgicalDay(date)

  const [{ entry: readings, exact: readingsExact }, propers] = await Promise.all([
    lookupReadings(day, fetcher),
    lookupPropers(day, fetcher),
  ])

  const hasPropers = propers !== undefined
  const contentMatch: LiturgyDay['contentMatch'] =
    readings && readingsExact && hasPropers ? 'exact' : readings || hasPropers ? 'partial' : 'none'

  return {
    date: isoDate(date),
    liturgia: day.celebration,
    cor: day.color,
    antifonas: propers?.antifonas,
    oracoes: propers?.oracoes,
    leituras: {
      primeiraLeitura: readings?.primeiraLeitura,
      salmo: readings?.salmo,
      segundaLeitura: readings?.segundaLeitura,
      evangelho: readings?.evangelho,
      extras: readings?.extras,
    },
    contentMatch,
  }
}
