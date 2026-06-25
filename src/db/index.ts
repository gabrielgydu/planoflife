import Dexie, { type EntityTable, type Transaction } from 'dexie'
import type {
  Category,
  Practice,
  DailyRecord,
  MissedReason,
  ExamenEntry,
  GuidingQuestion,
  Proposito,
  CareerPlan,
  CareerMove,
  CareerDeadline,
  CareerOutreachAttempt,
  CareerLadderRung,
  CareerWin,
  CareerLogEntry,
  MeditationDay,
} from '../types'
import { generateId } from '../utils/id'
import {
  NOVENA_TRABALHO_PRACTICE_ID,
  NOVENA_TRABALHO_BUNDLED_ID,
  NOVENA_TRABALHO_NAME,
  NOVENA_TRABALHO_CATEGORY,
  NOVENA_TRABALHO_WINDOW,
} from '../data/novena'

// Practices added after the initial seed. Used by both the fresh-install seed
// and the version(3) upgrade, so existing installs pick them up on next load.
export interface AdditionalPracticeSpec {
  name: string
  categoryName: string
  isRequired: boolean
  bundledTextId?: string
  // A FIXED practice id. Optional: legacy specs omit it and get a per-device random
  // UUID. Specs added AFTER sync went live (v5) must set it so the same logical
  // practice gets the SAME id on every device — otherwise the version-N upgrade
  // runs independently per device, and the union-merge on a push conflict would
  // resurrect both copies as a duplicate (no tombstones). See src/sync/merge.ts.
  id?: string
  // Optional calendar window (month/day, recurs yearly) outside of which the
  // practice is hidden — e.g. a novena. Copied verbatim onto the practice row.
  activeWindow?: Practice['activeWindow']
}

export const ADDITIONAL_PRACTICES: AdditionalPracticeSpec[] = [
  { name: 'Oferecimento do Trabalho', categoryName: 'Orações da Manhã', isRequired: false, bundledTextId: 'oferecimento_do_trabalho' },
  { name: 'Leitura do Evangelho', categoryName: 'Orações da Manhã', isRequired: true },
  { id: 'sao-josemaria-prayer', name: 'Oração a São Josemaria', categoryName: 'Meio-dia', isRequired: false, bundledTextId: 'sao_josemaria' },
  // Second daily mental prayer. No bundledTextId: like the morning "Meditação" it
  // opens the dedicated Escrivá reader (routed by name → slot, see meditation.ts),
  // which draws its own independent point.
  { id: 'meditacao-tarde', name: 'Meditação da Tarde', categoryName: 'Tarde', isRequired: true },
  {
    id: NOVENA_TRABALHO_PRACTICE_ID,
    name: NOVENA_TRABALHO_NAME,
    categoryName: NOVENA_TRABALHO_CATEGORY,
    isRequired: false,
    bundledTextId: NOVENA_TRABALHO_BUNDLED_ID,
    activeWindow: NOVENA_TRABALHO_WINDOW,
  },
]

const normalizeName = (s: string) =>
  s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim()

// Insert any ADDITIONAL_PRACTICES not already present (matched by normalized name),
// appended to the end of their category. Idempotent \u2014 safe to run from multiple
// version upgrades; a re-run or a manual addition won't create duplicates. Shared
// by the version(3) and version(8) upgrades so existing installs pick up practices
// introduced after their last open. Fresh installs get these via the seed instead.
async function addMissingAdditionalPractices(tx: Transaction): Promise<void> {
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
      id: spec.id ?? generateId(),
      name: spec.name,
      categoryId: category.id,
      content: '',
      imageData: null,
      domain: 'spiritual',
      isRequired: spec.isRequired,
      sortOrder,
      isArchived: false,
      createdAt: now,
      updatedAt: now,
      ...(spec.bundledTextId ? { bundledTextId: spec.bundledTextId } : {}),
      ...(spec.activeWindow ? { activeWindow: spec.activeWindow } : {}),
    }
    await practicesTable.add(practice)
    existingNames.add(normalizeName(spec.name))
  }
}

