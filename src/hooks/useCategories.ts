import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db'
import type { Category } from '../types'
import { generateId } from '../utils/id'

export function useCategories() {
  const categories = useLiveQuery(() => db.categories.orderBy('sortOrder').toArray())

  async function addCategory(data: Omit<Category, 'id' | 'sortOrder' | 'createdAt' | 'updatedAt'>) {
    const now = new Date().toISOString()
    const maxOrder = (await db.categories.orderBy('sortOrder').last())?.sortOrder ?? -1
    const category: Category = {
      id: generateId(),
      sortOrder: maxOrder + 1,
      createdAt: now,
      updatedAt: now,
      ...data,
    }
    await db.categories.add(category)
    return category
  }

  async function updateCategory(id: string, data: Partial<Omit<Category, 'id' | 'createdAt'>>) {
    await db.categories.update(id, { ...data, updatedAt: new Date().toISOString() })
  }

  async function deleteCategory(id: string) {
    await db.transaction('rw', db.categories, db.practices, async () => {
      await db.practices.where('categoryId').equals(id).delete()
      await db.categories.delete(id)
    })
  }

  async function reorderCategories(orderedIds: string[]) {
    await db.transaction('rw', db.categories, async () => {
      const updates = orderedIds.map((id, index) => db.categories.update(id, { sortOrder: index }))
      await Promise.all(updates)
    })
  }

  return {
    categories: categories ?? [],
    isLoading: categories === undefined,
    addCategory,
    updateCategory,
    deleteCategory,
    reorderCategories,
  }
}
