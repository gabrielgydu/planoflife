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
import {
  ROSARY_CONTEMPLATION_PRACTICE_ID,
  ROSARY_CONTEMPLATION_NAME,
  ROSARY_CONTEMPLATION_CATEGORY,
} from '../data/rosary'
import {
  EXAME_PARTICULAR_PRACTICE_ID,
  EXAME_PARTICULAR_NAME,
  EXAME_PARTICULAR_CATEGORY,
} from '../data/exame'
import {
  PLANO_DE_VIDA_CATEGORY_ID,
  PLANO_DE_VIDA_CATEGORY_NAME,
  PLANO_DE_VIDA_ICON,
  PLANO_DE_VIDA_MOVES,
  MORTIFICACAO_PRACTICE_ID,
  MORTIFICACAO_NAME,
  CONFISSAO_PRACTICE_ID,
  CONFISSAO_NAME,
} from '../data/planoDeVida'
import { ANTIPHON_PRACTICE_ID, ANTIPHON_NAME } from '../data/antiphon'
import {
  COSTUMES_CATEGORY_ID,
  COSTUMES_CATEGORY_NAME,
  COSTUMES_ICON,
  AGUA_BENTA_PRACTICE_ID,
  AGUA_BENTA_NAME,
  TRES_AVE_MARIAS_PRACTICE_ID,
  TRES_AVE_MARIAS_NAME,
  TRES_AVE_MARIAS_OLD_CATEGORY_NAME,
  CREDO_ATANASIO_PRACTICE_ID,
  CREDO_ATANASIO_NAME,
  CREDO_ATANASIO_BUNDLED_ID,
  CREDO_ATANASIO_MONTHLY,
} from '../data/costumes'

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
  // Weekdays (0=Sun … 6=Sat) the practice is scheduled; off-days are hidden
  // from the daily list and neutral in stats. Copied verbatim onto the row.
  scheduleDays?: number[]
  // 'weekly' = satisfied by any completed record in the Monday-start week
  // (e.g. Confissão sacramental). Copied verbatim onto the row.
  cadence?: Practice['cadence']
  // Monthly recurrence: show only on the Nth weekday of the month (e.g. the
  // Athanasian Creed on the third Sunday). Copied verbatim onto the row.
  monthlySchedule?: Practice['monthlySchedule']
  // Explicit position within the category. Absent = append after the current
  // max (the pre-v14 behavior). Needed by the Plano de Vida specs, whose slots
  // (4, 9, 11–13) are interleaved with rows the v14 migration moves there.
  sortOrder?: number
}

