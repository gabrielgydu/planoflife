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
