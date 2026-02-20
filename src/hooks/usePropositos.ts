import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db'
import type { Proposito } from '../types'
import { generateId } from '../utils/id'

export function useProposito(date: string) {
  const proposito = useLiveQuery(
    () => db.propositos.where('date').equals(date).first(),
    [date]
  )

  async function setProposito(text: string, sourceExamenEntryId?: string) {
    const now = new Date().toISOString()
    const existing = await db.propositos.where('date').equals(date).first()

    if (existing) {
      await db.propositos.update(existing.id, { text, sourceExamenEntryId: sourceExamenEntryId ?? null })
    } else {
      const newProposito: Proposito = {
        id: generateId(),
        date,
        text,
        sourceExamenEntryId: sourceExamenEntryId ?? null,
        createdAt: now,
      }
      await db.propositos.add(newProposito)
    }
  }

  async function clearProposito() {
    const existing = await db.propositos.where('date').equals(date).first()
    if (existing) {
      await db.propositos.delete(existing.id)
    }
  }

  return {
    proposito,
    isLoading: proposito === undefined,
    setProposito,
    clearProposito,
  }
}