export const ADDITIONAL_PRACTICES: AdditionalPracticeSpec[] = [
  { name: 'Oferecimento do Trabalho', categoryName: 'Orações da Manhã', isRequired: false, bundledTextId: 'oferecimento_do_trabalho' },
  // Renamed from "Leitura do Evangelho" and moved into Plano de Vida by v14. The
  // spec carries the FINAL name/category: the by-name idempotency check below must
  // match the post-rename row, or a re-run would insert a duplicate.
  { name: 'Leitura do Novo Testamento', categoryName: PLANO_DE_VIDA_CATEGORY_NAME, isRequired: true, sortOrder: 4 },
  { id: 'sao-josemaria-prayer', name: 'Oração a São Josemaria', categoryName: 'Meio-dia', isRequired: false, bundledTextId: 'sao_josemaria' },
  // Second daily mental prayer (renamed from "Meditação da Tarde" by v14 — final
  // name here, same reasoning as above). No bundledTextId: like the morning slot it
  // opens the dedicated Escrivá reader (routed by name → slot, see meditation.ts),
  // which draws its own independent point.
  { id: 'meditacao-tarde', name: 'Oração mental da tarde', categoryName: PLANO_DE_VIDA_CATEGORY_NAME, isRequired: true, sortOrder: 9 },
  {
    id: NOVENA_TRABALHO_PRACTICE_ID,
    name: NOVENA_TRABALHO_NAME,
    categoryName: NOVENA_TRABALHO_CATEGORY,
    isRequired: false,
    bundledTextId: NOVENA_TRABALHO_BUNDLED_ID,
    activeWindow: NOVENA_TRABALHO_WINDOW,
  },
  // Contemplation of the rosary mysteries NOT prayed today. No bundledTextId: like
  // "Meditação" it opens a dedicated overlay reader (routed by name, see
  // src/data/rosary.ts) rather than the text pager. isRequired false — it's a
  // contemplative aid alongside the obligatory "Rosário", not a separate duty.
  {
    id: ROSARY_CONTEMPLATION_PRACTICE_ID,
    name: ROSARY_CONTEMPLATION_NAME,
    categoryName: ROSARY_CONTEMPLATION_CATEGORY,
    isRequired: false,
  },
  // Midday particular examen. No bundledTextId; like the rosary contemplation it
  // opens a dedicated overlay reader (routed by name, see src/data/exame.ts). The
  // active point lives as a synced setting; completion is a normal dailyRecord.
  {
    id: EXAME_PARTICULAR_PRACTICE_ID,
    name: EXAME_PARTICULAR_NAME,
    categoryName: EXAME_PARTICULAR_CATEGORY,
    isRequired: false,
  },
  // Saturday plan-of-life practices (v14). scheduleDays hides them Mon–Fri and
  // keeps those days neutral in stats. Plain checkbox — no reader text.
  {
    id: MORTIFICACAO_PRACTICE_ID,
    name: MORTIFICACAO_NAME,
    categoryName: PLANO_DE_VIDA_CATEGORY_NAME,
    isRequired: true,
    scheduleDays: [6],
    sortOrder: 11,
  },
  // The seasonal Marian antiphon. No bundledTextId; routes to its own swipeable
  // overlay reader (src/data/antiphon.ts) that opens on the season-proper text.
  {
    id: ANTIPHON_PRACTICE_ID,
    name: ANTIPHON_NAME,
    categoryName: PLANO_DE_VIDA_CATEGORY_NAME,
    isRequired: true,
    scheduleDays: [6],
    sortOrder: 12,
  },
  // (The v17 "Liturgia do Dia" practice was removed in v18 — the daily Mass
  // readings now open from "Santa Missa" instead. See ensureLiturgiaRemoved.)
  // Weekly confession (v14): shown every day, satisfied by any completed record
  // in the Monday-start week, resets the following Monday. Deliberately NOT
  // required — no missed-reason nagging about confession.
  {
    id: CONFISSAO_PRACTICE_ID,
    name: CONFISSAO_NAME,
    categoryName: PLANO_DE_VIDA_CATEGORY_NAME,
    isRequired: false,
    cadence: 'weekly',
    sortOrder: 13,
  },
  // The "Costumes" pair (v15). Água Benta is brand new; Três Ave-Marias
  // normally already exists (original seed, per-device random id, in Noite)
  // and is MOVED by ensureCostumesState — its spec only inserts a fixed-id
  // replacement when the user had deleted that row (the by-name idempotency
  // check skips it otherwise). Plain checkboxes, no reader text; deliberately
  // not required — customs, not norms, so no missed-reason nagging.
  {
    id: AGUA_BENTA_PRACTICE_ID,
    name: AGUA_BENTA_NAME,
    categoryName: COSTUMES_CATEGORY_NAME,
    isRequired: false,
    sortOrder: 0,
  },
  {
    id: TRES_AVE_MARIAS_PRACTICE_ID,
    name: TRES_AVE_MARIAS_NAME,
    categoryName: COSTUMES_CATEGORY_NAME,
    isRequired: false,
    sortOrder: 1,
  },
  // The Athanasian Creed (v16): a bundled-text custom (PT + Latin) shown only on
  // the third Sunday of each month via monthlySchedule. Pure fixed-id insert into
  // the existing Costumes category — not required (a custom, no missed-reason
  // nagging), same convergence reasoning as the other post-sync additions.
  {
    id: CREDO_ATANASIO_PRACTICE_ID,
    name: CREDO_ATANASIO_NAME,
    categoryName: COSTUMES_CATEGORY_NAME,
    isRequired: false,
    bundledTextId: CREDO_ATANASIO_BUNDLED_ID,
    monthlySchedule: CREDO_ATANASIO_MONTHLY,
    sortOrder: 2,
  },
]

