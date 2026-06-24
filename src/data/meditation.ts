// "Meditação" practice: a daily-drawn Escrivá point shown as three swipeable
// cards — Caminho / Sulco / Forja — all for the SAME number (1–1055). Mirrors the
// `om` CLI. The point text is bundled offline in escriva_points.json (built from
// the om cache by scripts/build-escriva-points.mjs); the number is drawn once per
// day via the Worker's /random (random.org) with a crypto fallback, then stored
// and synced (db.meditationDays, keyed by date) so it's stable and identical
// across devices. Reroll redraws and overwrites the day's number.

import { getSyncUrl, getAuthToken } from '../sync/config'
import type { Practice } from '../types'

export const BOOKS = [
  { key: 'caminho', label: 'Caminho', max: 999 },
  { key: 'sulco', label: 'Sulco', max: 1000 },
  { key: 'forja', label: 'Forja', max: 1055 },
] as const

export type BookKey = (typeof BOOKS)[number]['key']

// The draw spans the longest book (Forja, 1055). A number above a shorter book's
// max renders "(sem ponto)" for that card — faithful to `om`'s single-number model
// (Caminho ends at 999, Sulco at 1000).
export const MAX_POINT = 1055

export type EscrivaPoints = Record<BookKey, Record<string, string>>

let pointsCache: EscrivaPoints | null = null
let pointsPromise: Promise<EscrivaPoints> | null = null

/**
 * Lazy-load the bundled point text. A dynamic import keeps the ~740 KB JSON out
 * of the main bundle; built as its own JS chunk it is still workbox-precached
 * (globPatterns matches .js), so the reader works fully offline.
 */
export function loadEscrivaPoints(): Promise<EscrivaPoints> {
  if (pointsCache) return Promise.resolve(pointsCache)
  if (!pointsPromise) {
    pointsPromise = import('./escriva_points.json')
      .then((m) => {
        pointsCache = m.default as unknown as EscrivaPoints
        return pointsCache
      })
      .catch((err) => {
        // Never memoize a rejected promise — clear it so a later call re-imports
        // (e.g. after a transient chunk-load failure on a stale deploy). Otherwise
        // one failed fetch would brick the reader for the whole session.
        pointsPromise = null
        throw err
      })
  }
  return pointsPromise
}

/** The point text for a book + number, or null when that book has no such point. */
export function getEscrivaPoint(points: EscrivaPoints, book: BookKey, n: number): string | null {
  return points[book]?.[String(n)] ?? null
}

const normalizeName = (s: string) =>
  s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim()

/**
 * The seeded "Meditação" practice opens the 3-card reader. Matched by normalized
 * name: its id is a per-device random UUID (so not a stable cross-device key), and
 * re-keying it to a fixed id would risk a sync duplicate (the merge has no
 * tombstones). Name-matching needs no migration and converges everywhere.
 */
export function isMeditacaoPractice(practice: Practice): boolean {
  return normalizeName(practice.name) === 'meditacao'
}

export type DrawSource = 'random.org' | 'crypto'

/**
 * Draw a number in [1, max]. Prefers the Worker's /random (random.org), which is
 * gated behind the sync bearer token — so only the authed owner gets true
 * random.org numbers; everyone else (and the owner whenever the Worker or
 * random.org is unreachable) falls back to crypto.getRandomValues. Mirrors `om`'s
 * random.org → $RANDOM degradation.
 */
export async function drawPointNumber(
  max: number = MAX_POINT,
): Promise<{ n: number; source: DrawSource }> {
  const url = getSyncUrl()
  const token = getAuthToken()
  if (url && token) {
    try {
      const res = await fetch(`${url}/random?max=${max}`, {
        method: 'GET',
        headers: { Authorization: `Bearer ${token}` },
        cache: 'no-store',
        // Don't let a hung Worker / random.org stall the draw forever — on timeout
        // this aborts (throws) and we fall through to the crypto fallback below.
        signal: AbortSignal.timeout(4000),
      })
      if (res.ok) {
        const j = (await res.json()) as { n?: number }
        if (typeof j.n === 'number' && Number.isInteger(j.n) && j.n >= 1 && j.n <= max) {
          return { n: j.n, source: 'random.org' }
        }
      }
      // 401 / non-ok / malformed body → fall through to the crypto fallback.
    } catch {
      // Network error / offline → fall through to the crypto fallback.
    }
  }
  return { n: cryptoRandomInt(max), source: 'crypto' }
}

/** Unbiased integer in [1, max] via rejection sampling (no modulo bias). */
function cryptoRandomInt(max: number): number {
  const range = max // values 1..max → range size `max`, offset +1 below
  const limit = Math.floor(0xffffffff / range) * range
  const buf = new Uint32Array(1)
  let r: number
  do {
    crypto.getRandomValues(buf)
    r = buf[0]
  } while (r >= limit)
  return 1 + (r % range)
}
