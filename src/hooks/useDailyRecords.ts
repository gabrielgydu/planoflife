import { useCallback } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db'
import type { DailyRecord } from '../types'

export function useDailyRecords(date: string) {
  const records = useLiveQuery(() => db.dailyRecords.where('date').equals(date).toArray(), [date])

  const recordsMap = new Map<string, DailyRecord>()
  for (const record of records ?? []) {
    recordsMap.set(record.practiceId, record)
  }

  async function togglePractice(practiceId: string) {
    const recordId = `${date}|${practiceId}`
    const existing = await db.dailyRecords.get(recordId)

    const now = new Date().toISOString()
    if (existing) {
      await db.dailyRecords.update(recordId, {
        isCompleted: !existing.isCompleted,
        completedAt: existing.isCompleted ? null : now,
        updatedAt: now,
      })
    } else {
      const record: DailyRecord = {
        id: recordId,
        date,
        practiceId,
        isCompleted: true,
        completedAt: now,
        updatedAt: now,
      }
      await db.dailyRecords.add(record)
    }
  }

  // Mark a practice as done without ever un-marking it (used by auto-mark on
  // view). Memoized so it's safe as an effect dependency. No-op if already done.
  const markCompleted = useCallback(
    async (practiceId: string) => {
      const recordId = `${date}|${practiceId}`
      const existing = await db.dailyRecords.get(recordId)
      const now = new Date().toISOString()
      if (existing) {
        if (!existing.isCompleted) {
          await db.dailyRecords.update(recordId, {
            isCompleted: true,
            completedAt: now,
            updatedAt: now,
          })
        }
      } else {
        await db.dailyRecords.add({
          id: recordId,
          date,
          practiceId,
          isCompleted: true,
          completedAt: now,
          updatedAt: now,
        })
      }
    },
    [date],
  )

  async function clearAllForDate() {
    await db.dailyRecords
      .where('date')
      .equals(date)
      .modify({ isCompleted: false, completedAt: null, updatedAt: new Date().toISOString() })
  }

  function isCompleted(practiceId: string): boolean {
    return recordsMap.get(practiceId)?.isCompleted ?? false
  }

  return {
    records: records ?? [],
    recordsMap,
    isLoading: records === undefined,
    togglePractice,
    markCompleted,
    clearAllForDate,
    isCompleted,
  }
}