const normalizeName = (s: string) =>
  s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim()

// Both a Dexie instance and an upgrade Transaction expose table() \u2014 the shared
// migration bodies accept either, so the post-sync reconciliation can re-run
// them through the live (hook-captured) db. See ensurePlanoDeVidaState.
type TableSource = Pick<Transaction, 'table'>

// Insert any ADDITIONAL_PRACTICES not already present (matched by normalized name),
// appended to the end of their category unless the spec pins a sortOrder. Idempotent
// \u2014 safe to run from multiple version upgrades; a re-run or a manual addition won't
// create duplicates: a spec is skipped when its normalized name OR its fixed id
// already exists (the id check matters when the user renamed a fixed-id practice \u2014
// a bare add() would ConstraintError and abort the whole upgrade transaction).
// Shared by the version(3/8/9/11/12/13/14) upgrades so existing installs pick up
// practices introduced after their last open. Fresh installs get these via the seed.
async function addMissingAdditionalPractices(tx: TableSource): Promise<void> {
  const categoriesTable = tx.table('categories')
  const practicesTable = tx.table('practices')

  const allCategories = (await categoriesTable.toArray()) as Category[]
  if (allCategories.length === 0) return

  const categoryByName = new Map(allCategories.map((c) => [normalizeName(c.name), c]))
  const fallbackCategory = [...allCategories].sort((a, b) => a.sortOrder - b.sortOrder)[0]

  const allPractices = (await practicesTable.toArray()) as Practice[]
  const existingNames = new Set(allPractices.map((p) => normalizeName(p.name)))
  const existingIds = new Set(allPractices.map((p) => p.id))
  const maxSortOrderByCategory = new Map<string, number>()
  for (const p of allPractices) {
    const prev = maxSortOrderByCategory.get(p.categoryId) ?? -1
    if (p.sortOrder > prev) maxSortOrderByCategory.set(p.categoryId, p.sortOrder)
  }

  const now = new Date().toISOString()
  for (const spec of ADDITIONAL_PRACTICES) {
    if (existingNames.has(normalizeName(spec.name))) continue
    if (spec.id && existingIds.has(spec.id)) continue
    const category = categoryByName.get(normalizeName(spec.categoryName)) ?? fallbackCategory
    let sortOrder: number
    if (spec.sortOrder !== undefined) {
      sortOrder = spec.sortOrder
    } else {
      sortOrder = (maxSortOrderByCategory.get(category.id) ?? -1) + 1
      maxSortOrderByCategory.set(category.id, sortOrder)
    }
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
      ...(spec.scheduleDays ? { scheduleDays: spec.scheduleDays } : {}),
      ...(spec.cadence ? { cadence: spec.cadence } : {}),
      ...(spec.monthlySchedule ? { monthlySchedule: spec.monthlySchedule } : {}),
    }
    await practicesTable.add(practice)
    existingNames.add(normalizeName(spec.name))
    existingIds.add(practice.id)
  }
}

// One-time "the v14 migration still needs to reach the cloud" marker. Upgrade
// writes run before mutationCapture installs its hooks, so they are never marked
// dirty \u2014 without this, a later pull of an older snapshot would silently revert
// the whole migration (and version(14) never re-runs). SyncProvider re-runs
// ensurePlanoDeVidaState through the live db after the initial pull settles,
// which captures any re-applied writes as dirty and pushes them, then clears
// the flag. Harmless on unsynced installs (the re-run is a no-op, flag cleared).
export const PLANO_V14_PENDING_PUSH_KEY = 'plano-v14-pending-push'

