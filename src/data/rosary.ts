import type { Practice } from '../types'

// "Contemplação do Rosário" — a meditative reader over the rosary mysteries NOT
// prayed today. It is a tracked daily practice (category Tarde) whose tap opens a
// dedicated full-screen overlay instead of the text pager, exactly like the
// "Meditação" reader. Routed by normalized name (see isRosaryContemplationPractice)
// so it needs no per-device id mapping — the fixed id below only guarantees both of
// a user's synced devices insert the SAME row (see ADDITIONAL_PRACTICES).
export const ROSARY_CONTEMPLATION_PRACTICE_ID = 'contemplacao-rosario'
export const ROSARY_CONTEMPLATION_NAME = 'Contemplação do Rosário'
export const ROSARY_CONTEMPLATION_CATEGORY = 'Tarde'

const normalizeName = (s: string) =>
  s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim()

/** True for the rosary-contemplation practice — used to route to its reader. */
export function isRosaryContemplationPractice(practice: Practice): boolean {
  return normalizeName(practice.name) === normalizeName(ROSARY_CONTEMPLATION_NAME)
}
