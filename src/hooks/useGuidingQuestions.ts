import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db'
import type { GuidingQuestion } from '../types'
import { generateId } from '../utils/id'

export function useGuidingQuestions(options?: { includeArchived?: boolean }) {
  const includeArchived = options?.includeArchived ?? false

  const questions = useLiveQuery(async () => {
    const all = await db.guidingQuestions.orderBy('sortOrder').toArray()
    if (!includeArchived) {
      return all.filter((q) => !q.isArchived)
    }
    return all
  }, [includeArchived])

  async function addQuestion(text: string) {
    const now = new Date().toISOString()
    const maxOrder = (await db.guidingQuestions.orderBy('sortOrder').last())?.sortOrder ?? -1
    const question: GuidingQuestion = {
      id: generateId(),
      text,
      sortOrder: maxOrder + 1,
      isArchived: false,
      createdAt: now,
    }
    await db.guidingQuestions.add(question)
    return question
  }

  async function updateQuestion(id: string, text: string) {
    await db.guidingQuestions.update(id, { text })
  }

  async function archiveQuestion(id: string) {
    await db.guidingQuestions.update(id, { isArchived: true })
  }

  async function unarchiveQuestion(id: string) {
    await db.guidingQuestions.update(id, { isArchived: false })
  }

  async function deleteQuestion(id: string) {
    await db.guidingQuestions.delete(id)
  }

  async function reorderQuestions(orderedIds: string[]) {
    await db.transaction('rw', db.guidingQuestions, async () => {
      const updates = orderedIds.map((id, index) =>
        db.guidingQuestions.update(id, { sortOrder: index })
      )
      await Promise.all(updates)
    })
  }

  return {
    questions: questions ?? [],
    isLoading: questions === undefined,
    addQuestion,
    updateQuestion,
    archiveQuestion,
    unarchiveQuestion,
    deleteQuestion,
    reorderQuestions,
  }
}
