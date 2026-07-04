import { getDay } from 'date-fns'
import type { Practice } from '../types'

/**
 * Is this practice scheduled on the given date? Absent or empty scheduleDays
 * means "every day" (all legacy rows, and the safe fallback if a schedule is
 * ever emptied). Days outside the schedule are NEUTRAL for stats/streaks —
 * they never count against the practice.
 */
export function isScheduledOn(
  practice: Pick<Practice, 'scheduleDays'>,
  date: Date
): boolean {
  const days = practice.scheduleDays
  if (!days || days.length === 0) return true
  return days.includes(getDay(date))
}

/**
 * Weekly-cadence practice: shown every day, satisfied by any completed record
 * in the Monday-start week of the viewed date, neutral in per-day stats.
 */
export function isWeekly(practice: Pick<Practice, 'cadence'>): boolean {
  return practice.cadence === 'weekly'
}

/** Normalize a weekday selection for storage: daily (none/all picked) → undefined. */
export function normalizeScheduleDays(days: number[]): number[] | undefined {
  if (days.length === 0 || days.length === 7) return undefined
  return [...days].sort((a, b) => a - b)
}
