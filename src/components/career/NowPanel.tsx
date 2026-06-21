import { AlertTriangle, CalendarClock } from 'lucide-react'
import { differenceInCalendarDays, parseISO, format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { useCareerPlan, useCareerDeadlines } from '../../hooks/useCareer'
import { WeekGrid } from './WeekGrid'

// The drift warning is a tripwire, not a metronome: STATE.md changes per career
// session, so a publish older than this is probably stale.
const DRIFT_WARN_DAYS = 7

function daysLabel(days: number): string {
  if (days === 0) return 'hoje'
  if (days === 1) return 'amanhã'
  if (days > 1) return `em ${days} dias`
  if (days === -1) return 'há 1 dia'
  return `há ${-days} dias`
}

export function NowPanel() {
  const plan = useCareerPlan()
  const deadlines = useCareerDeadlines()

  if (!plan) return null

  const today = new Date()
  const publishedDaysAgo = differenceInCalendarDays(today, parseISO(plan.publishedAt))

  return (
    <section className="space-y-4">
      {/* Phase + focus */}
      <div className="bg-surface-card dark:bg-surface-card-dark border border-border dark:border-border-dark rounded-xl p-4">
        <span className="inline-block text-xs font-semibold uppercase tracking-widest px-2.5 py-1 rounded-full bg-primary/10 dark:bg-primary-light/10 text-primary dark:text-primary-light">
          {plan.currentPhase}
        </span>
        <p className="mt-2 text-sm text-text-secondary dark:text-text-secondary-dark">
          {plan.focusLine}
        </p>
        {publishedDaysAgo > DRIFT_WARN_DAYS && (
          <p className="mt-2 flex items-center gap-1.5 text-xs text-amber-600 dark:text-amber-500">
            <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0" />
            Plano publicado há {publishedDaysAgo} dias — pode estar desatualizado.
          </p>
        )}
      </div>

      {/* Week-by-week plan (Kalenderwochen) — the moves list, bucketed by KW */}
      <WeekGrid />

      {/* Deadline countdowns */}
      {deadlines.length > 0 && (
        <div className="bg-surface-card dark:bg-surface-card-dark border border-border dark:border-border-dark rounded-xl p-4">
          <h2 className="text-xs font-semibold uppercase tracking-widest text-text-muted dark:text-text-muted-dark mb-3">
            Prazos
          </h2>
          <ul className="space-y-2.5">
            {deadlines.map((d) => {
              const days = differenceInCalendarDays(parseISO(d.date), today)
              const urgent = days <= 3
              return (
                <li key={d.id} className="flex items-center gap-3">
                  <CalendarClock
                    className={`w-4 h-4 flex-shrink-0 ${
                      urgent
                        ? 'text-amber-600 dark:text-amber-500'
                        : 'text-text-muted dark:text-text-muted-dark'
                    }`}
                  />
                  <span className="flex-1 min-w-0 text-sm text-text-primary dark:text-text-primary-dark truncate">
                    {d.label}
                  </span>
                  <span className="text-xs text-text-muted dark:text-text-muted-dark">
                    {format(parseISO(d.date), "d 'de' MMM", { locale: ptBR })}
                  </span>
                  <span
                    className={`text-sm font-medium whitespace-nowrap ${
                      days < 0
                        ? 'text-[#9B6B6B]'
                        : urgent
                          ? 'text-amber-600 dark:text-amber-500'
                          : 'text-text-secondary dark:text-text-secondary-dark'
                    }`}
                  >
                    {daysLabel(days)}
                  </span>
                </li>
              )
            })}
          </ul>
        </div>
      )}
    </section>
  )
}
