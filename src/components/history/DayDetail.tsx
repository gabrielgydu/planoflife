import { useParams, useNavigate } from 'react-router'
import { ChevronLeft, Target, ClipboardList, Check } from 'lucide-react'
import { useDailyRecords } from '../../hooks/useDailyRecords'
import { useProposito } from '../../hooks/usePropositos'
import { useCategories } from '../../hooks/useCategories'
import { usePractices } from '../../hooks/usePractices'
import { useHistoryDomain } from '../../hooks/useHistoryDomain'
import { getPracticeDomain, isLifestyle, isCareer } from '../../utils/domain'
import { isScheduledOn, isWeekly } from '../../utils/schedule'
import { isInActiveWindow } from '../../utils/season'
import { DomainToggle } from './DomainToggle'
import { parseDate, formatDateLong } from '../../utils/dates'
import { CategoryIcon } from '../shared/CategoryIcon'
import type { PracticeDomain } from '../../types'

export function DayDetail() {
  const navigate = useNavigate()
  const { date } = useParams<{ date: string }>()

  const { categories } = useCategories()
  const { practices } = usePractices()
  const { isCompleted } = useDailyRecords(date ?? '')
  const { proposito } = useProposito(date ?? '')
  const [domain, setDomain] = useHistoryDomain()

  if (!date) return null

  const parsedDate = parseDate(date)
  const dateLabel = formatDateLong(parsedDate)

  // Mirror HistoryView: only split for domains the user has, and fall back to
  // spiritual so the day view matches whatever the month grid is showing.
  const domains: PracticeDomain[] = [
    'spiritual',
    ...(practices.some(isLifestyle) ? (['lifestyle'] as const) : []),
    ...(practices.some(isCareer) ? (['career'] as const) : []),
  ]
  const effectiveDomain = domains.includes(domain) ? domain : 'spiritual'

  // Group the selected domain's practices by category
  const practicesByCategory = new Map<string, typeof practices>()
  for (const practice of practices) {
    if (getPracticeDomain(practice) !== effectiveDomain) continue
    const list = practicesByCategory.get(practice.categoryId) ?? []
    list.push(practice)
    practicesByCategory.set(practice.categoryId, list)
  }

  return (
    <div className="min-h-full">
      <header className="sticky top-0 bg-surface-card dark:bg-surface-card-dark border-b border-border dark:border-border-dark z-10">
        <div className="flex items-center px-4 h-16 mx-auto w-full max-w-md">
          <button
            onClick={() => navigate(-1)}
            className="p-2 -ml-2 text-text-secondary dark:text-text-secondary-dark hover:bg-surface-secondary dark:hover:bg-surface-secondary-dark rounded-full transition-colors"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <h1 className="flex-1 text-center font-heading text-base font-medium text-text-primary dark:text-text-primary-dark capitalize">
            {dateLabel}
          </h1>
          <div className="w-10" />
        </div>
      </header>

      {domains.length > 1 && (
        <DomainToggle value={effectiveDomain} onChange={setDomain} domains={domains} />
      )}

      <div className="p-4 space-y-6 mx-auto w-full max-w-md">
        {/* Proposito */}
        {proposito && (
          <div className="p-4 bg-surface-secondary dark:bg-surface-secondary-dark border border-border dark:border-border-dark rounded-lg">
            <div className="flex items-start gap-3">
              <Target className="w-5 h-5 text-primary dark:text-primary-light mt-0.5 shrink-0" />
              <div>
                <p className="text-xs font-heading font-medium text-text-secondary dark:text-text-secondary-dark uppercase tracking-wide mb-1">
                  Propósito
                </p>
                <p className="text-sm italic text-text-primary dark:text-text-primary-dark">{proposito.text}</p>
              </div>
            </div>
          </div>
        )}

        {/* Practices */}
        <section>
          <h2 className="flex items-center gap-2 font-heading text-xs font-medium text-text-muted dark:text-text-muted-dark uppercase tracking-widest mb-3">
            <ClipboardList className="w-4 h-4" />
            Práticas
          </h2>
          <div className="space-y-4">
            {categories.map((category) => {
              // Match MonthGrid's neutral-day semantics: unscheduled practices
              // don't count against the day (career Sundays). An off-schedule
              // completion still shows, marked as bonus, but isn't in the total.
              const dayPractices = (practicesByCategory.get(category.id) ?? [])
                .map((p) => ({
                  practice: p,
                  // A windowed practice off its dates is neutral, like an
                  // unscheduled weekday — not counted, shown only if somehow done.
                  // Weekly practices (Confissão) never count against a single
                  // day; a completion surfaces via the bonus path below.
                  scheduled:
                    !isWeekly(p) && isScheduledOn(p, parsedDate) && isInActiveWindow(p, parsedDate),
                  done: isCompleted(p.id),
                }))
                .filter((x) => x.scheduled || x.done)
              if (dayPractices.length === 0) return null

              const completed = dayPractices.filter((x) => x.scheduled && x.done).length
              const total = dayPractices.filter((x) => x.scheduled).length

              return (
                <div key={category.id} className="bg-surface-secondary dark:bg-surface-secondary-dark rounded-lg p-3">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium text-text-secondary dark:text-text-secondary-dark">
                      <CategoryIcon name={category.emoji} className="w-3.5 h-3.5 inline-block mr-1 align-text-bottom" /> {category.name}
                    </span>
                    <span className="text-xs text-text-muted dark:text-text-muted-dark">
                      {total > 0 ? `${completed}/${total}` : `+${dayPractices.length}`}
                    </span>
                  </div>
                  <div className="space-y-1">
                    {dayPractices.map(({ practice, scheduled, done }) => (
                      <div key={practice.id} className="flex items-center gap-2 text-sm">
                        {done ? (
                          <Check className="w-4 h-4 text-success" />
                        ) : (
                          <span className="text-text-muted dark:text-text-muted-dark">○</span>
                        )}
                        <span
                          className={
                            done
                              ? 'text-text-primary dark:text-text-primary-dark'
                              : 'text-text-muted dark:text-text-muted-dark'
                          }
                        >
                          {practice.name}
                          {!scheduled && (
                            <span className="ml-1.5 text-xs text-text-muted dark:text-text-muted-dark">
                              (fora da agenda)
                            </span>
                          )}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )
            })}
          </div>
        </section>

      </div>
    </div>
  )
}
