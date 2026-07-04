import type { Practice } from '../types'
import { getBundledText, type BundledText } from './bundledTexts'
import { isEastertide } from '../utils/liturgical'

// "Ângelus (ou Regina Coeli no tempo pascal)": during Eastertide (Easter Sunday
// through Pentecost) the Angelus is replaced by the Regina Coeli — the practice
// row renames itself and its reader swaps texts, keyed off the VIEWED date.
// Matched by bundledTextId, which is stable across the v14 "Angelus" → "Ângelus"
// rename and across user renames.

export const ANGELUS_BUNDLED_ID = 'angelus'
export const REGINA_COELI_BUNDLED_ID = 'regina_coeli'
export const REGINA_COELI_DISPLAY_NAME = 'Regina Coeli'

export function isAngelusPractice(practice: Pick<Practice, 'bundledTextId'>): boolean {
  return practice.bundledTextId === ANGELUS_BUNDLED_ID
}

/**
 * Date-dependent reader text for the Angelus practice, mirroring
 * resolveNovenaReaderText: non-null only when the practice is the Angelus AND
 * the date falls in Eastertide — callers fall through to the practice's own
 * bundled text otherwise.
 */
export function resolveAngelusReaderText(practice: Practice, date: Date): BundledText | null {
  if (!isAngelusPractice(practice) || !isEastertide(date)) return null
  return getBundledText(REGINA_COELI_BUNDLED_ID) ?? null
}

/** Row display name override: "Regina Coeli" during Eastertide, else null. */
export function angelusDisplayName(practice: Practice, date: Date): string | null {
  if (!isAngelusPractice(practice) || !isEastertide(date)) return null
  return REGINA_COELI_DISPLAY_NAME
}
