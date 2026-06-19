import { useMemo } from 'react'
import { Link } from 'react-router'
import { useLiveQuery } from 'dexie-react-hooks'
import { Spinner } from '../shared/Spinner'
import { db } from '../../db'
import {
  startOfMonth,
  endOfMonth,
  eachDayOfInterval,
  format,
  getDay,
  isSameMonth,
  isToday,
  isFuture,
} from 'date-fns'
import { formatDate } from '../../utils/dates'
import { useTheme } from '../../hooks/useTheme'
import { getPracticeDomain } from '../../utils/domain'
import { isScheduledOn } from '../../utils/schedule'
import type { PracticeDomain } from '../../types'

interface MonthGridProps {
  month: Date
  domain: PracticeDomain
}

const WEEKDAYS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']

// Grayscale completion colors
const LIGHT_COLORS: Record<string, string> = {
  none: 'transparent',
  low: '#D4D4D4',
  medium: '#888888',
  high: '#444444',
  full: '#111111',
}

const DARK_COLORS: Record<string, string> = {
  none: 'transparent',
  low: '#333333',
  medium: '#666666',
  high: '#999999',
  full: '#FFFFFF',
}

function getCompletionLevel(fillPercent: number): string {
  if (fillPercent === 100) return 'full'
  if (fillPercent >= 75) return 'high'
  if (fillPercent >= 50) return 'medium'
  if (fillPercent > 0) return 'low'
  return 'none'
}

