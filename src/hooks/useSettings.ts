import { useState, useEffect } from 'react'
import { onSettingsChanged, setSyncedSetting } from '../sync/settingsBus'

const INDIVIDUAL_REASONS_KEY = 'settings-individual-reasons'

export function useIndividualReasons(): [boolean, (value: boolean) => void] {
  const [enabled, setEnabledState] = useState(() => {
    return localStorage.getItem(INDIVIDUAL_REASONS_KEY) === 'true'
  })

  useEffect(
    () => onSettingsChanged(() => setEnabledState(localStorage.getItem(INDIVIDUAL_REASONS_KEY) === 'true')),
    []
  )

  const setEnabled = (value: boolean) => {
    setSyncedSetting(INDIVIDUAL_REASONS_KEY, String(value))
    setEnabledState(value)
  }

  return [enabled, setEnabled]
}

const HIDE_COMPLETED_KEY = 'settings-hide-completed'

export function useHideCompleted(): [boolean, (value: boolean) => void] {
  const [enabled, setEnabledState] = useState(() => {
    return localStorage.getItem(HIDE_COMPLETED_KEY) === 'true'
  })

  useEffect(
    () => onSettingsChanged(() => setEnabledState(localStorage.getItem(HIDE_COMPLETED_KEY) === 'true')),
    []
  )

  const setEnabled = (value: boolean) => {
    setSyncedSetting(HIDE_COMPLETED_KEY, String(value))
    setEnabledState(value)
  }

  return [enabled, setEnabled]
}

const DAILY_VIEW_MODE_KEY = 'settings-daily-view-mode'

// The FAB-cycled daily checklist filter: the plan-of-life core (+ any required
// practice), only the extras, or everything. See DailyView/ViewModeFab.
export type DailyViewMode = 'plano' | 'extras' | 'all'

export const DAILY_VIEW_MODES: DailyViewMode[] = ['plano', 'extras', 'all']

function readDailyViewMode(): DailyViewMode {
  const stored = localStorage.getItem(DAILY_VIEW_MODE_KEY)
  return DAILY_VIEW_MODES.includes(stored as DailyViewMode) ? (stored as DailyViewMode) : 'plano'
}

export function useDailyViewMode(): [DailyViewMode, (value: DailyViewMode) => void] {
  const [mode, setModeState] = useState<DailyViewMode>(readDailyViewMode)

  useEffect(() => onSettingsChanged(() => setModeState(readDailyViewMode())), [])

  const setMode = (value: DailyViewMode) => {
    setSyncedSetting(DAILY_VIEW_MODE_KEY, value)
    setModeState(value)
  }

  return [mode, setMode]
}

const NOVENA_START_KEY = 'settings-novena-start'
const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/

/**
 * The stored manual-start date (YYYY-MM-DD) of the São Josemaría novena, or null
 * when no manual run is set. A run started here shows the novena in the daily
 * list for nine days regardless of the calendar (see manualNovenaDayIndex). Pure
 * reader for non-reactive callers (the PDF export, the morning-review query);
 * reactive UI uses useNovenaStart below.
 */
export function readNovenaStart(): string | null {
  const v = localStorage.getItem(NOVENA_START_KEY)
  return v && ISO_DATE_RE.test(v) ? v : null
}

export function useNovenaStart(): {
  start: string | null
  setStart: (dateStr: string | null) => void
} {
  const [start, setStartState] = useState<string | null>(readNovenaStart)

  useEffect(() => onSettingsChanged(() => setStartState(readNovenaStart())), [])

  const setStart = (dateStr: string | null) => {
    // Empty string (not removal) so a "stop" syncs to other devices — collect/
    // apply key off `!= null`, so '' propagates and clears the run everywhere.
    setSyncedSetting(NOVENA_START_KEY, dateStr ?? '')
    setStartState(dateStr)
  }

  return { start, setStart }
}

const PRACTICE_FONT_SIZE_KEY = 'settings-practice-font-size'
const UI_FONT_SIZE_KEY = 'settings-ui-font-size'

export type FontSizeLevel = 'small' | 'medium' | 'large'

const practiceFontScales: Record<FontSizeLevel, number> = {
  small: 1,
  medium: 1.15,
  large: 1.35,
}

const uiFontScales: Record<FontSizeLevel, number> = {
  small: 0.9,
  medium: 1,
  large: 1.1,
}

function applyFontSize(key: string, scale: number) {
  document.documentElement.style.setProperty(key, String(scale))
}

export function usePracticeFontSize(): [FontSizeLevel, (level: FontSizeLevel) => void] {
  const [level, setLevelState] = useState<FontSizeLevel>(() => {
    return (localStorage.getItem(PRACTICE_FONT_SIZE_KEY) as FontSizeLevel) || 'medium'
  })

  useEffect(() => {
    applyFontSize('--font-scale-practice', practiceFontScales[level])
  }, [level])

  useEffect(
    () => onSettingsChanged(() => setLevelState((localStorage.getItem(PRACTICE_FONT_SIZE_KEY) as FontSizeLevel) || 'medium')),
    []
  )

  const setLevel = (value: FontSizeLevel) => {
    setSyncedSetting(PRACTICE_FONT_SIZE_KEY, value)
    setLevelState(value)
  }

  return [level, setLevel]
}

export function useUIFontSize(): [FontSizeLevel, (level: FontSizeLevel) => void] {
  const [level, setLevelState] = useState<FontSizeLevel>(() => {
    return (localStorage.getItem(UI_FONT_SIZE_KEY) as FontSizeLevel) || 'medium'
  })

  useEffect(() => {
    applyFontSize('--font-scale-ui', uiFontScales[level])
  }, [level])

  useEffect(
    () => onSettingsChanged(() => setLevelState((localStorage.getItem(UI_FONT_SIZE_KEY) as FontSizeLevel) || 'medium')),
    []
  )

  const setLevel = (value: FontSizeLevel) => {
    setSyncedSetting(UI_FONT_SIZE_KEY, value)
    setLevelState(value)
  }

  return [level, setLevel]
}
