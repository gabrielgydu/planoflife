import { useNavigate, Link } from 'react-router'
import { ChevronLeft, ChevronRight, Plus, Archive, ClipboardList } from 'lucide-react'
import { useCategories } from '../../hooks/useCategories'
import { usePractices } from '../../hooks/usePractices'
import { EmptyState } from '../shared/EmptyState'
import { CategoryIcon } from '../shared/CategoryIcon'

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
      <header className="sticky top-0 bg-surface-card/95 dark:bg-surface-card-dark/95 backdrop-blur-sm shadow-[0_1px_3px_rgba(26,32,48,0.04)] z-10">
        <div className="flex items-center px-4 h-16">
          <button
            onClick={() => navigate('/settings')}
            className="p-2 -ml-2 text-text-secondary dark:text-text-secondary-dark hover:bg-surface-secondary dark:hover:bg-surface-secondary-dark rounded-full transition-colors"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <h1 className="flex-1 text-center font-heading text-lg font-semibold text-text-primary dark:text-text-primary-dark">
            Práticas
          </h1>
          <Link
            to="/settings/practices/new"
            className="p-2 -mr-2 text-primary dark:text-primary-light hover:bg-surface-secondary dark:hover:bg-surface-secondary-dark rounded-full transition-colors"
          >
            <Plus className="w-6 h-6" />
          </Link>
        </div>
      </header>

      <div className="divide-y divide-border/30 dark:divide-border-dark">
        {groupedPractices.map(({ category, practices: catPractices }) => (
          <div key={category.id}>
            {catPractices.length > 0 && (
              <>
                <div className="px-4 py-2 bg-surface-secondary dark:bg-surface-secondary-dark">
                  <span className="font-heading text-xs font-medium text-text-muted dark:text-text-muted-dark uppercase tracking-widest">
                    <CategoryIcon name={category.emoji} className="w-3.5 h-3.5 inline-block mr-1 align-text-bottom" /> {category.name}
                  </span>
                </div>
                {catPractices.map((practice) => (
                  <Link
                    key={practice.id}
                    to={`/settings/practices/${practice.id}`}
                    className="flex items-center gap-3 px-4 py-3 hover:bg-surface-secondary dark:hover:bg-surface-secondary-dark transition-colors"
                  >
                    <span className="flex-1 text-sm text-text-primary dark:text-text-primary-dark">
                      {practice.name}
                      {practice.isRequired && (
                        <span className="ml-1 text-xs text-[#A89548]">*</span>
                      )}
                    </span>
                    <ChevronRight className="w-5 h-5 text-text-muted" />
                  </Link>
                ))}
              </>
            )}
          </div>
        ))}

        {archivedPractices.length > 0 && (
          <div>
            <div className="px-4 py-2 bg-surface-secondary dark:bg-surface-secondary-dark flex items-center gap-1.5">
              <Archive className="w-3.5 h-3.5 text-text-muted dark:text-text-muted-dark" />
              <span className="font-heading text-xs font-medium text-text-muted dark:text-text-muted-dark uppercase tracking-widest">
                Arquivadas
              </span>
            </div>
            {archivedPractices.map((practice) => (
              <Link
                key={practice.id}
                to={`/settings/practices/${practice.id}`}
                className="flex items-center gap-3 px-4 py-3 hover:bg-surface-secondary dark:hover:bg-surface-secondary-dark transition-colors opacity-60"
              >
                <span className="flex-1 text-sm text-text-secondary dark:text-text-secondary-dark">
                  {practice.name} ({categoryMap.get(practice.categoryId)?.name})
                </span>
                <ChevronRight className="w-5 h-5 text-text-muted" />
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
