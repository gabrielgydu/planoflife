import { useState, useMemo } from 'react'
import { Link, useNavigate } from 'react-router'
import { useLiveQuery } from 'dexie-react-hooks'
import { ChevronLeft, ChevronRight } from 'lucide-react'
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
  addMonths,
  subMonths,
} from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { formatDate } from '../../utils/dates'

const WEEKDAYS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']

export function ExamenHistoryView() {
  const navigate = useNavigate()
  const [currentMonth, setCurrentMonth] = useState(() => startOfMonth(new Date()))

  const handlePrevMonth = () => setCurrentMonth((d) => subMonths(d, 1))
  const handleNextMonth = () => setCurrentMonth((d) => addMonths(d, 1))

  const monthLabel = format(currentMonth, "MMMM 'de' yyyy", { locale: ptBR })

  const monthStart = startOfMonth(currentMonth)
  const monthEnd = endOfMonth(currentMonth)
  const startDateStr = formatDate(monthStart)
  const endDateStr = formatDate(monthEnd)

  const entries = useLiveQuery(
    () =>
      db.examenEntries
        .where('date')
        .between(startDateStr, endDateStr, true, true)
        .toArray(),
    [startDateStr, endDateStr]
  )

  const daysWithEntries = useMemo(() => {
    if (!entries) return new Set<string>()
    const set = new Set<string>()
    for (const entry of entries) {
      set.add(entry.date)
    }
    return set
  }, [entries])

  const days = useMemo(() => {
    const interval = eachDayOfInterval({ start: monthStart, end: monthEnd })
    const startDayOfWeek = getDay(monthStart)
    const padding = Array(startDayOfWeek).fill(null)
    return [...padding, ...interval]
  }, [monthStart, monthEnd])

  return (
    <div className="flex flex-col min-h-full">
      <header className="sticky top-0 bg-surface-card dark:bg-surface-card-dark border-b border-border dark:border-border-dark z-10">
        <div className="flex items-center justify-between px-4 h-16">
          <button
            onClick={() => navigate(-1)}
            className="p-2 -ml-2 text-text-secondary dark:text-text-secondary-dark hover:bg-surface-secondary dark:hover:bg-surface-secondary-dark rounded-full transition-colors"
            aria-label="Voltar"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>

          <div className="flex items-center gap-3">
            <button
              onClick={handlePrevMonth}
              className="p-1 text-text-secondary dark:text-text-secondary-dark hover:bg-surface-secondary dark:hover:bg-surface-secondary-dark rounded-full transition-colors"
              aria-label="Mês anterior"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>

            <h1 className="font-heading text-base font-semibold text-text-primary dark:text-text-primary-dark capitalize min-w-[160px] text-center">
              {monthLabel}
            </h1>

            <button
              onClick={handleNextMonth}
              className="p-1 text-text-secondary dark:text-text-secondary-dark hover:bg-surface-secondary dark:hover:bg-surface-secondary-dark rounded-full transition-colors"
              aria-label="Próximo mês"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          <div className="w-10" />
        </div>
      </header>

      {!entries ? (
        <Spinner className="h-64" />
      ) : (
        <div className="flex-1 p-4">
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
              const hasEntries = daysWithEntries.has(dateStr)
              const isTodayDate = isToday(day)
              const isFutureDate = isFuture(day)
              const isCurrentMonth = isSameMonth(day, currentMonth)

              return (
                <Link
                  key={dateStr}
                  to={`/examen/${dateStr}`}
                  className={`aspect-square rounded-lg flex flex-col items-center justify-center text-xs transition-colors ${
                    !isCurrentMonth ? 'opacity-30' : ''
                  } ${isTodayDate ? 'ring-2 ring-primary dark:ring-ring-dark ring-offset-2 dark:ring-offset-surface-dark' : ''} ${
                    isFutureDate ? 'pointer-events-none' : ''
                  } bg-surface-secondary dark:bg-surface-secondary-dark`}
                >
                  <span className="font-medium text-text-secondary dark:text-text-secondary-dark">
                    {format(day, 'd')}
                  </span>
                  {hasEntries && !isFutureDate && (
                    <span className="w-1.5 h-1.5 rounded-full bg-primary dark:bg-primary-light mt-0.5" />
                  )}
                </Link>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
