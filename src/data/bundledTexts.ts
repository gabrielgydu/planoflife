import practiceTexts from './practice_texts.json'
import type { Practice } from '../types'

export interface BundledText {
  id: string
  title: Record<string, string>
  hasImage: boolean
  texts: Record<string, string>
}

// Device-local reader language preference (pt/la), shared by PracticeReader and
// the antiphon overlay. Deliberately NOT synced (see settingsBus).
export const PRACTICE_TEXT_LANG_KEY = 'practiceTextLang'

export const bundledTextsMap = new Map<string, BundledText>(
  (practiceTexts as BundledText[]).map((t) => [t.id, t])
)

export function getBundledText(id?: string): BundledText | undefined {
  if (!id) return undefined
  return bundledTextsMap.get(id)
}

export function practiceHasText(practice: Practice): boolean {
  return !!(
    practice.content ||
    practice.imageData ||
    getBundledText(practice.bundledTextId) ||
    // A Devocionário prayer added to the daily list: the text lives in db.prayers
    // (see PracticeReader), so the id alone is enough to know there is one.
    practice.prayerId
  )
}
