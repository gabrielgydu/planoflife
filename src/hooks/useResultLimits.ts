import { useCallback, useState } from 'react'

/**
 * How many rows each group of search results shows before "Mostrar mais", per
 * query and group. Remembered outside the component, by query, the way ScrollMemory
 * remembers the scroll by URL (?q= holds the query): opening a result unmounts the
 * list, and coming back must rebuild it as long as it was, or the remembered
 * scroll lands past the end of a list cut back to its first page. A query with
 * nothing remembered starts every group at its first page, and so does one typed
 * again (forgetResultLimits): only coming back to a search restores it.
 */

const STORAGE_KEY = 'planoflife:result-limits'

/** Queries remembered; oldest fall off, as in ScrollMemory. */
const MAX_QUERIES = 30

type Limits = Record<string, number>

function load(): Map<string, Limits> {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY)
    const parsed: unknown = raw ? JSON.parse(raw) : null
    if (!parsed || typeof parsed !== 'object') return new Map()
    return new Map(
      Object.entries(parsed as Record<string, unknown>).filter(
        (entry): entry is [string, Limits] => !!entry[1] && typeof entry[1] === 'object'
      )
    )
  } catch {
    // Private mode or a corrupt entry: start with no memory.
    return new Map()
  }
}

// sessionStorage for the same reason as ScrollMemory: it survives the reload a PWA
// gets when the OS discards the tab, and so does the scroll it has to match.
const saved = load()

function persist() {
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(Object.fromEntries(saved)))
  } catch {
    // The in-memory map still works for this session.
  }
}

function save(query: string, limits: Limits) {
  saved.delete(query)
  saved.set(query, limits)
  while (saved.size > MAX_QUERIES) {
    const oldest = saved.keys().next()
    if (oldest.done) break
    saved.delete(oldest.value)
  }
  persist()
}

/** A query typed anew starts every group over at its first page. */
export function forgetResultLimits(query: string) {
  if (saved.delete(query)) persist()
}

export function useResultLimits(query: string) {
  // The limits live in `saved`; this only re-renders the caller when they grow.
  const [, setVersion] = useState(0)
  const current = saved.get(query)

  const limit = (group: string, first: number) => current?.[group] ?? first

  const more = useCallback(
    (group: string, shown: number, step: number) => {
      save(query, { ...saved.get(query), [group]: shown + step })
      setVersion((v) => v + 1)
    },
    [query]
  )

  return { limit, more }
}