/**
 * The v14 "Plano de Vida" restructure, idempotent so it can run twice: once from
 * the version(14) upgrade transaction and once from the post-sync reconciliation
 * (see PLANO_V14_PENDING_PUSH_KEY). Every row it actually changes gets a bumped
 * updatedAt \u2014 unlike the v6 backfill, these rows must WIN the LWW merge against
 * stale pre-migration devices, or an unrelated edit there would resurrect the old
 * names (merge ties go to `ours`). Rows already in the desired state are not
 * touched, so the reconciliation re-run after pulling a migrated snapshot writes
 * nothing.
 */
export async function ensurePlanoDeVidaState(tx: TableSource): Promise<void> {
  const categoriesTable = tx.table('categories')
  const practicesTable = tx.table('practices')

  const allCategories = (await categoriesTable.toArray()) as Category[]
  if (allCategories.length === 0) return
  const now = new Date().toISOString()

  // 1. Ensure the category. By fixed id first; by normalized name as a fallback
  // (covers a hand-created category of the same name \u2014 reuse it rather than
  // duplicating). Sorted before everything (min \u2212 1) so no existing category row
  // needs rewriting. Note this makes it the helper's fallbackCategory from now on.
  let plano =
    allCategories.find((c) => c.id === PLANO_DE_VIDA_CATEGORY_ID) ??
    allCategories.find((c) => normalizeName(c.name) === normalizeName(PLANO_DE_VIDA_CATEGORY_NAME))
  if (!plano) {
    plano = {
      id: PLANO_DE_VIDA_CATEGORY_ID,
      name: PLANO_DE_VIDA_CATEGORY_NAME,
      sortOrder: Math.min(...allCategories.map((c) => c.sortOrder)) - 1,
      emoji: PLANO_DE_VIDA_ICON,
      createdAt: now,
      updatedAt: now,
    }
    await categoriesTable.add(plano)
  }

  const categoryIdByName = new Map(allCategories.map((c) => [normalizeName(c.name), c.id]))
  const allPractices = (await practicesTable.toArray()) as Practice[]
  const byName = new Map<string, Practice[]>()
  for (const p of allPractices) {
    const key = normalizeName(p.name)
    const list = byName.get(key)
    if (list) list.push(p)
    else byName.set(key, [p])
  }

  // 2. Move/rename/require the 11 core practices. Matched by normalized old OR
  // new name \u2014 the original seed rows have per-device random ids, so the name is
  // the only stable key (the devices themselves converged on one snapshot long
  // ago). On multiple matches the row in the expected source category wins, so a
  // user-created practice with the same name elsewhere is left alone. A missing
  // row (user deleted/renamed it) is skipped.
  for (const move of PLANO_DE_VIDA_MOVES) {
    const candidates = [
      ...(byName.get(normalizeName(move.oldName)) ?? []),
      ...(byName.get(normalizeName(move.newName)) ?? []),
    ]
    if (candidates.length === 0) continue
    const oldCategoryId = categoryIdByName.get(normalizeName(move.oldCategoryName))
    const target =
      candidates.find((p) => p.categoryId === oldCategoryId) ??
      candidates.find((p) => p.categoryId === plano.id) ??
      candidates[0]
    if (
      target.name === move.newName &&
      target.categoryId === plano.id &&
      target.sortOrder === move.sortOrder &&
      target.isRequired
    ) {
      continue
    }
    await practicesTable.update(target.id, {
      name: move.newName,
      categoryId: plano.id,
      sortOrder: move.sortOrder,
      isRequired: true,
      updatedAt: now,
    })
  }

  // 3. Normalize the spec-inserted Plano de Vida practices (11\u201313 and the two
  // renamed specs). Usually a no-op \u2014 the helper below inserts them correctly \u2014
  // but a device that upgraded straight from v2 ran the version(3) helper BEFORE
  // this category existed, dropping them into the fallback category; this pulls
  // them into place. scheduleDays/cadence never need repair: only the spec insert
  // ever writes them, so any pre-existing row already carries them.
  for (const spec of ADDITIONAL_PRACTICES) {
    if (spec.categoryName !== PLANO_DE_VIDA_CATEGORY_NAME || spec.sortOrder === undefined) continue
    const rows = byName.get(normalizeName(spec.name)) ?? []
    const target = rows.find((p) => (spec.id ? p.id === spec.id : true))
    if (!target) continue
    if (
      target.categoryId === plano.id &&
      target.sortOrder === spec.sortOrder &&
      target.isRequired === spec.isRequired
    ) {
      continue
    }
    await practicesTable.update(target.id, {
      categoryId: plano.id,
      sortOrder: spec.sortOrder,
      isRequired: spec.isRequired,
      updatedAt: now,
    })
  }

  // 4. Insert whatever is still missing (the three new practices on the normal
  // v13 \u2192 v14 path).
  await addMissingAdditionalPractices(tx)
}

