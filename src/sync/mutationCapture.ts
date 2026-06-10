// Phase 4 auto-push: capture local writes so the app pushes its own edits.
//
// There is no single write choke-point — hooks call db.<table>.add/update/delete
// directly — so we install Dexie hooks on every synced table. Any add/update/delete
// calls markDirty(), which asks the SyncProvider (via a registered handler) to
// schedule a debounced encrypted push.
//
// Echo guard: applyRemoteState() runs its clear+bulkAdd inside
// runWithApplyingRemote(), during which markDirty() is a no-op — so pulling a
// remote snapshot can never bounce back out as a push.

import { db } from '../db'

let applyingRemote = false

/** Run a remote-snapshot apply with local-write capture suppressed. */
export async function runWithApplyingRemote<T>(fn: () => Promise<T>): Promise<T> {
  applyingRemote = true
  try {
    return await fn()
  } finally {
    applyingRemote = false
  }
}

let dirtyHandler: (() => void) | null = null

/** SyncProvider registers (and, on disconnect, clears) the push scheduler. */
export function setDirtyHandler(handler: (() => void) | null): void {
  dirtyHandler = handler
}

/** A local write happened — schedule a push, unless we're applying a pull. */
export function markDirty(): void {
  if (applyingRemote) return
  try {
    dirtyHandler?.()
  } catch (e) {
    // A throw inside a Dexie hook would abort the write that triggered us.
    // The push scheduler must never break a DB write — swallow and log.
    console.error('sync: dirty handler failed', e)
  }
}

let installed = false

/** Idempotent: register creating/updating/deleting hooks on every synced table. */
export function installMutationCapture(): void {
  if (installed) return
  installed = true
  const tables = [
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
  for (const t of tables) {
    t.hook('creating', () => {
      markDirty()
    })
    t.hook('updating', () => {
      markDirty()
    })
    t.hook('deleting', () => {
      markDirty()
    })
  }
}

// Install at module load. This module is pulled in by applyState (and thus by
// SyncProvider) before any user interaction can write to the DB. Seed/migrate
// writes still fire these hooks, but markDirty() no-ops because no handler is
// registered until the user has unlocked sync.
installMutationCapture()
