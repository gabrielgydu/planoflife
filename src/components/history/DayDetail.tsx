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
      <header className="sticky top-0 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-700 z-10">
        <div className="flex items-center px-4 h-14">
          <button
            onClick={() => navigate(-1)}
            className="p-2 -ml-2 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-colors"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <h1 className="flex-1 text-center text-sm font-medium text-slate-900 dark:text-slate-100 capitalize">
            {dateLabel}
          </h1>
          <div className="w-10" />
        </div>
      </header>

      <div className="p-4 space-y-6">
        {/* Proposito */}
        {proposito && (
          <div className="p-4 bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/30 rounded-lg">
            <div className="flex items-start gap-3">
              <Target className="w-5 h-5 text-amber-600 dark:text-amber-400 mt-0.5 shrink-0" />
              <div>
                <p className="text-xs font-medium text-amber-700 dark:text-amber-400 uppercase tracking-wide mb-1">
                  Propósito
                </p>
                <p className="text-sm text-slate-900 dark:text-slate-100">{proposito.text}</p>
              </div>
            </div>
          </div>
        )}

        {/* Practices */}
        <section>
          <h2 className="flex items-center gap-2 text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-3">
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
                <div key={category.id} className="bg-slate-50 dark:bg-slate-800/50 rounded-lg p-3">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium text-slate-700 dark:text-slate-300">
                      {category.emoji} {category.name}
                    </span>
                    <span className="text-xs text-slate-500 dark:text-slate-400">
                      {completed}/{total}
                    </span>
                  </div>
                  <div className="space-y-1">
                    {categoryPractices.map((practice) => (
                      <div key={practice.id} className="flex items-center gap-2 text-sm">
                        {isCompleted(practice.id) ? (
                          <Check className="w-4 h-4 text-green-500" />
                        ) : (
                          <span className="text-slate-300 dark:text-slate-600">○</span>
                        )}
                        <span
                          className={
                            isCompleted(practice.id)
                              ? 'text-slate-900 dark:text-slate-100'
                              : 'text-slate-400 dark:text-slate-500'
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
            <h2 className="flex items-center gap-2 text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-3">
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
                      className="text-xs font-medium uppercase tracking-wider mb-2"
                      style={{ color: EXAMEN_COLORS[category] }}
                    >
                      {EXAMEN_LABELS[category]}
                    </p>
                    <div className="space-y-2">
                      {entries.map((entry) => (
                        <div
                          key={entry.id}
                          className="p-3 bg-white dark:bg-slate-800 rounded-lg border-l-4"
                          style={{ borderColor: EXAMEN_COLORS[category] }}
                        >
                          <p className="text-sm text-slate-900 dark:text-slate-100">{entry.text}</p>
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
