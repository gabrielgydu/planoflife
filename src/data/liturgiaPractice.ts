import type { Practice } from '../types'

// "Liturgia do Dia" — the daily Mass propers reader (see LITURGY_PLAN.md). Tracked
// like the antiphons: tapping it opens a dedicated overlay (LiturgiaView) instead
// of the text pager, and opening it auto-marks the practice done. Routed by
// normalized name; the fixed id only guarantees both of a user's synced devices
// insert the SAME row (see ADDITIONAL_PRACTICES). Named liturgiaPractice.ts (not
// liturgy.ts) to avoid clashing with data/liturgy.ts, the content loader.

export const LITURGIA_PRACTICE_ID = 'liturgia-do-dia'
export const LITURGIA_PRACTICE_NAME = 'Liturgia do Dia'

const normalizeName = (s: string) =>
  s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim()

/** True for the Liturgia do Dia practice — used to route to its overlay reader. */
export function isLiturgiaPractice(practice: Practice): boolean {
  return normalizeName(practice.name) === normalizeName(LITURGIA_PRACTICE_NAME)
}