// Same one-time "migration still needs to reach the cloud" marker pattern as
// PLANO_V14_PENDING_PUSH_KEY, for the v15 Costumes migration \u2014 see that
// constant for the full rationale.
export const COSTUMES_V15_PENDING_PUSH_KEY = 'costumes-v15-pending-push'

/**
 * The v15 "Costumes" migration, idempotent for the same two call sites as
 * ensurePlanoDeVidaState: the version(15) upgrade and the post-sync
 * reconciliation. Creates the fixed-id category right after Plano de Vida,
 * moves the seeded "Tr\u00eas Ave-Marias" (per-device random id \u2014 the name is the
 * only stable cross-device key) out of Noite into it, and inserts \u00c1gua Benta.
 * Rows it actually changes get a bumped updatedAt so they win the LWW merge
 * against stale pre-migration devices.
 */
export async function ensureCostumesState(tx: TableSource): Promise<void> {
  const categoriesTable = tx.table('categories')
  const practicesTable = tx.table('practices')

  const allCategories = (await categoriesTable.toArray()) as Category[]
  if (allCategories.length === 0) return
  const now = new Date().toISOString()

  // 1. Ensure the category, directly after Plano de Vida. The fractional
  // sortOrder slips it between plano and plano's successor without rewriting
  // any other category row (the fresh seed uses plain integers instead). By
  // fixed id first, by normalized name as a fallback \u2014 reuse a hand-created
  // "Costumes" rather than duplicating it.
  let costumes =
    allCategories.find((c) => c.id === COSTUMES_CATEGORY_ID) ??
    allCategories.find((c) => normalizeName(c.name) === normalizeName(COSTUMES_CATEGORY_NAME))
  if (!costumes) {
    const plano =
      allCategories.find((c) => c.id === PLANO_DE_VIDA_CATEGORY_ID) ??
      allCategories.find(
        (c) => normalizeName(c.name) === normalizeName(PLANO_DE_VIDA_CATEGORY_NAME)
      )
    costumes = {
      id: COSTUMES_CATEGORY_ID,
      name: COSTUMES_CATEGORY_NAME,
      sortOrder: plano
        ? plano.sortOrder + 0.5
        : Math.min(...allCategories.map((c) => c.sortOrder)) - 1,
      emoji: COSTUMES_ICON,
      createdAt: now,
      updatedAt: now,
    }
    await categoriesTable.add(costumes)
  }

  // 2. Move the seeded "Tr\u00eas Ave-Marias" into it. Matched by normalized name;
  // on multiple matches the row in the original seed category (Noite) wins,
  // then one already in Costumes, so a user-created duplicate elsewhere is
  // left alone. A missing row is skipped \u2014 the spec insert below then provides
  // the fixed-id replacement.
  const allPractices = (await practicesTable.toArray()) as Practice[]
  const categoryIdByName = new Map(allCategories.map((c) => [normalizeName(c.name), c.id]))
  const candidates = allPractices.filter(
    (p) => normalizeName(p.name) === normalizeName(TRES_AVE_MARIAS_NAME)
  )
  const oldCategoryId = categoryIdByName.get(normalizeName(TRES_AVE_MARIAS_OLD_CATEGORY_NAME))
  const target =
    candidates.find((p) => p.categoryId === oldCategoryId) ??
    candidates.find((p) => p.categoryId === costumes.id) ??
    candidates[0]
  if (target && !(target.categoryId === costumes.id && target.sortOrder === 1)) {
    await practicesTable.update(target.id, {
      categoryId: costumes.id,
      sortOrder: 1,
      updatedAt: now,
    })
  }

  // 3. Normalize the fixed-id Costumes specs a pre-v15 helper run dropped into
  // the fallback category (a device upgrading straight from v2 runs version(3)
  // before this category exists \u2014 same edge as ensurePlanoDeVidaState step 3),
  // then insert whatever is still missing (\u00c1gua Benta on the normal v14 \u2192 v15
  // path).
  for (const spec of ADDITIONAL_PRACTICES) {
    if (spec.categoryName !== COSTUMES_CATEGORY_NAME || spec.sortOrder === undefined) continue
    const row = allPractices.find((p) => p.id === spec.id)
    if (!row || (row.categoryId === costumes.id && row.sortOrder === spec.sortOrder)) continue
    await practicesTable.update(row.id, {
      categoryId: costumes.id,
      sortOrder: spec.sortOrder,
      updatedAt: now,
    })
  }
  await addMissingAdditionalPractices(tx)
}

