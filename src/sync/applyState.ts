import { db } from '../db'
import { dbReady } from '../db/init'
import { collectSettings, applySettings } from './settingsBus'
import { runWithApplyingRemote } from './mutationCapture'
import { mergeStates } from './merge'
import { SYNC_SCHEMA, type SyncState } from './types'

const ALL_TABLES = [
  db.categories,
  db.practices,
  db.dailyRecords,
  db.missedReasons,
  db.examenEntries,
  db.guidingQuestions,
  db.propositos,
  db.careerPlan,
  db.careerMoves,
  db.careerDeadlines,
  db.careerOutreach,
  db.careerLadder,
  db.careerWins,
  db.careerLog,
]

/** Tables that are NEVER seeded — non-empty here means real user data exists. */
export async function hasUserData(): Promise<boolean> {
  const [records, examen, missed, props, outreach] = await Promise.all([
    db.dailyRecords.count(),
    db.examenEntries.count(),
    db.missedReasons.count(),
    db.propositos.count(),
    db.careerOutreach.count(),
  ])
  return records + examen + missed + props + outreach > 0
}

/** Build a SyncState from the current local DB + synced settings. */
export async function snapshotLocal(): Promise<SyncState> {
  const [
    categories,
    practices,
    dailyRecords,
    missedReasons,
    examenEntries,
    guidingQuestions,
    propositos,
    careerPlan,
    careerMoves,
    careerDeadlines,
    careerOutreach,
    careerLadder,
    careerWins,
    careerLog,
  ] = await Promise.all([
    db.categories.toArray(),
    db.practices.toArray(),
    db.dailyRecords.toArray(),
    db.missedReasons.toArray(),
    db.examenEntries.toArray(),
    db.guidingQuestions.toArray(),
    db.propositos.toArray(),
    db.careerPlan.toArray(),
    db.careerMoves.toArray(),
    db.careerDeadlines.toArray(),
    db.careerOutreach.toArray(),
    db.careerLadder.toArray(),
    db.careerWins.toArray(),
    db.careerLog.toArray(),
  ])
  return {
    schema: SYNC_SCHEMA,
    data: {
      categories,
      practices,
      dailyRecords,
      missedReasons,
      examenEntries,
      guidingQuestions,
      propositos,
      careerPlan,
      careerMoves,
      careerDeadlines,
      careerOutreach,
      careerLadder,
      careerWins,
      careerLog,
    },
    settings: collectSettings(),
  }
}

/**
 * Clear + repopulate all tables from a state. Must run inside an rw transaction.
 *
 * A table key MISSING from the snapshot (undefined, not `[]`) means it was
 * produced by an older app that doesn't know that table — old clients strip
 * unknown tables on push because snapshotLocal only reads their own list. For
 * those tables, preserve the local rows instead of clearing.
 *
 * Returns true when any preserved table actually held rows: the caller must
 * then schedule a push so the preserved rows re-enter the cloud — otherwise the
 * cloud stays stripped until an organic edit, and another schema-2 client
 * (whose snapshot has the key PRESENT as an empty array) could cement the loss.
 */
async function clearAndBulkAdd(state: SyncState): Promise<boolean> {
  const d = state.data
  let preserved = false
  const replace = async <T>(
    table: { clear(): Promise<void>; bulkAdd(rows: T[]): unknown; count(): Promise<number> },
    rows: T[] | undefined
  ) => {
    if (rows) {
      await table.clear()
      await table.bulkAdd(rows)
    } else if ((await table.count()) > 0) {
      preserved = true
    }
  }
  await Promise.all([
    replace(db.categories, d.categories),
    replace(db.practices, d.practices),
    replace(db.dailyRecords, d.dailyRecords),
    replace(db.missedReasons, d.missedReasons),
    replace(db.examenEntries, d.examenEntries),
    replace(db.guidingQuestions, d.guidingQuestions),
    replace(db.propositos, d.propositos),
    replace(db.careerPlan, d.careerPlan),
    replace(db.careerMoves, d.careerMoves),
    replace(db.careerDeadlines, d.careerDeadlines),
    replace(db.careerOutreach, d.careerOutreach),
    replace(db.careerLadder, d.careerLadder),
    replace(db.careerWins, d.careerWins),
    replace(db.careerLog, d.careerLog),
  ])
  return preserved
}

/**
 * Replace the entire local DB with a pulled snapshot, then apply its settings.
 * Full clear+bulkAdd in one transaction = snapshot semantics (handles deletes).
 * Dexie live queries refresh the UI automatically; settings changes fire an event.
 */
export async function applyRemoteState(
  state: SyncState
): Promise<{ settingsChanged: boolean; preservedLocalRows: boolean }> {
  // Ensure first-run seeding/migration is done before we clear+repopulate,
  // otherwise the two can interleave into a Dexie BulkError.
  await dbReady
  // Suppress mutation capture for the whole apply: these writes come FROM a pull,
  // so they must not schedule a push (which would echo straight back to the cloud).
  return runWithApplyingRemote(async () => {
    let preservedLocalRows = false
    await db.transaction('rw', ALL_TABLES, async () => {
      preservedLocalRows = await clearAndBulkAdd(state)
    })
    const settingsChanged = applySettings(state.settings)
    return { settingsChanged, preservedLocalRows }
  })
}

/**
 * Conflict-safe merge. In ONE transaction: read the current local DB, merge it
 * with the remote snapshot, and rewrite the tables. Doing the read and the write
 * in the same transaction means a concurrent local write can't be lost in the
 * gap — it queues behind this transaction and re-marks the state dirty afterwards
 * (mutation capture is suppressed only for our own merge writes). Returns the
 * merged state so the caller can push it.
 */
export async function mergeRemoteIntoLocal(
  remoteState: SyncState,
  oursSettingKeys?: Iterable<string>
): Promise<SyncState> {
  await dbReady
  return runWithApplyingRemote(async () => {
    let merged: SyncState | undefined
    await db.transaction('rw', ALL_TABLES, async () => {
      const local = await snapshotLocal() // reads join this transaction
      merged = mergeStates(remoteState, local, oursSettingKeys)
      await clearAndBulkAdd(merged)
    })
    applySettings(merged!.settings)
    return merged!
  })
}
