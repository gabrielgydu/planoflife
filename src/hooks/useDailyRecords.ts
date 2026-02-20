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

    if (existing) {
      await db.dailyRecords.update(recordId, {
        isCompleted: !existing.isCompleted,
        completedAt: existing.isCompleted ? null : new Date().toISOString(),
      })
    } else {
      const record: DailyRecord = {
        id: recordId,
        date,
        practiceId,
        isCompleted: true,
        completedAt: new Date().toISOString(),
      }
      await db.dailyRecords.add(record)
    }
  }

  async function clearAllForDate() {
    await db.dailyRecords.where('date').equals(date).modify({ isCompleted: false, completedAt: null })
  }

  function isCompleted(practiceId: string): boolean {
    return recordsMap.get(practiceId)?.isCompleted ?? false
  }

  return {
    records: records ?? [],
    recordsMap,
    isLoading: records === undefined,
    togglePractice,
    clearAllForDate,
    isCompleted,
  }
}
