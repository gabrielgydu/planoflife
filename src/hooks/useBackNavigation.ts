import { useCallback } from 'react'
import { useLocation, useNavigate } from 'react-router'

// "Back" for pages opened from a list. A link into one of them carries
// `state.back` (useBackState), which says two things: where it was opened from, and
// that the history entry before this one IS that page. Popping it then restores the
// origin exactly — the search results with their ?q=, the book a chapter was opened
// from (with ITS back state) — and ScrollMemory puts the list back where it was.
// Without the state (a deep link, a reload into a fresh tab) there is nothing safe
// to pop, so back goes forward to the fallback, as the app's other back buttons do.

export interface BackState {
  back?: string
}

/** The current page as the back target of a page opened from it. */
export function useBackState(): BackState {
  const location = useLocation()
  return { back: location.pathname + location.search }
}

/** Go back to the page this one was opened from, or to `fallback`. */
export function useGoBack(fallback: string): () => void {
  const navigate = useNavigate()
  const opened = !!(useLocation().state as BackState | null)?.back
  return useCallback(() => {
    if (opened) navigate(-1)
    else navigate(fallback)
  }, [opened, navigate, fallback])
}
