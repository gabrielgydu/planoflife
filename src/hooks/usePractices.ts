import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db'
import type { Practice } from '../types'
import { generateId } from '../utils/id'

export function usePractices(options?: { includeArchived?: boolean }) {
  const includeArchived = options?.includeArchived ?? false

  const practices = useLiveQuery(async () => {
    const all = await db.practices.orderBy('sortOrder').toArray()
    if (!includeArchived) {
      return all.filter((p) => !p.isArchived)
    }
    return all
  }, [includeArchived])

  async function addPractice(
    data: Omit<Practice, 'id' | 'sortOrder' | 'isArchived' | 'createdAt' | 'updatedAt'>
  ) {
    const now = new Date().toISOString()
    const maxOrder =
      (await db.practices.where('categoryId').equals(data.categoryId).sortBy('sortOrder')).pop()
        ?.sortOrder ?? -1
    const practice: Practice = {
      id: generateId(),
      sortOrder: maxOrder + 1,
      isArchived: false,
      createdAt: now,
      updatedAt: now,
      ...data,
    }
    await db.practices.add(practice)
    return practice
  }

  async function updatePractice(id: string, data: Partial<Omit<Practice, 'id' | 'createdAt'>>) {
    await db.practices.update(id, { ...data, updatedAt: new Date().toISOString() })
  }

  async function deletePractice(id: string) {
    await db.transaction('rw', db.practices, db.dailyRecords, db.missedReasons, async () => {
      await db.dailyRecords.where('practiceId').equals(id).delete()
      await db.missedReasons.where('practiceId').equals(id).delete()
      await db.practices.delete(id)
    })
  }

  async function archivePractice(id: string) {
    await db.practices.update(id, { isArchived: true, updatedAt: new Date().toISOString() })
  }

  async function unarchivePractice(id: string) {
    await db.practices.update(id, { isArchived: false, updatedAt: new Date().toISOString() })
  }

  async function reorderPractices(_categoryId: string, orderedIds: string[]) {
    await db.transaction('rw', db.practices, async () => {
      const updates = orderedIds.map((id, index) => db.practices.update(id, { sortOrder: index }))
      await Promise.all(updates)
    })
  }

  return {
    practices: practices ?? [],
    isLoading: practices === undefined,
    addPractice,
    updatePractice,
    deletePractice,
    archivePractice,
    unarchivePractice,
    reorderPractices,
  }
}

export function usePracticesByCategory(categoryId: string) {
  const practices = useLiveQuery(
    () =>
      db.practices
        .where('categoryId')
        .equals(categoryId)
        .and((p) => !p.isArchived)
        .sortBy('sortOrder'),
    [categoryId]
  )

  return practices ?? []
}
