export interface Category {
  id: string
  name: string
  sortOrder: number
  emoji: string
  createdAt: string
  updatedAt: string
}

export type PracticeDomain = 'spiritual' | 'lifestyle' | 'career'

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
  // Weekdays this practice is scheduled (0=Sun … 6=Sat, date-fns getDay
  // convention). Absent/empty = every day (all legacy rows). Off-schedule days
  // are hidden from the daily checklist and NEUTRAL in stats/streaks — never a
  // break (e.g. the Saturday-only plan-of-life practices, or the career habits'
  // Sunday-off rule). Read via isScheduledOn() in utils/schedule.ts.
  scheduleDays?: number[]
  // Completion cadence. Absent/'daily' = one check per calendar day. 'weekly' =
  // shown every day but satisfied by ANY completed record within the Monday-start
  // week of the viewed date (e.g. Confissão sacramental); neutral in per-day
  // stats. Read via isWeekly() in utils/schedule.ts.
  cadence?: 'daily' | 'weekly'
  // Calendar window during which the practice is shown at all. Absent = every
  // day (all ordinary practices). Compares month/day only, so it recurs yearly
  // (e.g. a novena that runs 17–25 June). Outside the window the practice is
  // hidden from the daily list and counts as NEUTRAL in stats — never a miss.
  // Read via isInActiveWindow() in utils/season.ts.
  activeWindow?: { startMonth: number; startDay: number; endMonth: number; endDay: number }
  // Monthly recurrence: the practice is scheduled only on the Nth occurrence of a
  // weekday each month (e.g. the Athanasian Creed on the third Sunday). `week` is
  // 1-based (1 = first); `weekday` follows date-fns getDay (0 = Sunday). Absent =
  // not a monthly practice (every ordinary row). Like scheduleDays, off-days are
  // hidden from the daily list and NEUTRAL in stats — never a miss. Read via
  // isOnMonthlySchedule() in utils/schedule.ts.
  monthlySchedule?: { week: number; weekday: number }
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

// --- Career section -----------------------------------------------------------
//
// These tables exist on every install but stay empty for everyone except devices
// whose synced snapshot carries career data (see useCareerEnabled). Ownership is
// split: plan/deadlines/wins/log rows are written by scripts/career-publish.mjs
// (from the markdown career project), moves are publish-written but checkable
// in-app, outreach/ladder are written in-app. Every row carries updatedAt so the
// sync conflict merge resolves per record (see src/sync/merge.ts).

export type CareerPhaseStatus = 'done' | 'active' | 'upcoming'

/** Roadmap entry embedded in CareerPlan — published wholesale, never edited in-app. */
export interface CareerPhase {
  name: string
  timeframe: string
  summary: string
  status: CareerPhaseStatus
}

export type CareerMilestoneStatus = 'done' | 'active' | 'upcoming'

/** Year-anchored milestone embedded in CareerPlan — published wholesale, never edited in-app. */
export interface CareerMilestone {
  id: string
  date: string // YYYY-MM — month resolution; the timeline renders at year scale
  label: string
  detail: string // '' when none
  status: CareerMilestoneStatus
  tentative: boolean // US-option milestones: a lean, not a decision — rendered dashed
}

export interface CareerPlan {
  id: string // singleton row: 'career-plan'
  currentPhase: string // e.g. 'Fase 1 — Upgrade'
  focusLine: string // the one-line "what matters right now"
  phases: CareerPhase[]
  milestones?: CareerMilestone[] // absent on rows published before the year timeline existed
  publishedAt: string // when career-publish.mjs last ran — drives the drift warning
  updatedAt: string
}

export type CareerMoveStatus = 'pending' | 'done'

/** Critical-path item (STATE.md "Next moves"). */
export interface CareerMove {
  id: string
  title: string
  detail: string
  gate: string // precondition, e.g. 'rungs 1–4 complete'; '' when none
  sortOrder: number
  status: CareerMoveStatus
  updatedAt: string
}

export interface CareerDeadline {
  id: string
  date: string // YYYY-MM-DD
  label: string
  updatedAt: string
}

/** One outreach attempt — feeds the ~20-attempt / 8-week checkpoint. */
export interface CareerOutreachAttempt {
  id: string
  date: string // YYYY-MM-DD
  channel: string // e.g. 'Direct', 'Braintrust', 'Toptal'
  target: string
  rateQuoted: string
  response: string
  notes: string
  createdAt: string
  updatedAt: string
}

export type CareerLadderStatus = 'pending' | 'in-progress' | 'done'

/** Exposure-ladder rung (1–5): mock drill → … → Tier-1 outreach. */
export interface CareerLadderRung {
  id: string
  rung: number
  title: string
  description: string
  status: CareerLadderStatus
  notes: string
  updatedAt: string
}

export interface CareerWin {
  id: string
  date: string // YYYY-MM-DD
  text: string
  updatedAt: string
}

export interface CareerLogEntry {
  id: string
  date: string // YYYY-MM-DD
  title: string
  summary: string
  updatedAt: string
}

// --- Meditação ----------------------------------------------------------------
//
// One drawn Escrivá point per day PER SLOT — there are two daily meditations
// (morning "Meditação" and afternoon "Meditação da Tarde"), each drawing its own
// point (see src/data/meditation.ts). The `id` is meditationDayKey(date, slot):
// the BARE date (YYYY-MM-DD) for the morning slot (backward-compatible with rows
// drawn before the afternoon slot existed) and `date:tarde` for the afternoon —
// so up to two rows per day. Never parse the id back into a Date; it's an opaque
// key. Merges by id like every other synced table. The drawn number is shown
// across all three books (Caminho/Sulco/Forja). Synced (schema 3).
export interface MeditationDay {
  id: string // meditationDayKey(date, slot): bare 'YYYY-MM-DD' (morning) or 'YYYY-MM-DD:tarde'
  pointNumber: number // 1–1055, the drawn Escrivá point number
  source: 'random.org' | 'crypto' // where the number came from
  updatedAt: string // bumped on draw + reroll; drives the sync conflict merge
}
