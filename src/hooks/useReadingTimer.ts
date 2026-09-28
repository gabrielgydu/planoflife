import { useCallback, useEffect, useRef, useState } from 'react'
import { formatDate, getToday, subDay } from '../utils/dates'

// How often the running countdown re-checks the clock. The display only changes
// once a second; a finer tick just keeps that change from landing up to a second late.
const TICK_MS = 250
// Days of history kept in the store; older entries are dropped on the next write so
// the map doesn't grow forever. A date older than this simply shows a fresh timer.
const KEEP_DAYS = 60

type TimerStore = Record<string, number>

function readStore(storageKey: string): TimerStore {
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem(storageKey) ?? '{}')
    return parsed && typeof parsed === 'object' ? (parsed as TimerStore) : {}
  } catch {
    return {}
  }
}

function loadElapsed(storageKey: string, dateStr: string, durationMs: number): number {
  const value = readStore(storageKey)[dateStr]
  return typeof value === 'number' && value > 0 ? Math.min(value, durationMs) : 0
}

function saveElapsed(storageKey: string, dateStr: string, elapsedMs: number) {
  const store = readStore(storageKey)
  const cutoff = formatDate(subDay(getToday(), KEEP_DAYS))
  for (const key of Object.keys(store)) {
    if (key < cutoff && key !== dateStr) delete store[key]
  }
  if (elapsedMs > 0) store[dateStr] = Math.round(elapsedMs)
  else delete store[dateStr]
  localStorage.setItem(storageKey, JSON.stringify(store))
}

/**
 * A countdown that belongs to one day: `dateStr`'s timer keeps its own progress, so
 * pausing at 3:12 and reopening later that day resumes at 3:12, and the next day
 * starts again from the full duration.
 *
 * It never starts on its own, and any interruption pauses it — leaving the page
 * (app switch, screen lock, another window focused) or unmounting the component
 * (closing the reader). What is persisted is only the time already read, never
 * "running since", so however the app goes away, even killed outright, it comes back
 * paused on the last whole second it saw.
 *
 * Device-local on purpose (localStorage, not Dexie): it is a reading aid for the
 * device in hand, and a synced row would push on every pause.
 *
 * While running it holds a screen wake lock, so the phone's auto-lock can't dim the
 * screen and pause the timer mid-page.
 */
export function useReadingTimer(
  storageKey: string,
  dateStr: string,
  durationMs: number,
  onFinish: () => void
) {
  const [elapsed, setElapsed] = useState(() => loadElapsed(storageKey, dateStr, durationMs))
  const [running, setRunning] = useState(false)
  // Time already banked before the running segment, and when that segment began
  // (performance.now: monotonic, so a wall-clock change can't eat or add minutes).
  const bankedRef = useRef(elapsed)
  const runningSinceRef = useRef<number | null>(null)
  const onFinishRef = useRef(onFinish)
  useEffect(() => {
    onFinishRef.current = onFinish
  })

  // --- screen wake lock ----------------------------------------------------------
  // Requested from the Start tap itself (Safari wants a user gesture). `wantsWake`
  // covers the async gap: a pause before the request resolves releases it on arrival.
  const wakeLockRef = useRef<WakeLockSentinel | null>(null)
  const wantsWakeRef = useRef(false)

  const acquireWakeLock = useCallback(() => {
    wantsWakeRef.current = true
    if (!('wakeLock' in navigator)) return
    navigator.wakeLock
      .request('screen')
      .then((sentinel) => {
        if (wantsWakeRef.current) wakeLockRef.current = sentinel
        else void sentinel.release().catch(() => {})
      })
      .catch(() => {})
  }, [])

  const releaseWakeLock = useCallback(() => {
    wantsWakeRef.current = false
    const sentinel = wakeLockRef.current
    wakeLockRef.current = null
    if (sentinel) void sentinel.release().catch(() => {})
  }, [])

  // --- controls --------------------------------------------------------------------
  const currentElapsed = useCallback(() => {
    const since = runningSinceRef.current
    return Math.min(durationMs, bankedRef.current + (since === null ? 0 : performance.now() - since))
  }, [durationMs])

  /** Bank the running segment and persist it. Safe to call when already stopped. */
  const stop = useCallback(() => {
    if (runningSinceRef.current === null) return bankedRef.current
    const total = currentElapsed()
    runningSinceRef.current = null
    bankedRef.current = total
    saveElapsed(storageKey, dateStr, total)
    releaseWakeLock()
    return total
  }, [currentElapsed, storageKey, dateStr, releaseWakeLock])

  const pause = useCallback(() => {
    if (runningSinceRef.current === null) return
    setElapsed(stop())
    setRunning(false)
  }, [stop])

  const start = useCallback(() => {
    if (runningSinceRef.current !== null || bankedRef.current >= durationMs) return
    runningSinceRef.current = performance.now()
    acquireWakeLock()
    setRunning(true)
  }, [durationMs, acquireWakeLock])

  const reset = useCallback(() => {
    if (runningSinceRef.current !== null) return
    bankedRef.current = 0
    saveElapsed(storageKey, dateStr, 0)
    setElapsed(0)
  }, [storageKey, dateStr])

  // --- countdown -------------------------------------------------------------------
  useEffect(() => {
    if (!running) return
    let lastSecond = Math.floor(bankedRef.current / 1000)
    const id = setInterval(() => {
      const total = currentElapsed()
      if (total >= durationMs) {
        stop()
        setElapsed(durationMs)
        setRunning(false)
        onFinishRef.current()
        return
      }
      const second = Math.floor(total / 1000)
      if (second === lastSecond) return
      lastSecond = second
      // Persisted every second, not only on pause: if the app is killed without a
      // chance to pause, reopening loses at most the second in progress.
      saveElapsed(storageKey, dateStr, total)
      setElapsed(total)
    }, TICK_MS)
    return () => clearInterval(id)
  }, [running, currentElapsed, durationMs, stop, storageKey, dateStr])

  // --- auto-pause on any interruption ------------------------------------------------
  useEffect(() => {
    if (!running) return
    const onVisibility = () => {
      if (document.visibilityState === 'hidden') pause()
    }
    document.addEventListener('visibilitychange', onVisibility)
    window.addEventListener('pagehide', pause)
    window.addEventListener('blur', pause)
    return () => {
      document.removeEventListener('visibilitychange', onVisibility)
      window.removeEventListener('pagehide', pause)
      window.removeEventListener('blur', pause)
    }
  }, [running, pause])

  // Closing the reader is an interruption too: bank what was read.
  const stopRef = useRef(stop)
  useEffect(() => {
    stopRef.current = stop
  })
  useEffect(() => () => void stopRef.current(), [])

  return {
    remainingMs: durationMs - elapsed,
    running,
    started: elapsed > 0,
    finished: elapsed >= durationMs,
    start,
    pause,
    reset,
  }
}
