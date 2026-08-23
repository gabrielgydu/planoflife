import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db'
import { NOVENA_TRABALHO_BUNDLED_ID, novenaCatchUpCandidates } from '../data/novena'
import { formatDate, getToday, getTodayStr } from '../utils/dates'
import type { Practice } from '../types'

export interface NovenaCatchUpDay {
  date: Date
  dateStr: string
  dayIndex: number
  completed: boolean
}

/**
 * The past days of the current novena run and whether each was prayed, feeding
 * the catch-up rows in today's list (see novenaCatchUpCandidates). `practice`
 * is the novena row when one exists; `days` is empty when disabled (viewing a
 * day other than today) or when no run is current. Completion state is read per
 * MISSED date — checking a catch-up row writes to that day's record, not
 * today's, so history stays truthful about which day was prayed.
 */
export function useNovenaCatchUp(
  practices: Practice[],
  novenaStart: string | null,
  enabled: boolean
): { practice: Practice | null; days: NovenaCatchUpDay[] } {
  const practice = practices.find((p) => p.bundledTextId === NOVENA_TRABALHO_BUNDLED_ID) ?? null
  const practiceId = practice?.id

  const days = useLiveQuery(
    async () => {
      if (!enabled || !practiceId) return []
      const candidates = novenaCatchUpCandidates(getToday(), novenaStart).map((c) => ({
        ...c,
        dateStr: formatDate(c.date),
      }))
      if (candidates.length === 0) return []
      const records = await db.dailyRecords.bulkGet(
        candidates.map((c) => `${c.dateStr}|${practiceId}`)
      )
      return candidates.map((c, i) => ({ ...c, completed: records[i]?.isCompleted ?? false }))
    },
    // getTodayStr in the key so crossing midnight recomputes on the next render.
    [enabled, practiceId, novenaStart, getTodayStr()]
  )

  return { practice, days: days ?? [] }
}