// The v17 "Liturgia do Dia" practice, removed in v18 (its reader now opens from
// "Santa Missa"). Kept only so ensureLiturgiaRemoved can find and delete the row.
const LITURGIA_PRACTICE_ID = 'liturgia-do-dia'
const LITURGIA_PRACTICE_NAME = 'Liturgia do Dia'

// Same one-time "migration still needs to reach the cloud" marker as
// PLANO_V14/COSTUMES_V15 — but for a DELETE. Crucial here: the v18 upgrade
// deletes the row locally, but the very first pull re-applies the still-present
// v17 cloud snapshot (full clear+bulkAdd) and RESURRECTS it. The reconciliation
// re-runs the delete through the live (hook-captured) db and pushes, so the
// deletion actually reaches the cloud. Cleared only after a successful push.
export const LITURGIA_V18_PENDING_PUSH_KEY = 'liturgia-v18-pending-push'

/**
 * Remove the standalone "Liturgia do Dia" practice (v17). The daily Mass
 * readings now open from "Santa Missa" (see isSantaMissaPractice + LiturgiaView).
 * Idempotent: a no-op once the row is gone. Deletes the fixed-id row (and any
 * by-name match, in case a device renamed it) together with its now-orphaned
 * dailyRecords. Runs from version(18).upgrade AND — because upgrade writes are
 * never marked dirty and a plain pull would resurrect the row — from the
 * post-sync reconciliation (see LITURGIA_V18_PENDING_PUSH_KEY).
 */
