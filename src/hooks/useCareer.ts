import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db'
import type { CareerMove } from '../types'

/** The singleton published plan row, or undefined while loading / before any publish. */
export function useCareerPlan() {
  return useLiveQuery(() => db.careerPlan.get('career-plan'), [])
}

export function useCareerMoves(): CareerMove[] {
  return useLiveQuery(() => db.careerMoves.orderBy('sortOrder').toArray(), []) ?? []
}

export function useCareerDeadlines() {
  return useLiveQuery(() => db.careerDeadlines.orderBy('date').toArray(), []) ?? []
}

/** Check a critical-path move off (or back on) from the app. */
export async function setMoveStatus(id: string, done: boolean): Promise<void> {
  await db.careerMoves.update(id, {
    status: done ? 'done' : 'pending',
    updatedAt: new Date().toISOString(),
  })
}
