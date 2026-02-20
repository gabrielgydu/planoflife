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

interface MonthGridProps {
  month: Date
}

const WEEKDAYS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']

export function MonthGrid({ month }: MonthGridProps) {
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
    const totalPractices = practices.length

    // Group records by date
    const recordsByDate = new Map<string, Set<string>>()
    for (const record of records) {
      if (record.isCompleted) {
        const set = recordsByDate.get(record.date) ?? new Set()
        set.add(record.practiceId)
        recordsByDate.set(record.date, set)
      }
    }

    // Calculate stats for each day
    for (const [date, completedIds] of recordsByDate) {
      stats.set(date, { completed: completedIds.size, total: totalPractices })
    }

    return stats
  }, [records, practices])

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
    <div className="flex-1 p-4">
      {/* Weekday headers */}
      <div className="grid grid-cols-7 gap-1 mb-2">
        {WEEKDAYS.map((day) => (
          <div
            key={day}
            className="text-center text-xs font-medium text-slate-400 dark:text-slate-500 py-2"
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

          // Determine color based on completion
          let bgColor = 'bg-slate-100 dark:bg-slate-800'
          if (!isFutureDate && stats) {
            if (fillPercent === 100) {
              bgColor = 'bg-green-500'
            } else if (fillPercent >= 75) {
              bgColor = 'bg-green-400'
            } else if (fillPercent >= 50) {
              bgColor = 'bg-yellow-400'
            } else if (fillPercent >= 25) {
              bgColor = 'bg-orange-400'
            } else if (fillPercent > 0) {
              bgColor = 'bg-red-400'
            }
          }

          return (
            <Link
              key={dateStr}
              to={`/history/${dateStr}`}
              className={`aspect-square rounded-lg flex flex-col items-center justify-center text-xs transition-colors ${
                !isCurrentMonth ? 'opacity-30' : ''
              } ${isTodayDate ? 'ring-2 ring-primary ring-offset-2 dark:ring-offset-slate-900' : ''} ${
                isFutureDate ? 'pointer-events-none' : ''
              } ${bgColor}`}
            >
              <span
                className={`font-medium ${
                  fillPercent > 50 ? 'text-white' : 'text-slate-700 dark:text-slate-300'
                }`}
              >
                {format(day, 'd')}
              </span>
              {stats && !isFutureDate && (
                <span
                  className={`text-[10px] ${
                    fillPercent > 50 ? 'text-white/80' : 'text-slate-500 dark:text-slate-400'
                  }`}
                >
                  {stats.completed}/{stats.total}
                </span>
              )}
            </Link>
          )
        })}
      </div>

      {/* Legend */}
      <div className="flex items-center justify-center gap-4 mt-6 text-xs text-slate-500 dark:text-slate-400">
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 rounded bg-red-400" />
          <span>&lt;25%</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 rounded bg-orange-400" />
          <span>25-50%</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 rounded bg-yellow-400" />
          <span>50-75%</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 rounded bg-green-400" />
          <span>&gt;75%</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 rounded bg-green-500" />
          <span>100%</span>
        </div>
      </div>
    </div>
  )
}
