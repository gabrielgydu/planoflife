import { useNavigate, Link } from 'react-router'
import { ChevronLeft, ChevronRight, Plus, FolderOpen } from 'lucide-react'
import { useCategories } from '../../hooks/useCategories'
import { EmptyState } from '../shared/EmptyState'

export function CategoryManager() {
  const navigate = useNavigate()
  const { categories } = useCategories()

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
            Categorias
          </h1>
          <Link
            to="/settings/categories/new"
            className="p-2 -mr-2 text-primary dark:text-indigo-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-colors"
          >
            <Plus className="w-6 h-6" />
          </Link>
        </div>
      </header>

      <div className="divide-y divide-slate-100 dark:divide-slate-800">
        {categories.map((category) => (
          <Link
            key={category.id}
            to={`/settings/categories/${category.id}/edit`}
            className="flex items-center gap-3 px-4 py-4 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors"
          >
            <span className="text-2xl">{category.emoji}</span>
            <span className="flex-1 text-sm text-slate-900 dark:text-slate-100">{category.name}</span>
            <ChevronRight className="w-5 h-5 text-slate-400" />
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
