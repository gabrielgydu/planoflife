import { useCallback } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db'
import type { ReadingPosition } from '../types'

/**
 * The saved bookmark for a reading track (currently only the New Testament).
 * Backed by db.readingPositions, so it syncs across devices like any other row:
 * stop reading on the phone, open the laptop, resume in the same verse.
 *
 * `save` is a no-op when the anchor hasn't actually moved. That matters — the
 * reader calls it as you scroll, and every real write marks the sync state dirty
 * and schedules an encrypted push.
 */
export function useReadingPosition(id: string) {
  // Array form (not .get) so "still loading" (undefined) is distinguishable from
  // "never read anything yet" (empty array) — the reader must not jump to the top
  // of Matthew just because the query hasn't resolved.
  const rows = useLiveQuery(() => db.readingPositions.where('id').equals(id).toArray(), [id])
  const loading = rows === undefined
  const position: ReadingPosition | null = rows?.[0] ?? null

  const save = useCallback(
    async (book: string, chapter: number, verse: number) => {
      const current = await db.readingPositions.get(id)
      if (current && current.book === book && current.chapter === chapter && current.verse === verse) {
        return
      }
      await db.readingPositions.put({
        id,
        book,
        chapter,
        verse,
        updatedAt: new Date().toISOString(),
      })
    },
    [id]
  )

  return { position, loading, save }
}
