import { useEffect, useLayoutEffect, useRef } from 'react'
import { useLocation } from 'react-router'

/**
 * Per-page scroll memory: leaving a page remembers where you were in it, and
 * coming back puts you there again instead of at the top.
 *
 * Keyed by pathname (not by history entry) on purpose. Several "Voltar" buttons
 * navigate forward to the parent path rather than popping history, so the entry
 * you return to is a brand-new one — a history-keyed memory (what react-router's
 * own <ScrollRestoration> does, and it needs a data router we don't use) would
 * find nothing saved for it and drop you at the top, which is the thing being
 * fixed here.
 *
 * A path with nothing remembered scrolls to the top, so opening a prayer from
 * halfway down the book still starts at the prayer's first line.
 */

const STORAGE_KEY = 'planoflife:scroll-positions'

/** Enough for a deep session in the 88-prayer book; oldest entries fall off. */
const MAX_ENTRIES = 60

/**
 * Give up waiting for a page to grow tall enough to hold the old position. Long
 * enough to outlast a cold Dexie query — the height of a spinner says nothing
 * about whether more content is still coming, so time is the only honest signal.
 */
const RESTORE_TIMEOUT_MS = 1500

function load(): Map<string, number> {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY)
    if (!raw) return new Map()
    const parsed: unknown = JSON.parse(raw)
    if (!parsed || typeof parsed !== 'object') return new Map()
    return new Map(
      Object.entries(parsed as Record<string, unknown>).filter(
        (entry): entry is [string, number] => typeof entry[1] === 'number' && entry[1] > 0
      )
    )
  } catch {
    // Private mode, a quota error, or a corrupt entry: start with no memory.
    return new Map()
  }
}

// sessionStorage (not local): scroll positions belong to the browsing session,
// and this survives the reload a PWA gets when the OS discards the tab.
const positions = load()

function remember(key: string, y: number) {
  // Re-inserting also refreshes insertion order, which is what ages entries out.
  positions.delete(key)
  if (y > 0) positions.set(key, y)
  while (positions.size > MAX_ENTRIES) {
    const oldest = positions.keys().next()
    if (oldest.done) break
    positions.delete(oldest.value)
  }
}

function persist() {
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(Object.fromEntries(positions)))
  } catch {
    // Nothing to do — the in-memory map still works for this session.
  }
}

/** Signals that the user took over; a restore in flight must yield to them. */
const USER_INPUT_EVENTS = ['wheel', 'touchstart', 'pointerdown', 'keydown'] as const

export function ScrollMemory() {
  const { pathname, search } = useLocation()
  const key = pathname + search

  // True while we are driving window.scrollTo ourselves. The resulting scroll
  // events must not be recorded: early in a restore the page is still short, so
  // they would overwrite the remembered position with a clamped 0.
  const restoringRef = useRef(false)

  useEffect(() => {
    // The browser's own restoration works off entries it recorded itself, which
    // for a pushState SPA means it lands at 0 and fights the code below.
    const previous = history.scrollRestoration
    history.scrollRestoration = 'manual'
    const onHide = () => persist()
    window.addEventListener('pagehide', onHide)
    return () => {
      history.scrollRestoration = previous
      window.removeEventListener('pagehide', onHide)
      persist()
    }
  }, [])

  // Record where this page is left. Runs for the page currently on screen, so by
  // the time a navigation happens its final position is already stored.
  useEffect(() => {
    let frame = 0
    const onScroll = () => {
      if (restoringRef.current || frame) return
      frame = requestAnimationFrame(() => {
        frame = 0
        // Re-checked here, not just at event time: a restore can start between
        // the event and this frame, and then window.scrollY is still the 0 a
        // navigation clamped us to — exactly the value that must not be saved.
        if (restoringRef.current) return
        remember(key, window.scrollY)
      })
    }
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => {
      window.removeEventListener('scroll', onScroll)
      if (frame) cancelAnimationFrame(frame)
    }
  }, [key])

  // Layout, not passive: the first attempt then happens before the browser
  // paints the new page, so an already-rendered page never flashes at the top.
  useLayoutEffect(() => {
    const target = positions.get(key) ?? 0
    if (target <= 0) {
      window.scrollTo(0, 0)
      return
    }

    // Pages here fill from Dexie, so on arrival the document is usually still a
    // spinner and scrolling to the old offset would just clamp to 0. Keep
    // re-applying it as the content lands, until it fits, settles short, or the
    // user takes over.
    restoringRef.current = true
    let frame = 0
    let deadline = 0

    const stop = () => {
      if (frame) cancelAnimationFrame(frame)
      for (const type of USER_INPUT_EVENTS) window.removeEventListener(type, stop)
      restoringRef.current = false
    }

    const step = (now: number) => {
      frame = 0
      if (!deadline) deadline = now + RESTORE_TIMEOUT_MS
      const max = Math.max(0, document.documentElement.scrollHeight - window.innerHeight)
      window.scrollTo(0, Math.min(target, max))
      // A hair short counts as arrived: fractional offsets survive browser zoom
      // and a device pixel ratio that isn't a whole number. Otherwise keep
      // trying — a page that never grows back to the old position just holds at
      // its own end, which is where it should sit anyway.
      if (window.scrollY >= target - 1 || now >= deadline) {
        stop()
        return
      }
      frame = requestAnimationFrame(step)
    }

    for (const type of USER_INPUT_EVENTS) {
      window.addEventListener(type, stop, { passive: true })
    }
    step(performance.now())
    return stop
  }, [key])

  return null
}
