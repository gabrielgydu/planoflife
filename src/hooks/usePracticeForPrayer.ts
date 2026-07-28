import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db'
import type { Practice } from '../types'

/**
 * The non-archived practice that tracks this prayer, if any. `prayerId` carries no
 * Dexie index — there is at most a handful of prayer-linked practices among a few
 * dozen rows, so a filtered scan is cheaper than another index to migrate.
 *
 * `undefined` while loading, `null` when the prayer isn't tracked.
 */
export function usePracticeForPrayer(prayerId: string | undefined): Practice | null | undefined {
  const rows = useLiveQuery(
    async (): Promise<Practice[]> =>
      prayerId ? db.practices.filter((p) => p.prayerId === prayerId && !p.isArchived).toArray() : [],
    [prayerId]
  )
  if (rows === undefined) return undefined
  return rows[0] ?? null
}
