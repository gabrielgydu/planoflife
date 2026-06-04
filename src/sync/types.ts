import type {
  Category,
  Practice,
  DailyRecord,
  MissedReason,
  ExamenEntry,
  GuidingQuestion,
  Proposito,
} from '../types'

export const SYNC_SCHEMA = 1

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
] as const
