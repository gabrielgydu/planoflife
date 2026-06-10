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
  // convention). Absent/empty = every day (all legacy rows). Stats and streaks
  // treat unscheduled days as NEUTRAL — never a break (e.g. the career habits'
  // Sunday-off rule). The daily checklist still shows the practice every day.
  // Read via isScheduledOn() in utils/schedule.ts.
  scheduleDays?: number[]
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

export interface CareerPlan {
  id: string // singleton row: 'career-plan'
  currentPhase: string // e.g. 'Fase 1 — Upgrade'
  focusLine: string // the one-line "what matters right now"
  phases: CareerPhase[]
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
