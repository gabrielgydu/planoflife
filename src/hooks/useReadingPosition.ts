import { useCallback, useMemo } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db'
import type { ReadingPosition } from '../types'

/**
 * The saved bookmarks of a reading track (currently only the New Testament).
 * Backed by db.readingPositions, so they sync across devices like any other row:
 * stop reading on the phone, open the laptop, resume in the same verse.
 *
 * Two kinds of row, both with FIXED ids so the two devices always write the same
 * rows (see NT_READING_ID):
 *
 *   'nt'         the track pointer — where reading stopped, whichever book that was.
 *                This is what the reader opens at.
 *   'nt:<book>'  one bookmark per book, so leaving São Marcos to look something up
 *                in São Lucas and coming back lands on the verse you left.
 *
 * Per-book ROWS rather than a map inside the pointer row: the push-conflict merge
 * resolves per record (newest updatedAt wins), so an afternoon in Marcos on the phone
 * and an evening in Lucas on the laptop keep both bookmarks — one shared map would
 * have thrown away whichever device pushed first.
 *
 * `save` writes both rows and skips the ones whose anchor hasn't actually moved. That
 * matters — the reader calls it as you scroll, and every real write marks the sync
 * state dirty and schedules an encrypted push.
 */
export function useReadingPosition(id: string) {
  const prefix = `${id}:`
  // Array form (not .get) so "still loading" (undefined) is distinguishable from
  // "never read anything yet" (empty array) — the reader must not jump to the top
  // of Matthew just because the query hasn't resolved.
  const rows = useLiveQuery(
    () =>
      db.readingPositions
        .where('id')
        .startsWith(id)
        // startsWith('nt') would also catch a future track named 'ntX'; only the
        // pointer itself and its own 'nt:<book>' bookmarks belong to this track.
        .filter((r) => r.id === id || r.id.startsWith(prefix))
        .toArray(),
    [id, prefix]
  )
  const loading = rows === undefined
  const position: ReadingPosition | null = rows?.find((r) => r.id === id) ?? null

  /** Where reading stopped in each book of this track, keyed by book key. */
  const byBook = useMemo(() => {
    const map = new Map<string, ReadingPosition>()
    for (const row of rows ?? []) {
      if (row.id.startsWith(prefix)) map.set(row.id.slice(prefix.length), row)
    }
    return map
  }, [rows, prefix])

  const save = useCallback(
    async (book: string, chapter: number, verse: number) => {
      const bookId = `${id}:${book}`
      const [pointer, bookmark] = await Promise.all([
        db.readingPositions.get(id),
        db.readingPositions.get(bookId),
      ])
      const unchanged = (row?: ReadingPosition) =>
        !!row && row.book === book && row.chapter === chapter && row.verse === verse
      const updatedAt = new Date().toISOString()
      const rows: ReadingPosition[] = []
      if (!unchanged(pointer)) rows.push({ id, book, chapter, verse, updatedAt })
      if (!unchanged(bookmark)) rows.push({ id: bookId, book, chapter, verse, updatedAt })
      if (rows.length > 0) await db.readingPositions.bulkPut(rows)
    },
    [id]
  )

  return { position, byBook, loading, save }
}
