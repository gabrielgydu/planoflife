import type { Practice, PracticeDomain } from '../types'

// `domain` is optional on Practice so legacy rows — and any practice pulled via a
// whole-DB snapshot import that bypassed the v6 backfill migration — are treated
// as spiritual. Always read a practice's domain through this helper, never via
// `practice.domain` directly, so that fallback stays in one place.
export function getPracticeDomain(practice: Pick<Practice, 'domain'>): PracticeDomain {
  return practice.domain ?? 'spiritual'
}

export function isLifestyle(practice: Pick<Practice, 'domain'>): boolean {
  return getPracticeDomain(practice) === 'lifestyle'
}
