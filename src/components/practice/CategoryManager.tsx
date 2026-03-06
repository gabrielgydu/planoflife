import { useNavigate, Link } from 'react-router'
import { ChevronLeft, ChevronRight, Plus, FolderOpen } from 'lucide-react'
import { useCategories } from '../../hooks/useCategories'
import { EmptyState } from '../shared/EmptyState'
import { CategoryIcon } from '../shared/CategoryIcon'

export function CategoryManager() {
  const navigate = useNavigate()
  const { categories } = useCategories()

  return (
    <div className="min-h-full">
      <header className="sticky top-0 bg-surface-card dark:bg-surface-card-dark border-b border-border dark:border-border-dark z-10">
        <div className="flex items-center px-4 h-16">
          <button
            onClick={() => navigate('/settings')}
            className="p-2 -ml-2 text-text-secondary dark:text-text-secondary-dark hover:bg-surface-secondary dark:hover:bg-surface-secondary-dark rounded-full transition-colors"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <h1 className="flex-1 text-center font-heading text-lg font-semibold text-text-primary dark:text-text-primary-dark">
            Categorias
          </h1>
          <Link
            to="/settings/categories/new"
            className="p-2 -mr-2 text-primary dark:text-primary-light hover:bg-surface-secondary dark:hover:bg-surface-secondary-dark rounded-full transition-colors"
          >
            <Plus className="w-6 h-6" />
          </Link>
        </div>
      </header>

      <div className="divide-y divide-border/30 dark:divide-border-dark">
        {categories.map((category) => (
          <Link
            key={category.id}
            to={`/settings/categories/${category.id}/edit`}
            className="flex items-center gap-3 px-4 py-4 hover:bg-surface-secondary dark:hover:bg-surface-secondary-dark transition-colors"
          >
            <CategoryIcon name={category.emoji} className="w-5 h-5 text-text-secondary dark:text-text-secondary-dark" />
            <span className="flex-1 text-sm text-text-primary dark:text-text-primary-dark">{category.name}</span>
            <ChevronRight className="w-5 h-5 text-text-muted" />
          </Link>
        ))}
      </div>

      {categories.length === 0 && (
        <EmptyState
          icon={FolderOpen}
          message="Nenhuma categoria"
          action={{ label: 'Adicionar categoria', to: '/settings/categories/new' }}
        />
      )}
    </div>
  )
}
