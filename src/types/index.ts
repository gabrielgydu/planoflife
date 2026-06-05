export interface Category {
  id: string
  name: string
  sortOrder: number
  emoji: string
  createdAt: string
  updatedAt: string
}

export type PracticeDomain = 'spiritual' | 'lifestyle'

export interface Practice {
  id: string
  name: string
  categoryId: string
  content: string // HTML string
  imageData: string | null // base64 string
  bundledTextId?: string
  // Spiritual devotion vs. non-religious lifestyle habit. Optional: legacy rows
  // (and whole-DB snapshots imported before the v6 migration) are treated as
  // 'spiritual' — read via getPracticeDomain(), never `.domain` directly.
  domain?: PracticeDomain
  isRequired: boolean
  sortOrder: number
  isArchived: boolean
  createdAt: string
  updatedAt: string
}

export interface DailyRecord {
  id: string // `${date}|${practiceId}`
  date: string // YYYY-MM-DD
  practiceId: string
  isCompleted: boolean
  completedAt: string | null
  updatedAt: string // bumped on every check/uncheck — used by sync merge
}

export interface MissedReason {
  id: string
  date: string // YYYY-MM-DD
  practiceId: string
  reasonText: string
  createdAt: string
}

export type ExamenCategory = 'gracias' | 'perdon' | 'ayudame'

export interface ExamenEntry {
  id: string
  date: string // YYYY-MM-DD
  text: string
  category: ExamenCategory
  isForConfession: boolean
  confessionDate: string | null
  createdAt: string
  updatedAt: string
}

export interface GuidingQuestion {
  id: string
  text: string
  sortOrder: number
  isArchived: boolean
  createdAt: string
}

export interface Proposito {
  id: string
  date: string // YYYY-MM-DD
  text: string
  sourceExamenEntryId: string | null
  createdAt: string
}
