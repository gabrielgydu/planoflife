import { useCallback, useEffect, useRef, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db'
import {
  drawPointNumber,
  MAX_POINT,
  meditationDayKey,
  type DrawSource,
  type MeditacaoSlot,
} from '../data/meditation'
import { getTodayStr } from '../utils/dates'

/**
 * The drawn Escrivá point for a given day + slot (morning / afternoon). Reads
 * db.meditationDays (one row per day+slot, keyed by meditationDayKey). If TODAY's
 * row is absent it draws once and stores it; subsequent opens read the stored
 * number (stable, no re-draw). The row syncs, so both devices converge on the same
 * number for the day. The two slots draw independently, so morning and afternoon
 * show different points.
 *
 * Auto-draw is gated to today only: navigating DailyView to a past/future day and
 * opening the reader must NOT fabricate (and sync) a row for a day the user never
 * meditated on. For non-today days you see the existing row if any, else an empty
 * state; an explicit reroll still lets you draw on purpose.
 */
export function useMeditationDay(dateStr: string, slot: MeditacaoSlot) {
  const key = meditationDayKey(dateStr, slot)
  // Array form (not .get) so we can distinguish "still loading" (undefined) from
  // "no row yet" (empty array) — .get can't, since a missing row is also undefined.
  const rows = useLiveQuery(
    () => db.meditationDays.where('id').equals(key).toArray(),
    [key],
  )
  const queryLoading = rows === undefined
  const row = rows?.[0]
  const [drawing, setDrawing] = useState(false)
  // Guards against drawing twice for the same key (effect re-runs, StrictMode).
  const drawingFor = useRef<string | null>(null)

  useEffect(() => {
    if (queryLoading || row) return
    if (dateStr !== getTodayStr()) return // only auto-draw for today
    if (drawingFor.current === key) return
    drawingFor.current = key
    setDrawing(true)
    void (async () => {
      try {
        const { n, source } = await drawPointNumber(MAX_POINT)
        const now = new Date().toISOString()
        try {
          await db.meditationDays.add({ id: key, pointNumber: n, source, updatedAt: now })
        } catch {
          // Lost a race (row created concurrently) — keep the existing one.
        }
      } finally {
        // Idempotent: only clear the guard if it still points at this key, so a
        // draw that resolves AFTER the user navigated away can't wipe a newer guard.
        if (drawingFor.current === key) drawingFor.current = null
        setDrawing(false)
      }
    })()
  }, [queryLoading, row, dateStr, key])

  const reroll = useCallback(async () => {
    setDrawing(true)
    try {
      const { n, source } = await drawPointNumber(MAX_POINT)
      const now = new Date().toISOString()
      await db.meditationDays.put({ id: key, pointNumber: n, source, updatedAt: now })
    } finally {
      setDrawing(false)
    }
  }, [key])

  return {
    pointNumber: row?.pointNumber ?? null,
    source: (row?.source ?? null) as DrawSource | null,
    // True while the live query is resolving OR a draw/reroll is in flight.
    loading: queryLoading || drawing,
    drawing,
    reroll,
  }
}
