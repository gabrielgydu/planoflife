import type { Practice } from '../types'
import { seasonalAntiphonId, type AntiphonId } from '../utils/liturgical'

// "Antífona da Santíssima Virgem Maria" — a Saturday practice whose tap opens a
// dedicated overlay (like the rosary contemplation) showing the four traditional
// Marian antiphons as swipeable cards, opening on the one proper to the season.
// Routed by normalized name; the fixed id only guarantees both synced devices
// insert the SAME row (see ADDITIONAL_PRACTICES).

export const ANTIPHON_PRACTICE_ID = 'antifona-virgem-maria'
export const ANTIPHON_NAME = 'Antífona da Santíssima Virgem Maria'

// Carousel order: fixed liturgical-year order (Advent → Candlemas → Eastertide
// → time after Pentecost), independent of which one is current.
export const ANTIPHON_TEXT_IDS: readonly AntiphonId[] = [
  'alma_redemptoris_mater',
  'ave_regina_caelorum',
  'regina_coeli',
  'salve_regina',
]

const normalizeName = (s: string) =>
  s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim()

/** True for the antiphon practice — used to route to its overlay reader. */
export function isAntiphonPractice(practice: Practice): boolean {
  return normalizeName(practice.name) === normalizeName(ANTIPHON_NAME)
}

/** Index of the season-proper antiphon within ANTIPHON_TEXT_IDS. */
export function seasonalAntiphonIndex(date: Date): number {
  return ANTIPHON_TEXT_IDS.indexOf(seasonalAntiphonId(date))
}
