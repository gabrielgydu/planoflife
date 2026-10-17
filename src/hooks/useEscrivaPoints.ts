import { useCallback, useEffect, useState } from 'react'
import { loadEscrivaPoints, type EscrivaPoints } from '../data/meditation'

/**
 * The bundled Caminho/Sulco/Forja text, loaded on demand (a ~750 KB lazy chunk,
 * precached, so it works offline). `retry` re-imports after a failed load — the
 * loader never memoizes a rejection, see loadEscrivaPoints.
 */
export function useEscrivaPoints() {
  const [points, setPoints] = useState<EscrivaPoints | null>(null)
  const [error, setError] = useState(false)

  const load = useCallback(() => {
    setError(false)
    let cancelled = false
    loadEscrivaPoints()
      .then((p) => {
        if (!cancelled) setPoints(p)
      })
      .catch(() => {
        if (!cancelled) setError(true)
      })
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => load(), [load])

  return { points, error, retry: load }
}
