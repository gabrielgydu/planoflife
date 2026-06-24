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

// Bump whenever SyncState gains tables. v2 = career tables (Dexie v7).
// v3 = meditationDays (Dexie v10).
export const SYNC_SCHEMA = 3

/** The decrypted payload that travels to/from the Worker (mirrors scripts/sync-core.mjs). */
export interface SyncState {
  schema: number
  data: {
    categories: Category[]
    practices: Practice[]
    dailyRecords: DailyRecord[]
    missedReasons: MissedReason[]
    examenEntries: ExamenEntry[]
    guidingQuestions: GuidingQuestion[]
    propositos: Proposito[]
    // Career tables (schema 2). Snapshots produced by schema-1 clients lack these
    // keys entirely — consumers must treat a MISSING array as "older client, no
    // opinion" (preserve local rows), never as an empty table. See applyState.ts.
    careerPlan: CareerPlan[]
    careerMoves: CareerMove[]
    careerDeadlines: CareerDeadline[]
    careerOutreach: CareerOutreachAttempt[]
    careerLadder: CareerLadderRung[]
    careerWins: CareerWin[]
    careerLog: CareerLogEntry[]
    // Meditação (schema 3). Like the career tables above, a snapshot pushed by a
    // schema-≤2 client lacks this key entirely — consumers must treat a MISSING
    // array as "older client, no opinion" (preserve local rows), never as an
    // empty table. See applyState.ts and merge.ts (`?? []`).
    meditationDays: MeditationDay[]
  }
  settings: Record<string, string>
}

/** What GET /state returns. */
export interface RemoteState {
  version: number
  blob: string | null
  salt: string | null
}

export type SyncStatus =
  | 'unconfigured' // no worker URL set
  | 'locked' // configured but no key in this device
  | 'idle' // unlocked, in sync
  | 'syncing'
  | 'offline' // network error on last attempt
  | 'error'

export const SYNC_TABLES = [
  'categories',
  'practices',
  'dailyRecords',
  'missedReasons',
  'examenEntries',
  'guidingQuestions',
  'propositos',
  'careerPlan',
  'careerMoves',
  'careerDeadlines',
  'careerOutreach',
  'careerLadder',
  'careerWins',
  'careerLog',
  'meditationDays',
] as const

/** Cloud snapshot was produced by a NEWER app than this one. */
export class SyncSchemaError extends Error {
  constructor(remoteSchema: number) {
    super(`Snapshot schema v${remoteSchema} is newer than this app (v${SYNC_SCHEMA}).`)
    this.name = 'SyncSchemaError'
  }
}

/**
 * Guard every decrypted remote snapshot before it is applied or merged. A client
 * older than the snapshot would silently strip the tables it doesn't know on its
 * next push (snapshotLocal only reads its own table list) — refusing to sync
 * until the app updates is the only safe answer. Pre-guard clients (≤ schema 1)
 * can't be protected retroactively; see the deploy runbook.
 */
export function assertKnownSchema(state: SyncState): SyncState {
  if (typeof state.schema === 'number' && state.schema > SYNC_SCHEMA) {
    throw new SyncSchemaError(state.schema)
  }
  return state
}
