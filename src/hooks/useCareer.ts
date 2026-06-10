import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db'
import { generateId } from '../utils/id'
import type { CareerLadderStatus, CareerMove, CareerOutreachAttempt } from '../types'

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

/** Newest first — the natural reading order for an attempts log. */
export function useCareerOutreach(): CareerOutreachAttempt[] {
  return useLiveQuery(() => db.careerOutreach.orderBy('date').reverse().toArray(), []) ?? []
}

export type OutreachDraft = Omit<CareerOutreachAttempt, 'id' | 'createdAt' | 'updatedAt'>

export async function addOutreach(draft: OutreachDraft): Promise<void> {
  const now = new Date().toISOString()
  await db.careerOutreach.add({ id: generateId(), ...draft, createdAt: now, updatedAt: now })
}

export async function updateOutreach(id: string, draft: OutreachDraft): Promise<void> {
  await db.careerOutreach.update(id, { ...draft, updatedAt: new Date().toISOString() })
}

export async function deleteOutreach(id: string): Promise<void> {
  await db.careerOutreach.delete(id)
}

export function useCareerLadder() {
  return useLiveQuery(() => db.careerLadder.orderBy('rung').toArray(), []) ?? []
}

export async function updateRung(
  id: string,
  changes: { status: CareerLadderStatus; notes: string }
): Promise<void> {
  await db.careerLadder.update(id, { ...changes, updatedAt: new Date().toISOString() })
}
