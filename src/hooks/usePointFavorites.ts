import { useCallback, useMemo } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db'
import { comparePoints, isBookKey, isPointInBook, pointFavoriteId } from '../data/escriva'
import type { BookKey } from '../data/meditation'

export interface FavoritePoint {
  book: BookKey
  n: number
}

/**
 * The favorite points of Caminho, Sulco and Forja. Backed by db.pointFavorites, so
 * they sync like any other row. `points` is the favorites in reading order
 * (Caminho, Sulco, Forja, each by number); `ids` answers "is this one a favorite?"
 * for a row or a reader without a scan.
 */
export function usePointFavorites() {
  const rows = useLiveQuery(() => db.pointFavorites.toArray())

  const points = useMemo(() => {
    const out: FavoritePoint[] = []
    for (const row of rows ?? []) {
      // A row is synced data: one for a book or number this build doesn't have
      // would only render as a broken link, so it is skipped, not shown.
      if (!row.isFavorite || !isBookKey(row.book) || !isPointInBook(row.book, row.n)) continue
      out.push({ book: row.book, n: row.n })
    }
    return out.sort(comparePoints)
  }, [rows])

  const ids = useMemo(() => new Set(points.map((p) => pointFavoriteId(p.book, p.n))), [points])

  // Stable, so memoized rows that receive it keep their memo.
  const toggleFavorite = useCallback(async (book: BookKey, n: number) => {
    const id = pointFavoriteId(book, n)
    const updatedAt = new Date().toISOString()
    await db.transaction('rw', db.pointFavorites, async () => {
      const row = await db.pointFavorites.get(id)
      if (row) await db.pointFavorites.update(id, { isFavorite: !row.isFavorite, updatedAt })
      else await db.pointFavorites.add({ id, book, n, isFavorite: true, updatedAt })
    })
  }, [])

  return { points, ids, isLoading: rows === undefined, toggleFavorite }
}
