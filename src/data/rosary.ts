import type { Practice } from '../types'
import rosaryRaw from './rosary_contemplation.json'

// "Contemplação do Rosário" — a meditative reader over the rosary mysteries NOT
// prayed today. It is a required daily practice of the Plano de Vida (moved there
// from Tarde by v20, sitting right after "Santo Rosário") whose tap opens a
// dedicated full-screen overlay instead of the text pager, exactly like the
// "Meditação" reader. Routed by normalized name (see isRosaryContemplationPractice)
// so it needs no per-device id mapping — the fixed id below only guarantees both of
// a user's synced devices insert the SAME row (see ADDITIONAL_PRACTICES).
export const ROSARY_CONTEMPLATION_PRACTICE_ID = 'contemplacao-rosario'
export const ROSARY_CONTEMPLATION_NAME = 'Contemplação do Rosário'

const normalizeName = (s: string) =>
  s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim()

/** True for the rosary-contemplation practice — used to route to its reader. */
export function isRosaryContemplationPractice(practice: Practice): boolean {
  return normalizeName(practice.name) === normalizeName(ROSARY_CONTEMPLATION_NAME)
}

// "Santo Rosário" — the vocal rosary itself, a core Plano de Vida move with a
// per-device random id (see PLANO_DE_VIDA_MOVES, sortOrder 7). Its tap opens the
// bead-by-bead praying engine (RosaryPrayerView) instead of the text pager.
// Matched by normalized name, exactly like isSantaMissaPractice.
export const SANTO_ROSARIO_NAME = 'Santo Rosário'

/** True for the "Santo Rosário" practice — used to route it to the praying engine. */
export function isSantoRosarioPractice(practice: Practice): boolean {
  return normalizeName(practice.name) === normalizeName(SANTO_ROSARIO_NAME)
}

// ---------------------------------------------------------------------------
// Mystery-set schedule, shared by the contemplation reader (which EXCLUDES the
// day's set) and the praying engine (which PRAYS it). Derived from each set's
// vocalDays in rosary_contemplation.json: Mon/Sat → Gozosos, Tue/Fri →
// Dolorosos, Wed/Sun → Gloriosos, Thu → Luminosos.

export type SetKey = 'gozosos' | 'dolorosos' | 'gloriosos' | 'luminosos'

/** Canonical liturgical order (Joyful → Luminous → Sorrowful → Glorious). */
export const SET_ORDER: SetKey[] = ['gozosos', 'luminosos', 'dolorosos', 'gloriosos']

const vocalSets = rosaryRaw.sets as Record<SetKey, { vocalDays: number[] }>
const setByWeekday = (Object.keys(vocalSets) as SetKey[]).reduce<Record<number, SetKey>>(
  (acc, key) => {
    for (const day of vocalSets[key].vocalDays) acc[day] = key
    return acc
  },
  {},
)

/** The set prayed vocally on the given date's weekday, per the traditional schedule. */
export function prayedSetForWeekday(date: Date): SetKey {
  return setByWeekday[date.getDay()]
}
