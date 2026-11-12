import { useCallback, useMemo } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db'
import { generateId } from '../utils/id'
import type { Jaculatoria } from '../types'

/**
 * The user's jaculatórias for the rosary mysteries. Backed by db.jaculatorias, so
 * they sync like any other row. `byMystery` maps a mystery key ('gozosos:1', see
 * mysteryKey in src/data/rosary.ts) to its jaculatórias in the order they were
 * written; deleted rows (isDeleted) are left out.
 */
export function useJaculatorias() {
  const rows = useLiveQuery(() => db.jaculatorias.toArray())

  const byMystery = useMemo(() => {
    const out = new Map<string, Jaculatoria[]>()
    for (const row of rows ?? []) {
      // A row is synced data: one without usable text would render as an empty
      // block, so it is skipped, not shown.
      if (row.isDeleted || typeof row.text !== 'string' || !row.text.trim()) continue
      const list = out.get(row.mystery)
      if (list) list.push(row)
      else out.set(row.mystery, [row])
    }
    for (const list of out.values()) list.sort((a, b) => a.createdAt.localeCompare(b.createdAt))
    return out
  }, [rows])

  const addJaculatoria = useCallback(async (mystery: string, text: string) => {
    const now = new Date().toISOString()
    await db.jaculatorias.add({
      id: generateId(),
      mystery,
      text,
      isDeleted: false,
      createdAt: now,
      updatedAt: now,
    })
  }, [])

  const updateJaculatoria = useCallback(async (id: string, text: string) => {
    await db.jaculatorias.update(id, { text, updatedAt: new Date().toISOString() })
  }, [])

  // Kept as a row with isDeleted: the push-conflict merge has no tombstones, so a
  // really deleted row would come back from the other device's snapshot.
  const deleteJaculatoria = useCallback(async (id: string) => {
    await db.jaculatorias.update(id, { isDeleted: true, updatedAt: new Date().toISOString() })
  }, [])

  return {
    byMystery,
    isLoading: rows === undefined,
    addJaculatoria,
    updateJaculatoria,
    deleteJaculatoria,
  }
}
