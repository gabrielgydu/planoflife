import { useParams, useNavigate } from 'react-router'
import { useLiveQuery } from 'dexie-react-hooks'
import { ChevronLeft, FileText } from 'lucide-react'
import { db } from '../../db'
import { Spinner } from '../shared/Spinner'
import { EmptyState } from '../shared/EmptyState'

export function PracticeDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()

  const practice = useLiveQuery(() => (id ? db.practices.get(id) : undefined), [id])

  if (!practice) {
    return <Spinner className="h-64" />
  }

  return (
    <div className="min-h-full flex flex-col">
      <header className="sticky top-0 bg-surface-card/95 dark:bg-surface-card-dark/95 backdrop-blur-sm shadow-[0_1px_3px_rgba(26,32,48,0.04)] z-10">
        <div className="flex items-center px-4 h-16">
          <button
            onClick={() => navigate(-1)}
            className="p-2 -ml-2 text-text-secondary dark:text-text-secondary-dark hover:bg-surface-secondary dark:hover:bg-surface-secondary-dark rounded-full transition-colors"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <h1 className="flex-1 text-center font-heading text-lg font-semibold text-text-primary dark:text-text-primary-dark pr-10">
            {practice.name}
          </h1>
        </div>
      </header>

      {practice.imageData && (
        <div className="w-full max-h-[40vh] overflow-hidden bg-surface-secondary dark:bg-surface-secondary-dark">
          <img
            src={practice.imageData}
            alt={practice.name}
            className="w-full h-full object-contain"
          />
        </div>
      )}

      {practice.content && (
        <div
          className="prose prose-slate dark:prose-invert max-w-none p-4"
          dangerouslySetInnerHTML={{ __html: practice.content }}
        />
      )}

      {!practice.content && !practice.imageData && (
        <EmptyState icon={FileText} message="Nenhum conteúdo adicionado" />
      )}
    </div>
  )
}
