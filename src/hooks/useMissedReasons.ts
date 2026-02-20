import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db'
import type { MissedReason } from '../types'
import { generateId } from '../utils/id'

export function useMissedReasons(date: string) {
  const reasons = useLiveQuery(
    () => db.missedReasons.where('date').equals(date).toArray(),
    [date]
  )

  const reasonsMap = new Map<string, MissedReason>()
  for (const reason of reasons ?? []) {
    reasonsMap.set(reason.practiceId, reason)
  }

  async function addReason(practiceId: string, reasonText: string) {
    const existing = await db.missedReasons
      .where('[date+practiceId]')
      .equals([date, practiceId])
      .first()

    if (existing) {
      await db.missedReasons.update(existing.id, { reasonText })
    } else {
      const reason: MissedReason = {
        id: generateId(),
        date,
        practiceId,
        reasonText,
        createdAt: new Date().toISOString(),
      }
      await db.missedReasons.add(reason)
    }
  }

  function hasReason(practiceId: string): boolean {
    return reasonsMap.has(practiceId)
  }

  function getReason(practiceId: string): string | undefined {
    return reasonsMap.get(practiceId)?.reasonText
  }

  return {
    reasons: reasons ?? [],
    reasonsMap,
    isLoading: reasons === undefined,
    addReason,
    hasReason,
    getReason,
  }
}

export function useMissedRequiredPractices(date: string) {
  const result = useLiveQuery(async () => {
    const requiredPractices = await db.practices
      .filter((p) => p.isRequired && !p.isArchived)
      .toArray()

    const records = await db.dailyRecords.where('date').equals(date).toArray()
    const completedIds = new Set(records.filter((r) => r.isCompleted).map((r) => r.practiceId))

    const reasons = await db.missedReasons.where('date').equals(date).toArray()
    const reasonIds = new Set(reasons.map((r) => r.practiceId))

    const missedWithoutReason = requiredPractices.filter(
      (p) => !completedIds.has(p.id) && !reasonIds.has(p.id)
    )

    return missedWithoutReason
  }, [date])

  return {
    missedPractices: result ?? [],
    isLoading: result === undefined,
  }
}
