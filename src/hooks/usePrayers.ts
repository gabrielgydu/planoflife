import { useMemo } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db'
import { sectionIndex, USER_SECTION_SLUG } from '../data/devocionario'
import { generateId } from '../utils/id'
import type { Prayer } from '../types'

/** Reading order: section order first, then the prayer's place inside its section. */
export function comparePrayers(a: Prayer, b: Prayer): number {
  const bySection = sectionIndex(a.section) - sectionIndex(b.section)
  return bySection !== 0 ? bySection : a.sortOrder - b.sortOrder
}

export type NewPrayerInput = Pick<Prayer, 'title' | 'texts'>

/**
 * The Devocionário. Backed by db.prayers, so favorites, edits, reorders and the
 * user's own prayers all sync like any other row.
 */
export function usePrayers() {
  const rows = useLiveQuery(() => db.prayers.toArray())

  const prayers = useMemo(() => [...(rows ?? [])].sort(comparePrayers), [rows])

  async function addPrayer(data: NewPrayerInput): Promise<Prayer> {
    const now = new Date().toISOString()
    const maxOrder = (await db.prayers.toArray())
      .filter((p) => p.section === USER_SECTION_SLUG)
      .reduce((m, p) => Math.max(m, p.sortOrder), -1)
    const prayer: Prayer = {
      id: generateId(),
      section: USER_SECTION_SLUG,
      title: data.title,
      texts: data.texts,
      source: 'user',
      isFavorite: false,
      sortOrder: maxOrder + 1,
      createdAt: now,
      updatedAt: now,
    }
    await db.prayers.add(prayer)
    return prayer
  }

  async function updatePrayer(id: string, data: Partial<Omit<Prayer, 'id' | 'createdAt'>>) {
    await db.prayers.update(id, { ...data, updatedAt: new Date().toISOString() })
  }

  async function toggleFavorite(id: string) {
    const prayer = await db.prayers.get(id)
    if (!prayer) return
    await db.prayers.update(id, {
      isFavorite: !prayer.isFavorite,
      updatedAt: new Date().toISOString(),
    })
  }

  /**
   * Delete a prayer and, with it, any practice that was tracking it — otherwise
   * the daily checklist would keep a row whose text no longer exists. The practice
   * cleanup mirrors deletePractice() in usePractices (records + missed reasons).
   */
  async function deletePrayer(id: string) {
    await db.transaction(
      'rw',
      db.prayers,
      db.practices,
      db.dailyRecords,
      db.missedReasons,
      async () => {
        const linked = await db.practices.filter((p) => p.prayerId === id).toArray()
        for (const practice of linked) {
          await db.dailyRecords.where('practiceId').equals(practice.id).delete()
          await db.missedReasons.where('practiceId').equals(practice.id).delete()
          await db.practices.delete(practice.id)
        }
        await db.prayers.delete(id)
      }
    )
  }

  /** Renumber one section to 0..n-1 in the given order. */
  async function reorderSection(orderedIds: string[]) {
    const now = new Date().toISOString()
    await db.transaction('rw', db.prayers, async () => {
      await Promise.all(
        orderedIds.map((id, index) => db.prayers.update(id, { sortOrder: index, updatedAt: now }))
      )
    })
  }

  return {
    prayers,
    isLoading: rows === undefined,
    addPrayer,
    updatePrayer,
    deletePrayer,
    toggleFavorite,
    reorderSection,
  }
}

/** A single prayer, live. `undefined` while loading, `null` when it doesn't exist. */
export function usePrayer(id: string | undefined) {
  const rows = useLiveQuery(
    async (): Promise<Prayer[]> => (id ? db.prayers.where('id').equals(id).toArray() : []),
    [id]
  )
  if (rows === undefined) return undefined
  return rows[0] ?? null
}
