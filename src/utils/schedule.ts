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

/**
 * Is `date` the Nth occurrence of its weekday within its calendar month? e.g.
 * isNthWeekdayOfMonth(d, 3, 0) is true only on the third Sunday. `week` is
 * 1-based; `weekday` follows date-fns getDay (0 = Sunday). Every month has at
 * least four of each weekday, so weeks 1–4 always exist; 5 may not.
 */
export function isNthWeekdayOfMonth(date: Date, week: number, weekday: number): boolean {
  if (getDay(date) !== weekday) return false
  const occurrence = Math.floor((date.getDate() - 1) / 7) + 1
  return occurrence === week
}

/**
 * Monthly-recurrence gate, mirroring isInActiveWindow (utils/season.ts): a
 * practice without a monthlySchedule is unrestricted (every ordinary row); one
 * with it shows ONLY on the Nth weekday of the month (e.g. the Athanasian Creed
 * on the third Sunday). Every other day it's hidden from the daily list and
 * NEUTRAL in stats — exactly like an off-schedule weekday. Checked per-date, not
 * via the weekday probe MonthGrid uses for isScheduledOn.
 */
export function isOnMonthlySchedule(
  practice: Pick<Practice, 'monthlySchedule'>,
  date: Date
): boolean {
  const m = practice.monthlySchedule
  if (!m) return true
  return isNthWeekdayOfMonth(date, m.week, m.weekday)
}

/** Normalize a weekday selection for storage: daily (none/all picked) → undefined. */
export function normalizeScheduleDays(days: number[]): number[] | undefined {
  if (days.length === 0 || days.length === 7) return undefined
  return [...days].sort((a, b) => a - b)
}
