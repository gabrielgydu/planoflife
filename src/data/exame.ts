import type { Practice } from '../types'

// "Exame particular" — the midday particular examination of conscience. It is a
// required daily practice of the Plano de Vida (moved there from Meio-dia by v20)
// whose tap opens a dedicated overlay (ExameParticularView) instead of the text
// pager, like "Meditação" / the rosary contemplation. Routed by normalized name
// (see isExameParticularPractice); the fixed id below only guarantees both of a
// user's synced devices insert the SAME row (see ADDITIONAL_PRACTICES). The active
// tema — with its pontos concretos and the guidance received — lives in the synced
// db.exameTemas table (see useExameTema); the practice's daily completion is a
// normal dailyRecord, so it counts in history like every other practice.
export const EXAME_PARTICULAR_PRACTICE_ID = 'exame-particular'
export const EXAME_PARTICULAR_NAME = 'Exame particular'

const normalizeName = (s: string) =>
  s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim()

/** True for the exame-particular practice — used to route to its reader. */
export function isExameParticularPractice(practice: Practice): boolean {
  return normalizeName(practice.name) === normalizeName(EXAME_PARTICULAR_NAME)
}
