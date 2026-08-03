import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db'
import type { ExameTema } from '../types'
import { generateId } from '../utils/id'
import { getTodayStr } from '../utils/dates'

// The exame particular keeps ONE active tema at a time — a small concrete front of
// struggle (e.g. "Tratar mais o Anjo da Guarda") lived for a few weeks through a
// handful of pontos concretos — plus the history of concluded temas. Rows live in
// the synced db.exameTemas table (schema 6; the pre-v24 single-point setting was
// migrated there). The day's completion is NOT here: it's the "Exame particular"
// practice's own dailyRecord (see src/data/exame.ts), so it has per-day history
// like every other practice.

export interface ExameTemaDraft {
  title: string
  pontos: string[]
  guidance: string
}

const cleanDraft = (d: ExameTemaDraft) => ({
  title: d.title.trim(),
  pontos: d.pontos.map((p) => p.trim()).filter(Boolean),
  guidance: d.guidance.trim(),
})

export function useExameTema() {
  const temas = useLiveQuery(() => db.exameTemas.toArray())

  // At most one row is active in normal use; if the no-tombstone union merge ever
  // leaves two (both devices started a new tema while offline), the most recently
  // started one is shown — conclude it to surface the other.
  const activeTema =
    temas
      ?.filter((t) => t.endedAt === null)
      .sort((a, b) => (a.startDate < b.startDate ? 1 : -1))[0] ?? null

  const pastTemas = (temas ?? [])
    .filter((t): t is ExameTema & { endedAt: string } => t.endedAt !== null)
    .sort((a, b) => (a.endedAt < b.endedAt ? 1 : -1))

  // The caller names its target explicitly: an existing tema's id (editing keeps
  // that row's id and startDate — fixing a typo or adding guidance doesn't restart
  // the clock) or null to start a new row — and a new clock. Explicit rather than
  // "whatever is active at save time" so a tema synced in from the other device
  // mid-composition can never be silently overwritten by a draft that was meant to
  // be new.
  async function saveTema(draft: ExameTemaDraft, targetId: string | null) {
    const clean = cleanDraft(draft)
    if (!clean.title) return
    const now = new Date().toISOString()
    if (targetId) {
      await db.exameTemas.update(targetId, { ...clean, updatedAt: now })
    } else {
      await db.exameTemas.add({
        id: generateId(),
        ...clean,
        startDate: getTodayStr(),
        endedAt: null,
        createdAt: now,
        updatedAt: now,
      })
    }
  }

  /** Conclude the active tema: it moves to the history, nothing is deleted. */
  async function concludeTema() {
    if (!activeTema) return
    await db.exameTemas.update(activeTema.id, {
      endedAt: getTodayStr(),
      updatedAt: new Date().toISOString(),
    })
  }

  return {
    activeTema,
    pastTemas,
    isLoading: temas === undefined,
    saveTema,
    concludeTema,
  }
}
