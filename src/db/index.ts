import Dexie, { type EntityTable } from 'dexie'
import type {
  Category,
  Practice,
  DailyRecord,
  MissedReason,
  ExamenEntry,
  GuidingQuestion,
  Proposito,
} from '../types'

export class PlanOfLifeDB extends Dexie {
  categories!: EntityTable<Category, 'id'>
  practices!: EntityTable<Practice, 'id'>
  dailyRecords!: EntityTable<DailyRecord, 'id'>
  missedReasons!: EntityTable<MissedReason, 'id'>
  examenEntries!: EntityTable<ExamenEntry, 'id'>
  guidingQuestions!: EntityTable<GuidingQuestion, 'id'>
  propositos!: EntityTable<Proposito, 'id'>

  constructor() {
    super('PlanOfLifeDB')
    this.version(1).stores({
      categories: 'id, sortOrder',
      practices: 'id, categoryId, sortOrder, isArchived',
      dailyRecords: 'id, date, practiceId, [date+practiceId]',
      missedReasons: 'id, date, practiceId, [date+practiceId]',
      examenEntries: 'id, date, category, isForConfession, confessionDate',
      guidingQuestions: 'id, sortOrder, isArchived',
      propositos: 'id, date, sourceExamenEntryId',
    })
  }
}

export const db = new PlanOfLifeDB()

const EMOJI_TO_ICON: Record<string, string> = {
  '🌅': 'Sunrise',
  '☀️': 'Sun',
  '🕛': 'Clock',
  '🌤️': 'CloudSun',
  '🌙': 'Moon',
  '⛪': 'Church',
  '📿': 'Cross',
  '✝️': 'Cross',
  '🙏': 'HandHeart',
  '📖': 'BookOpen',
  '❤️': 'Heart',
  '⭐': 'Star',
}

export async function migrateEmojisToIcons(): Promise<void> {
  const categories = await db.categories.toArray()
  const updates = categories.filter((c) => EMOJI_TO_ICON[c.emoji])
  if (updates.length === 0) return
  await db.transaction('rw', db.categories, async () => {
    for (const cat of updates) {
      await db.categories.update(cat.id, { emoji: EMOJI_TO_ICON[cat.emoji] })
    }
  })
}
