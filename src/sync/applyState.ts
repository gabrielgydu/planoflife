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
]

/** Tables that are NEVER seeded — non-empty here means real user data exists. */
export async function hasUserData(): Promise<boolean> {
  const [records, examen, missed, props] = await Promise.all([
    db.dailyRecords.count(),
    db.examenEntries.count(),
    db.missedReasons.count(),
    db.propositos.count(),
  ])
  return records + examen + missed + props > 0
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
  ] = await Promise.all([
    db.categories.toArray(),
    db.practices.toArray(),
    db.dailyRecords.toArray(),
    db.missedReasons.toArray(),
    db.examenEntries.toArray(),
    db.guidingQuestions.toArray(),
    db.propositos.toArray(),
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
    },
    settings: collectSettings(),
  }
}

/** Clear + repopulate all tables from a state. Must run inside an rw transaction. */
async function clearAndBulkAdd(state: SyncState): Promise<void> {
  await Promise.all(ALL_TABLES.map((t) => t.clear()))
  await Promise.all([
    db.categories.bulkAdd(state.data.categories),
    db.practices.bulkAdd(state.data.practices),
    db.dailyRecords.bulkAdd(state.data.dailyRecords),
    db.missedReasons.bulkAdd(state.data.missedReasons),
    db.examenEntries.bulkAdd(state.data.examenEntries),
    db.guidingQuestions.bulkAdd(state.data.guidingQuestions),
    db.propositos.bulkAdd(state.data.propositos),
  ])
}

/**
 * Replace the entire local DB with a pulled snapshot, then apply its settings.
 * Full clear+bulkAdd in one transaction = snapshot semantics (handles deletes).
 * Dexie live queries refresh the UI automatically; settings changes fire an event.
 */
export async function applyRemoteState(
  state: SyncState
): Promise<{ settingsChanged: boolean }> {
  // Ensure first-run seeding/migration is done before we clear+repopulate,
  // otherwise the two can interleave into a Dexie BulkError.
  await dbReady
  // Suppress mutation capture for the whole apply: these writes come FROM a pull,
  // so they must not schedule a push (which would echo straight back to the cloud).
  return runWithApplyingRemote(async () => {
    await db.transaction('rw', ALL_TABLES, () => clearAndBulkAdd(state))
    const settingsChanged = applySettings(state.settings)
    return { settingsChanged }
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
