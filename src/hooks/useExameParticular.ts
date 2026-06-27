import { useState, useEffect } from 'react'
import { onSettingsChanged, setSyncedSetting } from '../sync/settingsBus'
import { getTodayStr } from '../utils/dates'

// The "exame particular" keeps ONE concrete point at a time (a virtue to acquire
// or a dominant defect to uproot). It's a single low-churn value, so it lives as a
// synced setting (localStorage + cross-device) rather than its own Dexie table —
// see SYNCED_SETTING_KEYS in src/sync/settingsBus.ts. The day's completion is NOT
// here: it's the "Exame particular" practice's own dailyRecord (see
// src/data/exame.ts), so it has per-day history like every other practice.

export type ExameParticularType = 'virtude' | 'defeito'

export interface ExameParticularPoint {
  type: ExameParticularType
  text: string
  startDate: string // YYYY-MM-DD
}

const POINT_KEY = 'settings-exame-particular-point'

function readPoint(): ExameParticularPoint | null {
  const raw = localStorage.getItem(POINT_KEY)
  if (!raw) return null
  try {
    const p = JSON.parse(raw) as Partial<ExameParticularPoint>
    if (p && typeof p.text === 'string' && p.text && (p.type === 'virtude' || p.type === 'defeito')) {
      return {
        type: p.type,
        text: p.text,
        startDate: typeof p.startDate === 'string' && p.startDate ? p.startDate : getTodayStr(),
      }
    }
  } catch {
    /* malformed — treat as no point */
  }
  return null
}

export function useExameParticular() {
  const [point, setPointState] = useState<ExameParticularPoint | null>(readPoint)

  // A pulled snapshot can change the point on another device → refresh live.
  useEffect(() => onSettingsChanged(() => setPointState(readPoint())), [])

  // Fixing a typo on the current point keeps its startDate; a genuinely new point
  // (different text) restarts the clock.
  function setPoint(type: ExameParticularType, text: string) {
    const trimmed = text.trim()
    if (!trimmed) return
    const existing = readPoint()
    const startDate =
      existing && existing.text === trimmed ? existing.startDate : getTodayStr()
    const value: ExameParticularPoint = { type, text: trimmed, startDate }
    setSyncedSetting(POINT_KEY, JSON.stringify(value))
    setPointState(value)
  }

  function clearPoint() {
    setSyncedSetting(POINT_KEY, '')
    setPointState(null)
  }

  return { point, setPoint, clearPoint }
}
