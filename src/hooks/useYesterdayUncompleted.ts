import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db'
import { isInActiveWindow } from '../utils/season'
import { isScheduledOn, isWeekly } from '../utils/schedule'
import type { Practice } from '../types'

export function useYesterdayUncompleted(date: string) {
  const result = useLiveQuery(async () => {
    // The reviewed day, for windowed practices (e.g. a novena only shows on its
    // dates — mirror the daily list so it isn't flagged as "missed" off-window).
    const reviewedDate = new Date(`${date}T00:00:00`)
    // Mirror the daily list view ordering: categories by sortOrder, then
    // practices by sortOrder within each category.
    const [categories, allPractices, records] = await Promise.all([
      db.categories.orderBy('sortOrder').toArray(),
      db.practices.orderBy('sortOrder').toArray(),
      db.dailyRecords.where('date').equals(date).toArray(),
    ])

    const completedIds = new Set(records.filter((r) => r.isCompleted).map((r) => r.practiceId))

    const byCategory = new Map<string, Practice[]>()
    for (const category of categories) byCategory.set(category.id, [])
    for (const practice of allPractices) {
      if (practice.isArchived) continue
      if (!isInActiveWindow(practice, reviewedDate)) continue
      // Off-schedule days and weekly practices aren't "uncompleted" for a single
      // day — mirror the daily list and the missed-reasons filter.
      if (!isScheduledOn(practice, reviewedDate)) continue
      if (isWeekly(practice)) continue
      byCategory.get(practice.categoryId)?.push(practice)
    }

    const ordered: Practice[] = []
    for (const category of categories) {
      for (const practice of byCategory.get(category.id) ?? []) {
        if (!completedIds.has(practice.id)) ordered.push(practice)
      }
    }
    return ordered
  }, [date])

  return {
    uncompleted: (result ?? []) as Practice[],
    isLoading: result === undefined,
  }
}
