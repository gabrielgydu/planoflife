import { Fragment, useMemo } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { Flame, Check } from 'lucide-react'
import { startOfWeek, addDays, isAfter, startOfMonth } from 'date-fns'
import { db } from '../../db'
import { MonthGrid } from '../history/MonthGrid'
import { isCareer } from '../../utils/domain'
import { isScheduledOn } from '../../utils/schedule'
import { computeChain } from '../../utils/careerChain'
import { formatDate, getToday } from '../../utils/dates'
import type { DailyRecord } from '../../types'

// Monday-first: the career week is Mon–Sat with Sunday OFF by design, so Sunday
// sits last as the rest day (unlike the Sunday-first month grid).
const WEEK_LABELS = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom']

export function CareerChain() {
  const practices = useLiveQuery(
    () => db.practices.filter((p) => !p.isArchived && isCareer(p)).sortBy('sortOrder'),
    []
  )
  const practiceIds = useMemo(() => (practices ?? []).map((p) => p.id), [practices])
  const records = useLiveQuery(
    () =>
      practiceIds.length === 0
        ? Promise.resolve([] as DailyRecord[])
        : db.dailyRecords.where('practiceId').anyOf(practiceIds).toArray(),
    [practiceIds]
  )

  const today = getToday()

  const completedByDate = useMemo(() => {
    const map = new Map<string, Set<string>>()
    for (const r of records ?? []) {
      if (!r.isCompleted) continue
      const set = map.get(r.date) ?? new Set<string>()
      set.add(r.practiceId)
      map.set(r.date, set)
    }
    return map
  }, [records])

  const chain = useMemo(
    () => computeChain(practices ?? [], completedByDate, today),
    [practices, completedByDate, today]
  )

  if (!practices || !records || practices.length === 0) return null

  const weekStart = startOfWeek(today, { weekStartsOn: 1 })
  const weekDays = WEEK_LABELS.map((_, i) => addDays(weekStart, i))

  return (
    <section className="space-y-4">
      <div className="bg-surface-card dark:bg-surface-card-dark border border-border dark:border-border-dark rounded-xl p-4">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-xs font-semibold uppercase tracking-widest text-text-muted dark:text-text-muted-dark">
            Cadeia
          </h2>
          <span className="flex items-center gap-1.5 text-sm font-semibold text-text-primary dark:text-text-primary-dark">
            <Flame
              className={`w-4 h-4 ${
                chain > 0 ? 'text-amber-600 dark:text-amber-500' : 'text-text-muted dark:text-text-muted-dark'
              }`}
            />
            {chain} {chain === 1 ? 'dia' : 'dias'}
          </span>
        </div>

        {/* This week, per practice */}
        <div
          className="grid gap-y-2 gap-x-1 items-center"
          style={{ gridTemplateColumns: 'minmax(0,1fr) repeat(7, 1.75rem)' }}
        >
          <span />
          {WEEK_LABELS.map((label, i) => (
            <span
              key={label}
              className="text-center text-[10px] font-medium text-text-muted dark:text-text-muted-dark"
            >
              {label}
              {i === 6 && <span className="sr-only"> (descanso)</span>}
            </span>
          ))}
          {practices.map((p) => (
            <Fragment key={p.id}>
              <span className="text-sm text-text-secondary dark:text-text-secondary-dark truncate pr-2">
                {p.name}
              </span>
              {weekDays.map((day) => {
                const scheduled = isScheduledOn(p, day)
                const done = completedByDate.get(formatDate(day))?.has(p.id) ?? false
                const future = isAfter(day, today)
                const isToday = formatDate(day) === formatDate(today)
                let cell
                if (done) {
                  cell = (
                    <span className="w-5 h-5 rounded-full bg-success text-white flex items-center justify-center">
                      <Check className="w-3.5 h-3.5" />
                    </span>
                  )
                } else if (!scheduled) {
                  cell = <span className="text-text-muted/50 dark:text-text-muted-dark/50 text-xs">·</span>
                } else if (future || isToday) {
                  cell = (
                    <span className="w-5 h-5 rounded-full border-2 border-border dark:border-border-dark" />
                  )
                } else {
                  cell = (
                    <span className="w-5 h-5 rounded-full border-2 border-dashed border-text-muted/40 dark:border-text-muted-dark/40" />
                  )
                }
                return (
                  <span key={formatDate(day)} className="flex items-center justify-center">
                    {cell}
                  </span>
                )
              })}
            </Fragment>
          ))}
        </div>
      </div>

      {/* Month heatmap, scoped to career habits (Sundays render neutral) */}
      <div className="bg-surface-card dark:bg-surface-card-dark border border-border dark:border-border-dark rounded-xl">
        <MonthGrid month={startOfMonth(today)} domain="career" />
      </div>
    </section>
  )
}