export async function ensureLiturgiaRemoved(tx: TableSource): Promise<void> {
  const practicesTable = tx.table('practices')
  const dailyRecordsTable = tx.table('dailyRecords')

  const allPractices = (await practicesTable.toArray()) as Practice[]
  const targetIds = allPractices
    .filter(
      (p) =>
        p.id === LITURGIA_PRACTICE_ID ||
        normalizeName(p.name) === normalizeName(LITURGIA_PRACTICE_NAME)
    )
    .map((p) => p.id)

  for (const id of targetIds) {
    await practicesTable.delete(id)
    await dailyRecordsTable.where('practiceId').equals(id).delete()
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

    // Add "Contemplação do Rosário" (the mysteries-not-prayed-today reader) to
    // existing installs. Same FIXED-id reasoning as v8/v9/v11: both of a user's
    // devices insert the identical row so sync converges instead of duplicating.
    // Idempotent + name-matched (see helper). No bundledTextId; it routes to its
    // own overlay reader (src/data/rosary.ts). practices is already a synced table,
    // so no sync-schema bump.
    this.version(12).stores({}).upgrade(addMissingAdditionalPractices)

    // Add "Exame particular" (the midday particular examen) to existing installs.
    // Same FIXED-id reasoning as v8/v9/v11/v12. No bundledTextId; it routes to its
    // own overlay reader (src/data/exame.ts). practices is already synced, so no
    // sync-schema bump.
    this.version(13).stores({}).upgrade(addMissingAdditionalPractices)

    // The Plano de Vida restructure: create the fixed-id category, move/rename
    // the 11 core practices into it (required, ordered 0–10), insert Mortificação
    // corporal + Antífona (Saturdays) and Confissão sacramental (weekly). All
    // writes are idempotent and tolerate rows that already arrived via a pulled
    // v14 snapshot (sync schema is NOT bumped, so a v13 device can hold one).
    // The flag makes SyncProvider re-run the body through the live db and push —
    // see PLANO_V14_PENDING_PUSH_KEY for why the upgrade alone isn't enough.
    this.version(14).stores({}).upgrade(async (tx) => {
      await ensurePlanoDeVidaState(tx)
      try {
        localStorage.setItem(PLANO_V14_PENDING_PUSH_KEY, 'true')
      } catch {
        // localStorage unavailable (private mode edge) — sync reconciliation is
        // skipped, which only matters on synced installs that also hit this.
      }
    })

    // The "Costumes" customs category (Água Benta + Três Ave-Marias): create
    // the fixed-id category next to Plano de Vida, move the seeded Três
    // Ave-Marias into it, insert Água Benta. Same sync-safety pattern as v14 —
    // idempotent body shared with the post-sync reconciliation, marker flag
    // cleared only after a successful push (see COSTUMES_V15_PENDING_PUSH_KEY).
    this.version(15).stores({}).upgrade(async (tx) => {
      await ensureCostumesState(tx)
      try {
        localStorage.setItem(COSTUMES_V15_PENDING_PUSH_KEY, 'true')
      } catch {
        // localStorage unavailable — see the v14 note above.
      }
    })

    // Add "Credo de Atanásio" (the Athanasian Creed, shown only on the third
    // Sunday of each month via monthlySchedule) to existing installs. A pure
    // fixed-id insert into the existing Costumes category — same convergence
    // reasoning as v8/v9/v11/v12/v13 (both of a user's devices insert the
    // identical row, so sync converges instead of duplicating), so unlike the
    // row-modifying v14/v15 it needs no reconciliation flag. Idempotent +
    // name-matched (see helper); it copies the monthlySchedule onto the row.
    this.version(16).stores({}).upgrade(addMissingAdditionalPractices)

    // Add "Liturgia do Dia" (the daily Mass propers reader — see LITURGY_PLAN.md)
    // to existing installs. Same FIXED-id reasoning as v8/v9/v11/v12/v13/v16: both
    // of a user's devices insert the identical row, so sync converges instead of
    // duplicating — a pure fixed-id insert into the existing Plano de Vida
    // category, so unlike the row-modifying v14/v15 it needs no reconciliation
    // flag. Idempotent + name-matched (see helper).
    this.version(17).stores({}).upgrade(addMissingAdditionalPractices)

    // Remove the standalone "Liturgia do Dia" practice (v17): the daily Mass
    // readings now open from "Santa Missa" (see isSantaMissaPractice +
    // LiturgiaView). A row DELETE, so — like the row-modifying v14/v15 and unlike
    // the pure inserts — it needs the reconciliation flag: the first pull would
    // otherwise re-apply the still-present v17 cloud snapshot and resurrect the
    // row. The flag makes SyncProvider re-run the delete through the live db and
    // push; it's cleared only after a successful push (LITURGIA_V18_PENDING_PUSH_KEY).
    this.version(18).stores({}).upgrade(async (tx) => {
      await ensureLiturgiaRemoved(tx)
      try {
        localStorage.setItem(LITURGIA_V18_PENDING_PUSH_KEY, 'true')
      } catch {
        // localStorage unavailable — see the v14 note above.
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