export class PlanOfLifeDB extends Dexie {
  categories!: EntityTable<Category, 'id'>
  practices!: EntityTable<Practice, 'id'>
  dailyRecords!: EntityTable<DailyRecord, 'id'>
  missedReasons!: EntityTable<MissedReason, 'id'>
  examenEntries!: EntityTable<ExamenEntry, 'id'>
  guidingQuestions!: EntityTable<GuidingQuestion, 'id'>
  propositos!: EntityTable<Proposito, 'id'>
  careerPlan!: EntityTable<CareerPlan, 'id'>
  careerMoves!: EntityTable<CareerMove, 'id'>
  careerDeadlines!: EntityTable<CareerDeadline, 'id'>
  careerOutreach!: EntityTable<CareerOutreachAttempt, 'id'>
  careerLadder!: EntityTable<CareerLadderRung, 'id'>
  careerWins!: EntityTable<CareerWin, 'id'>
  careerLog!: EntityTable<CareerLogEntry, 'id'>
  meditationDays!: EntityTable<MeditationDay, 'id'>

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
    this.version(3).stores({}).upgrade(addMissingAdditionalPractices)

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

    // Tag every existing practice as spiritual — the lifestyle-habits feature adds
    // an optional `domain` field, and pre-feature rows are all devotions. Idempotent:
    // skips already-tagged rows. Deliberately does NOT bump updatedAt: both devices
    // backfill the identical value, so the sync merge keeps real-edit recency and
    // converges without a spurious conflict winner.
    this.version(6).stores({}).upgrade(async (tx) => {
      const practices = tx.table('practices')
      const all = (await practices.toArray()) as Practice[]
      for (const p of all) {
        if (p.domain) continue
        await practices.update(p.id, { domain: 'spiritual' })
      }
    })

    // Career section tables (see src/types — "Career section"). New, empty stores
    // only — no upgrade function needed, and existing rows are untouched, so the
    // migration is trivially idempotent. They stay empty on every install until a
    // synced snapshot carries career data (Gabriel's devices only).
    this.version(7).stores({
      careerPlan: 'id',
      careerMoves: 'id, sortOrder',
      careerDeadlines: 'id, date',
      careerOutreach: 'id, date',
      careerLadder: 'id, rung',
      careerWins: 'id, date',
      careerLog: 'id, date',
    })

    // Add "Oração a São Josemaria" to existing installs (v3 already ran on them,
    // so it won't pick up specs added to ADDITIONAL_PRACTICES since). The new spec
    // carries a FIXED id, so both of a user's devices insert the identical row and
    // sync converges instead of duplicating. Idempotent + name-matched (see helper).
    this.version(8).stores({}).upgrade(addMissingAdditionalPractices)

    // Add "Novena a São Josemaria" (the 17–25 June novena do trabalho) to
    // existing installs — same FIXED-id reasoning as v8. It carries an
    // activeWindow so it only shows during those nine days each year. The helper
    // copies the window onto the row, so both devices insert an identical row.
    this.version(9).stores({}).upgrade(addMissingAdditionalPractices)

    // Meditação — one drawn Escrivá point per day (see src/data/meditation.ts).
    // New empty store keyed by the date string (one row per day); no upgrade fn,
    // trivially idempotent, like the career tables in v7. The drawn number syncs,
    // so the sync schema bumps to 3 — see src/sync/types.ts and sync-core.mjs.
    this.version(10).stores({ meditationDays: 'id' })

    // Add "Meditação da Tarde" (the afternoon mental prayer — a second meditation
    // slot, see src/data/meditation.ts) to existing installs. Same FIXED-id
    // reasoning as v8/v9: both of a user's devices insert the identical row so sync
    // converges instead of duplicating. Idempotent + name-matched (see helper). Its
    // draws are stored as separate meditationDays rows (id `date:tarde`), so no sync
    // schema bump — the existing meditationDays table already covers them.
    this.version(11).stores({}).upgrade(addMissingAdditionalPractices)
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
