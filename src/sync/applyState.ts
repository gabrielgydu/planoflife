import { db } from '../db'
import { dbReady } from '../db/init'
import { collectSettings, applySettings } from './settingsBus'
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
  await db.transaction('rw', ALL_TABLES, async () => {
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
  })
  const settingsChanged = applySettings(state.settings)
  return { settingsChanged }
}
