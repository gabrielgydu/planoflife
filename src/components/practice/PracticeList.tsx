import { useNavigate, Link } from 'react-router'
import { ChevronLeft, ChevronRight, Plus, Archive, ClipboardList } from 'lucide-react'
import { useCategories } from '../../hooks/useCategories'
import { usePractices } from '../../hooks/usePractices'
import { EmptyState } from '../shared/EmptyState'

export function PracticeList() {
  const navigate = useNavigate()
  const { categories } = useCategories()
  const { practices } = usePractices({ includeArchived: true })

  const categoryMap = new Map(categories.map((c) => [c.id, c]))

  const activePractices = practices.filter((p) => !p.isArchived)
  const archivedPractices = practices.filter((p) => p.isArchived)

  const groupedPractices = categories.map((cat) => ({
    category: cat,
    practices: activePractices.filter((p) => p.categoryId === cat.id),
  }))

  return (
    <div className="min-h-full">
      <header className="sticky top-0 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-700 z-10">
        <div className="flex items-center px-4 h-14">
          <button
            onClick={() => navigate('/settings')}
            className="p-2 -ml-2 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-colors"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <h1 className="flex-1 text-center text-lg font-semibold text-slate-900 dark:text-slate-100">
            Práticas
          </h1>
          <Link
            to="/settings/practices/new"
            className="p-2 -mr-2 text-primary dark:text-indigo-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-colors"
          >
            <Plus className="w-6 h-6" />
          </Link>
        </div>
      </header>

      <div className="divide-y divide-slate-100 dark:divide-slate-800">
        {groupedPractices.map(({ category, practices: catPractices }) => (
          <div key={category.id}>
            {catPractices.length > 0 && (
              <>
                <div className="px-4 py-2 bg-slate-50 dark:bg-slate-800/50">
                  <span className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                    {category.emoji} {category.name}
                  </span>
                </div>
                {catPractices.map((practice) => (
                  <Link
                    key={practice.id}
                    to={`/settings/practices/${practice.id}`}
                    className="flex items-center gap-3 px-4 py-3 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors"
                  >
                    <span className="flex-1 text-sm text-slate-900 dark:text-slate-100">
                      {practice.name}
                      {practice.isRequired && (
                        <span className="ml-1 text-xs text-amber-600 dark:text-amber-500">*</span>
                      )}
                    </span>
                    <ChevronRight className="w-5 h-5 text-slate-400" />
                  </Link>
                ))}
              </>
            )}
          </div>
        ))}

        {archivedPractices.length > 0 && (
          <div>
            <div className="px-4 py-2 bg-slate-100 dark:bg-slate-700/50 flex items-center gap-1.5">
              <Archive className="w-3.5 h-3.5 text-slate-500 dark:text-slate-400" />
              <span className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                Arquivadas
              </span>
            </div>
            {archivedPractices.map((practice) => (
              <Link
                key={practice.id}
                to={`/settings/practices/${practice.id}`}
                className="flex items-center gap-3 px-4 py-3 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors opacity-60"
              >
                <span className="flex-1 text-sm text-slate-600 dark:text-slate-400">
                  {practice.name} ({categoryMap.get(practice.categoryId)?.name})
                </span>
                <ChevronRight className="w-5 h-5 text-slate-400" />
              </Link>
            ))}
          </div>
        )}
      </div>

      {practices.length === 0 && (
        <EmptyState
          icon={ClipboardList}
          message="Nenhuma prática cadastrada"
          action={{ label: 'Adicionar prática', to: '/settings/practices/new' }}
        />
      )}
    </div>
  )
}
