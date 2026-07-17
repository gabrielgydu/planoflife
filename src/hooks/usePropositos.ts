import { useState, useEffect } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db'
import type { Proposito } from '../types'
import { generateId } from '../utils/id'
import { formatDate, addDay } from '../utils/dates'

// From this hour on, the day is spent and a propósito made now is for tomorrow.
export const PROPOSITO_NEXT_DAY_HOUR = 17

/**
 * The day a propósito made at `now` applies to.
 *
 * A propósito is a resolution still to be lived out, so it lands on the day it
 * can still be acted on: before the cutoff that's the day in progress, after it
 * the day ahead. An examen done after midnight needs no case of its own — it
 * belongs to the night before, and the day it looks ahead to is the calendar
 * day it is already in, which is what the plain comparison below returns.
 */
export function propositoTargetFor(now: Date): { date: string; isTomorrow: boolean } {
  const isTomorrow = now.getHours() >= PROPOSITO_NEXT_DAY_HOUR
  return { date: formatDate(isTomorrow ? addDay(now, 1) : now), isTomorrow }
}

/**
 * propositoTargetFor(now), re-read as the clock runs so a view left open across
 * the cutoff writes to — and says — the right day. Returns a stable object while
 * the target is unchanged, so the tick costs no re-render.
 */
export function usePropositoTarget(): { date: string; isTomorrow: boolean } {
  const [target, setTarget] = useState(() => propositoTargetFor(new Date()))

  useEffect(() => {
    const tick = () =>
      setTarget((prev) => {
        const next = propositoTargetFor(new Date())
        return next.date === prev.date && next.isTomorrow === prev.isTomorrow ? prev : next
      })
    const id = setInterval(tick, 60_000)
    document.addEventListener('visibilitychange', tick)
    return () => {
      clearInterval(id)
      document.removeEventListener('visibilitychange', tick)
    }
  }, [])

  return target
}

export async function setPropositoForDate(date: string, text: string, sourceExamenEntryId?: string) {
  const existing = await db.propositos.where('date').equals(date).first()

  if (existing) {
    await db.propositos.update(existing.id, { text, sourceExamenEntryId: sourceExamenEntryId ?? null })
  } else {
    const newProposito: Proposito = {
      id: generateId(),
      date,
      text,
      sourceExamenEntryId: sourceExamenEntryId ?? null,
      createdAt: new Date().toISOString(),
    }
    await db.propositos.add(newProposito)
  }
}

export async function clearPropositoForDate(date: string) {
  const existing = await db.propositos.where('date').equals(date).first()
  if (existing) {
    await db.propositos.delete(existing.id)
  }
}

export function useProposito(date: string) {
  const proposito = useLiveQuery(
    () => db.propositos.where('date').equals(date).first(),
    [date]
  )

  return {
    proposito,
    isLoading: proposito === undefined,
    setProposito: (text: string, sourceExamenEntryId?: string) =>
      setPropositoForDate(date, text, sourceExamenEntryId),
    clearProposito: () => clearPropositoForDate(date),
  }
}
