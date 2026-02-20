import { useParams, useNavigate } from 'react-router'
import { useLiveQuery } from 'dexie-react-hooks'
import { ChevronLeft, Target, ClipboardList, BookOpen, Check } from 'lucide-react'
import { db } from '../../db'
import { useDailyRecords } from '../../hooks/useDailyRecords'
import { useProposito } from '../../hooks/usePropositos'
import { useCategories } from '../../hooks/useCategories'
import { usePractices } from '../../hooks/usePractices'
import { parseDate, formatDateLong } from '../../utils/dates'
import { EXAMEN_COLORS, EXAMEN_LABELS } from '../../utils/constants'
import { CategoryIcon } from '../shared/CategoryIcon'

export function DayDetail() {
  const navigate = useNavigate()
  const { date } = useParams<{ date: string }>()

  const { categories } = useCategories()
  const { practices } = usePractices()
  const { isCompleted } = useDailyRecords(date ?? '')
  const { proposito } = useProposito(date ?? '')

  const examenEntries = useLiveQuery(
    () => (date ? db.examenEntries.where('date').equals(date).toArray() : []),
    [date]
  )

  if (!date) return null

  const parsedDate = parseDate(date)
  const dateLabel = formatDateLong(parsedDate)

  // Group practices by category
  const practicesByCategory = new Map<string, typeof practices>()
  for (const practice of practices) {
    const list = practicesByCategory.get(practice.categoryId) ?? []
    list.push(practice)
    practicesByCategory.set(practice.categoryId, list)
  }

  return (
    <div className="min-h-full">
      <header className="sticky top-0 bg-surface-card/95 dark:bg-surface-card-dark/95 backdrop-blur-sm shadow-[0_1px_3px_rgba(26,32,48,0.04)] z-10">
        <div className="flex items-center px-4 h-16">
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

      <div className="p-4 space-y-6">
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
              const categoryPractices = practicesByCategory.get(category.id) ?? []
              if (categoryPractices.length === 0) return null

              const completed = categoryPractices.filter((p) => isCompleted(p.id)).length
              const total = categoryPractices.length

              return (
                <div key={category.id} className="bg-surface-secondary dark:bg-surface-secondary-dark rounded-lg p-3">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium text-text-secondary dark:text-text-secondary-dark">
                      <CategoryIcon name={category.emoji} className="w-3.5 h-3.5 inline-block mr-1 align-text-bottom" /> {category.name}
                    </span>
                    <span className="text-xs text-text-muted dark:text-text-muted-dark">
                      {completed}/{total}
                    </span>
                  </div>
                  <div className="space-y-1">
                    {categoryPractices.map((practice) => (
                      <div key={practice.id} className="flex items-center gap-2 text-sm">
                        {isCompleted(practice.id) ? (
                          <Check className="w-4 h-4 text-success" />
                        ) : (
                          <span className="text-text-muted dark:text-text-muted-dark">○</span>
                        )}
                        <span
                          className={
                            isCompleted(practice.id)
                              ? 'text-text-primary dark:text-text-primary-dark'
                              : 'text-text-muted dark:text-text-muted-dark'
                          }
                        >
                          {practice.name}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )
            })}
          </div>
        </section>

        {/* Examen */}
        {examenEntries && examenEntries.length > 0 && (
          <section>
            <h2 className="flex items-center gap-2 font-heading text-xs font-medium text-text-muted dark:text-text-muted-dark uppercase tracking-widest mb-3">
              <BookOpen className="w-4 h-4" />
              Exame de Consciência
            </h2>
            <div className="space-y-3">
              {(['gracias', 'perdon', 'ayudame'] as const).map((category) => {
                const entries = examenEntries.filter((e) => e.category === category)
                if (entries.length === 0) return null

                return (
                  <div key={category}>
                    <p
                      className="font-heading text-xs font-medium uppercase tracking-widest mb-2"
                      style={{ color: EXAMEN_COLORS[category] }}
                    >
                      {EXAMEN_LABELS[category]}
                    </p>
                    <div className="space-y-2">
                      {entries.map((entry) => (
                        <div
                          key={entry.id}
                          className="p-3 bg-surface-card dark:bg-surface-card-dark rounded-lg border-l-[3px]"
                          style={{ borderColor: EXAMEN_COLORS[category] }}
                        >
                          <p className="text-sm text-text-primary dark:text-text-primary-dark">{entry.text}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )
              })}
            </div>
          </section>
        )}
      </div>
    </div>
  )
}
