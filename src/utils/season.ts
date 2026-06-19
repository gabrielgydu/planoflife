import type { Practice } from '../types'

/** Numeric MM*100+DD, so calendar positions within a year compare directly. */
function monthDay(month: number, day: number): number {
  return month * 100 + day
}

/**
 * Is this practice within its active calendar window on the given date?
 *
 * Practices without an `activeWindow` are active every day (all legacy rows and
 * every ordinary devotion). The window compares month/day only, so it recurs
 * every year — e.g. a novena that runs 17–25 June shows up each June. The range
 * is inclusive on both ends. A window whose start falls after its end (e.g.
 * 28 Dec → 2 Jan) wraps across the year boundary.
 */
export function isInActiveWindow(
  practice: Pick<Practice, 'activeWindow'>,
  date: Date
): boolean {
  const w = practice.activeWindow
  if (!w) return true
  const cur = monthDay(date.getMonth() + 1, date.getDate())
  const start = monthDay(w.startMonth, w.startDay)
  const end = monthDay(w.endMonth, w.endDay)
  return start <= end ? cur >= start && cur <= end : cur >= start || cur <= end
}
