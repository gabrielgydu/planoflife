import type { Practice } from '../types'

// "Exame particular" — the midday particular examination of conscience. It is a
// tracked daily practice (category Meio-dia) whose tap opens a dedicated overlay
// (ExameParticularView) instead of the text pager, like "Meditação" / the rosary
// contemplation. Routed by normalized name (see isExameParticularPractice); the
// fixed id below only guarantees both of a user's synced devices insert the SAME
// row (see ADDITIONAL_PRACTICES). The active point (virtue/defect) itself lives as
// a synced setting (see useExameParticular); the practice's daily completion is a
// normal dailyRecord, so it counts in history like every other practice.
export const EXAME_PARTICULAR_PRACTICE_ID = 'exame-particular'
export const EXAME_PARTICULAR_NAME = 'Exame particular'
export const EXAME_PARTICULAR_CATEGORY = 'Meio-dia'

const normalizeName = (s: string) =>
  s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim()

/** True for the exame-particular practice — used to route to its reader. */
export function isExameParticularPractice(practice: Practice): boolean {
  return normalizeName(practice.name) === normalizeName(EXAME_PARTICULAR_NAME)
}
