import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db'
import type { ExamenEntry, ExamenCategory } from '../types'
import { generateId } from '../utils/id'

export function useExamenEntries(date: string) {
  const entries = useLiveQuery(() => db.examenEntries.where('date').equals(date).toArray(), [date])

  const entriesByCategory = {
    gracias: entries?.filter((e) => e.category === 'gracias') ?? [],
    perdon: entries?.filter((e) => e.category === 'perdon') ?? [],
    ayudame: entries?.filter((e) => e.category === 'ayudame') ?? [],
  }

  async function addEntry(category: ExamenCategory, text: string, isForConfession = false) {
    const now = new Date().toISOString()
    const entry: ExamenEntry = {
      id: generateId(),
      date,
      text,
      category,
      isForConfession,
      confessionDate: null,
      createdAt: now,
      updatedAt: now,
    }
    await db.examenEntries.add(entry)
    return entry
  }

  async function updateEntry(
    id: string,
    data: Partial<Pick<ExamenEntry, 'text' | 'isForConfession'>>
  ) {
    await db.examenEntries.update(id, { ...data, updatedAt: new Date().toISOString() })
  }

  async function deleteEntry(id: string) {
    await db.examenEntries.delete(id)
  }

  async function toggleConfession(id: string) {
    const entry = await db.examenEntries.get(id)
    if (!entry) return
    await db.examenEntries.update(id, {
      isForConfession: !entry.isForConfession,
      updatedAt: new Date().toISOString(),
    })
  }

  return {
    entries: entries ?? [],
    entriesByCategory,
    isLoading: entries === undefined,
    addEntry,
    updateEntry,
    deleteEntry,
    toggleConfession,
  }
}

export function useUnconfessedEntries() {
  const entries = useLiveQuery(() =>
    db.examenEntries
      .filter((e) => e.isForConfession && e.confessionDate === null)
      .toArray()
  )

  async function markAsConfessed(ids: string[], confessionDate: string) {
    await db.transaction('rw', db.examenEntries, async () => {
      for (const id of ids) {
        await db.examenEntries.update(id, {
          confessionDate,
          updatedAt: new Date().toISOString(),
        })
      }
    })
  }

  const entriesByDate = new Map<string, ExamenEntry[]>()
  for (const entry of entries ?? []) {
    const dateEntries = entriesByDate.get(entry.date) ?? []
    dateEntries.push(entry)
    entriesByDate.set(entry.date, dateEntries)
  }

  return {
    entries: entries ?? [],
    entriesByDate,
    isLoading: entries === undefined,
    markAsConfessed,
  }
}
