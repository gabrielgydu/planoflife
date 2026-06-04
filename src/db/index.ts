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
import { generateId } from '../utils/id'

// Practices added after the initial seed. Used by both the fresh-install seed
// and the version(3) upgrade, so existing installs pick them up on next load.
export interface AdditionalPracticeSpec {
  name: string
  categoryName: string
  isRequired: boolean
  bundledTextId?: string
}

export const ADDITIONAL_PRACTICES: AdditionalPracticeSpec[] = [
  { name: 'Oferecimento do Trabalho', categoryName: 'Orações da Manhã', isRequired: false, bundledTextId: 'oferecimento_do_trabalho' },
  { name: 'Leitura do Evangelho', categoryName: 'Orações da Manhã', isRequired: true },
]

const normalizeName = (s: string) =>
  s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim()

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

    this.version(2).stores({}).upgrade(async (tx) => {
      const nameToId: Record<string, string> = {
        'oferecimento de obras': 'oferecimento_de_obras',
        'preces da obra': 'preces_da_obra',
        'angelus': 'angelus',
        'lembrai-vos': 'lembrai_vos',
        'visita ao santissimo': 'visita_ao_santissimo',
      }
      const normalize = (s: string) =>
        s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      const practices = tx.table('practices')
      const all = await practices.toArray()
      for (const p of all) {
        const id = nameToId[normalize(p.name)]
        if (id && !p.bundledTextId) {
          await practices.update(p.id, { bundledTextId: id })
        }
      }
    })

    // Add practices introduced after the initial seed to existing installs.
    // Idempotent: matches on normalized name so re-runs / manual additions
    // don't create duplicates. Fresh installs get these via the seed instead.
    this.version(3).stores({}).upgrade(async (tx) => {
      const categoriesTable = tx.table('categories')
      const practicesTable = tx.table('practices')

      const allCategories = (await categoriesTable.toArray()) as Category[]
      if (allCategories.length === 0) return

      const categoryByName = new Map(allCategories.map((c) => [normalizeName(c.name), c]))
      const fallbackCategory = [...allCategories].sort((a, b) => a.sortOrder - b.sortOrder)[0]

      const allPractices = (await practicesTable.toArray()) as Practice[]
      const existingNames = new Set(allPractices.map((p) => normalizeName(p.name)))
      const maxSortOrderByCategory = new Map<string, number>()
      for (const p of allPractices) {
        const prev = maxSortOrderByCategory.get(p.categoryId) ?? -1
        if (p.sortOrder > prev) maxSortOrderByCategory.set(p.categoryId, p.sortOrder)
      }

      const now = new Date().toISOString()
      for (const spec of ADDITIONAL_PRACTICES) {
        if (existingNames.has(normalizeName(spec.name))) continue
        const category = categoryByName.get(normalizeName(spec.categoryName)) ?? fallbackCategory
        const sortOrder = (maxSortOrderByCategory.get(category.id) ?? -1) + 1
        maxSortOrderByCategory.set(category.id, sortOrder)
        const practice: Practice = {
          id: generateId(),
          name: spec.name,
          categoryId: category.id,
          content: '',
          imageData: null,
          isRequired: spec.isRequired,
          sortOrder,
          isArchived: false,
          createdAt: now,
          updatedAt: now,
          ...(spec.bundledTextId ? { bundledTextId: spec.bundledTextId } : {}),
        }
        await practicesTable.add(practice)
        existingNames.add(normalizeName(spec.name))
      }
    })

    // Backfill bundledTextId onto additional practices that were already added
    // by a prior version(3) run before they had bundled text. Idempotent:
    // only sets it when missing, matched by normalized name.
    this.version(4).stores({}).upgrade(async (tx) => {
      const practicesTable = tx.table('practices')
      const allPractices = (await practicesTable.toArray()) as Practice[]
      const practiceByName = new Map(allPractices.map((p) => [normalizeName(p.name), p]))
      const now = new Date().toISOString()
      for (const spec of ADDITIONAL_PRACTICES) {
        if (!spec.bundledTextId) continue
        const practice = practiceByName.get(normalizeName(spec.name))
        if (practice && !practice.bundledTextId) {
          await practicesTable.update(practice.id, {
            bundledTextId: spec.bundledTextId,
            updatedAt: now,
          })
        }
      }
    })

    // Backfill updatedAt on dailyRecords (added for sync conflict merge). Use the
    // record's completedAt when present, else the Unix epoch so a never-completed
    // record always loses to a real edit. Idempotent: skips rows already migrated.
    this.version(5).stores({}).upgrade(async (tx) => {
      const records = tx.table('dailyRecords')
      const all = (await records.toArray()) as DailyRecord[]
      const epoch = new Date(0).toISOString()
      for (const r of all) {
        if (r.updatedAt) continue
        await records.update(r.id, { updatedAt: r.completedAt ?? epoch })
      }
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