export function MonthGrid({ month, domain }: MonthGridProps) {
  const theme = useTheme()
  const colors = theme === 'dark' ? DARK_COLORS : LIGHT_COLORS
  const monthStart = startOfMonth(month)
  const monthEnd = endOfMonth(month)
  const startDateStr = formatDate(monthStart)
  const endDateStr = formatDate(monthEnd)

  // Get all records for the month
  const records = useLiveQuery(
    () =>
      db.dailyRecords
        .where('date')
        .between(startDateStr, endDateStr, true, true)
        .toArray(),
    [startDateStr, endDateStr]
  )

  // Get all active practices
  const practices = useLiveQuery(
    () => db.practices.filter((p) => !p.isArchived).toArray(),
    []
  )

  // Calculate completion stats per day
  const dayStats = useMemo(() => {
    if (!records || !practices) return new Map()

    const stats = new Map<string, { completed: number; total: number }>()
    // Scope BOTH the denominator and the numerator to the selected domain so
    // spiritual and lifestyle stats never mix. dailyRecords carry no domain, so a
    // completed record only counts when its practice is in the domain set — this
    // also guarantees completed <= total.
    const domainPractices = practices.filter((p) => getPracticeDomain(p) === domain)
    const domainIds = new Set(domainPractices.map((p) => p.id))

    // The day's denominator is the practices SCHEDULED that weekday (absent
    // scheduleDays = daily, so spiritual/lifestyle stats are unchanged). A day
    // where nothing is scheduled (career Sundays) gets total 0 → renders neutral.
    const scheduledIdsByWeekday: Set<string>[] = []
    for (let wd = 0; wd < 7; wd++) {
      // a probe date with the right weekday: 2026-02-01 was a Sunday
      const probe = new Date(2026, 1, 1 + wd)
      scheduledIdsByWeekday.push(
        new Set(domainPractices.filter((p) => isScheduledOn(p, probe)).map((p) => p.id))
      )
    }

    // Group completed records by date
    const recordsByDate = new Map<string, Set<string>>()
    for (const record of records) {
      if (record.isCompleted && domainIds.has(record.practiceId)) {
        const set = recordsByDate.get(record.date) ?? new Set()
        set.add(record.practiceId)
        recordsByDate.set(record.date, set)
      }
    }

    // Calculate stats for each day with completions
    for (const [date, completedIds] of recordsByDate) {
      const scheduled = scheduledIdsByWeekday[getDay(new Date(`${date}T00:00:00`))]
      const completed = [...completedIds].filter((id) => scheduled.has(id)).length
      if (completed > 0) {
        stats.set(date, { completed, total: scheduled.size })
      }
    }

    return stats
  }, [records, practices, domain])

  // Generate calendar grid
  const days = useMemo(() => {
    const interval = eachDayOfInterval({ start: monthStart, end: monthEnd })

    // Add padding for days before the month starts
    const startDayOfWeek = getDay(monthStart)
    const padding = Array(startDayOfWeek).fill(null)

    return [...padding, ...interval]
  }, [monthStart, monthEnd])

  if (!practices || !records) {
    return <Spinner className="h-64" />
  }

  return (
    <div className="flex-1 p-4 mx-auto w-full max-w-md">
      {/* Weekday headers */}
      <div className="grid grid-cols-7 gap-1 mb-2">
        {WEEKDAYS.map((day) => (
          <div
            key={day}
            className="text-center text-xs font-medium text-text-muted dark:text-text-muted-dark py-2"
          >
            {day}
          </div>
        ))}
      </div>

      {/* Day cells */}
      <div className="grid grid-cols-7 gap-1">
        {days.map((day, index) => {
          if (!day) {
            return <div key={`pad-${index}`} className="aspect-square" />
          }

          const dateStr = formatDate(day)
          const stats = dayStats.get(dateStr)
          const isTodayDate = isToday(day)
          const isFutureDate = isFuture(day)
          const isCurrentMonth = isSameMonth(day, month)

          // Calculate fill percentage
          let fillPercent = 0
          if (stats && stats.total > 0) {
            fillPercent = Math.round((stats.completed / stats.total) * 100)
          }

          const level = !isFutureDate && stats ? getCompletionLevel(fillPercent) : 'none'
          const bgStyle = level !== 'none' ? { backgroundColor: colors[level] } : undefined
          // Text color: for light mode use white on dark fills (high/full), black otherwise
          // For dark mode use black on light fills (high/full), white otherwise
          const isDarkFill =
            theme === 'light' ? (level === 'high' || level === 'full') : false
          const isLightFill =
            theme === 'dark' ? (level === 'high' || level === 'full') : false
          const textClass =
            isDarkFill
              ? 'text-white'
              : isLightFill
              ? 'text-black'
              : 'text-text-secondary dark:text-text-secondary-dark'
          const subTextClass =
            isDarkFill
              ? 'text-white/80'
              : isLightFill
              ? 'text-black/70'
              : 'text-text-muted dark:text-text-muted-dark'

          return (
            <Link
              key={dateStr}
              to={`/history/${dateStr}`}
              style={bgStyle}
              className={`aspect-square rounded-lg flex flex-col items-center justify-center text-xs transition-colors cursor-pointer hover:bg-surface-secondary dark:hover:bg-surface-secondary-dark focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary dark:focus-visible:ring-primary-light ${
                !isCurrentMonth ? 'opacity-30' : ''
              } ${isTodayDate ? 'ring-2 ring-primary dark:ring-ring-dark ring-offset-2 dark:ring-offset-surface-dark' : ''} ${
                isFutureDate ? 'pointer-events-none' : ''
              } ${level === 'none' ? 'bg-surface-secondary dark:bg-surface-secondary-dark' : ''}`}
            >
              <span className={`font-medium ${textClass}`}>
                {format(day, 'd')}
              </span>
              {stats && !isFutureDate && (
                <span className={`text-[10px] ${subTextClass}`}>
                  {stats.completed}/{stats.total}
                </span>
              )}
            </Link>
          )
        })}
      </div>

      {/* Legend */}
      <div className="flex items-center justify-center gap-4 mt-6 text-xs text-text-muted dark:text-text-muted-dark">
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 rounded" style={{ backgroundColor: colors.low }} />
          <span>&lt;50%</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 rounded" style={{ backgroundColor: colors.medium }} />
          <span>50-75%</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 rounded" style={{ backgroundColor: colors.high }} />
          <span>75-99%</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 rounded" style={{ backgroundColor: colors.full }} />
          <span>100%</span>
        </div>
      </div>
    </div>
  )
}
