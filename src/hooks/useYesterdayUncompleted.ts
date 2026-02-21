import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db'
import type { Practice } from '../types'

export function useYesterdayUncompleted(date: string) {
  const result = useLiveQuery(async () => {
    const allPractices = await db.practices
      .filter((p) => !p.isArchived)
      .toArray()

    const records = await db.dailyRecords.where('date').equals(date).toArray()
    const completedIds = new Set(records.filter((r) => r.isCompleted).map((r) => r.practiceId))

    return allPractices.filter((p) => !completedIds.has(p.id))
  }, [date])

  return {
    uncompleted: (result ?? []) as Practice[],
    isLoading: result === undefined,
  }
}
