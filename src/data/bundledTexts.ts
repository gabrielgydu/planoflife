import practiceTexts from './practice_texts.json'
import type { Practice } from '../types'

export interface BundledText {
  id: string
  title: Record<string, string>
  hasImage: boolean
  texts: Record<string, string>
}

export const bundledTextsMap = new Map<string, BundledText>(
  (practiceTexts as BundledText[]).map((t) => [t.id, t])
)

export function getBundledText(id?: string): BundledText | undefined {
  if (!id) return undefined
  return bundledTextsMap.get(id)
}

export function practiceHasText(practice: Practice): boolean {
  return !!(practice.content || practice.imageData || getBundledText(practice.bundledTextId))
}
