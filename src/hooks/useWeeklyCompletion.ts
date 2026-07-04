import { useCallback, useMemo } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { startOfWeek, endOfWeek } from 'date-fns'
import { db } from '../db'
import { formatDate, parseDate } from '../utils/dates'

// Weekly-cadence completion (e.g. Confissão sacramental): a practice counts as
// done for the whole Monday-start week containing the viewed date once ANY of
// that week's dailyRecords is completed. Storage stays per-day records — this
// hook only widens the read (and the uncheck) to the week.
export function useWeeklyCompletions(dateStr: string) {
  const { weekStartStr, weekEndStr } = useMemo(() => {
    const d = parseDate(dateStr)
    return {
      weekStartStr: formatDate(startOfWeek(d, { weekStartsOn: 1 })),
      weekEndStr: formatDate(endOfWeek(d, { weekStartsOn: 1 })),
    }
  }, [dateStr])

  const records = useLiveQuery(
    () => db.dailyRecords.where('date').between(weekStartStr, weekEndStr, true, true).toArray(),
    [weekStartStr, weekEndStr]
  )

  const completedIdsInWeek = useMemo(() => {
    const ids = new Set<string>()
    for (const r of records ?? []) {
      if (r.isCompleted) ids.add(r.practiceId)
    }
    return ids
  }, [records])

  // Unchecking a weekly practice must clear EVERY completed record of its week,
  // or the earlier record would keep it rendered as done. Row-wise modify bumps
  // updatedAt so each clear syncs like a normal uncheck.
  const clearWeek = useCallback(
    async (practiceId: string) => {
      const now = new Date().toISOString()
      await db.dailyRecords
        .where('date')
        .between(weekStartStr, weekEndStr, true, true)
        .filter((r) => r.practiceId === practiceId && r.isCompleted)
        .modify({ isCompleted: false, completedAt: null, updatedAt: now })
    },
    [weekStartStr, weekEndStr]
  )

  return { completedIdsInWeek, clearWeek, isLoading: records === undefined }
}
