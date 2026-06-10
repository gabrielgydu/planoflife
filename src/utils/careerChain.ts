import { subDays } from 'date-fns'
import { formatDate } from './dates'
import { isScheduledOn } from './schedule'
import type { Practice } from '../types'

// Walking further back than this is pointless for a streak display.
const MAX_LOOKBACK_DAYS = 730

/**
 * Current career-habit chain, in scheduled days.
 *
 * A scheduled day joins the chain when AT LEAST ONE career practice scheduled
 * that day was completed — deliberately lenient: routine.md pre-authorizes a
 * "newborn mode" floor of the win log only, and the chain must survive it.
 * Days where nothing is scheduled (Sundays) are neutral: skipped, never a break.
 * Today only counts once something is done; an empty today never breaks the
 * chain (the day isn't over).
 *
 * @param completedByDate date (YYYY-MM-DD) → set of completed practiceIds
 */
export function computeChain(
  practices: Pick<Practice, 'id' | 'scheduleDays'>[],
  completedByDate: Map<string, Set<string>>,
  today: Date
): number {
  if (practices.length === 0) return 0

  let chain = 0
  for (let back = 0; back <= MAX_LOOKBACK_DAYS; back++) {
    const day = subDays(today, back)
    const scheduled = practices.filter((p) => isScheduledOn(p, day))
    if (scheduled.length === 0) continue // neutral day (e.g. Sunday)

    const done = completedByDate.get(formatDate(day))
    const hit = done !== undefined && scheduled.some((p) => done.has(p.id))
    if (hit) {
      chain++
    } else if (back === 0) {
      continue // today is still open — pending, not a break
    } else {
      break
    }
  }
  return chain
}
