import type { Practice } from '../types'

// "Leitura do Novo Testamento" — the daily New Testament reading (Plano de Vida,
// sortOrder 4). The practice itself is NOT new: the v14 restructure renamed the
// seeded "Leitura do Evangelho" row in place, so it carries a per-device random id
// and the normalized NAME is the only stable cross-device key — same situation as
// "Santa Missa" (see isSantaMissaPractice). Opening it shows the bilingual NT reader
// (NovoTestamentoView) instead of the plain text pager.

export const NOVO_TESTAMENTO_NAME = 'Leitura do Novo Testamento'

// Fixed id of the db.readingPositions row for the NT read-through. A FIXED id (not
// generateId()) so both devices write the same row: the push-conflict merge unions
// by id with no tombstones, so two random ids would become two competing bookmarks.
export const NT_READING_ID = 'nt'

const normalizeName = (s: string) =>
  s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim()

/** True for the daily NT reading — used to route it to the Scripture reader. */
export function isNovoTestamentoPractice(practice: Practice): boolean {
  return normalizeName(practice.name) === normalizeName(NOVO_TESTAMENTO_NAME)
}
