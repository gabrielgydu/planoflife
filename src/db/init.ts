import { migrateEmojisToIcons } from './index'
import { seedDatabase } from './seed'

/**
 * Resolves once first-run seeding + emoji→icon migration have finished. Runs once
 * at module load. Anything that mutates the whole DB (notably sync's
 * applyRemoteState) must `await dbReady` first so it can't interleave with seeding
 * and trigger a Dexie BulkError. Never rejects — a failed init is logged and
 * swallowed so sync can still proceed.
 */
export const dbReady: Promise<void> = seedDatabase()
  .then(() => migrateEmojisToIcons())
  .catch((e) => {
    console.error('DB init (seed/migrate) failed:', e)
  })
