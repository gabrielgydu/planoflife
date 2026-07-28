import { useParams, useNavigate, Link } from 'react-router'
import { useLiveQuery } from 'dexie-react-hooks'
import { ChevronLeft, FileText, Pencil } from 'lucide-react'
import { db } from '../../db'
import { Spinner } from '../shared/Spinner'
import { EmptyState } from '../shared/EmptyState'
import { MarkdownRenderer } from '../shared/MarkdownRenderer'
import { prayerText, prayerTitle } from '../../data/devocionario'

export function PracticeDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()

  const practice = useLiveQuery(() => (id ? db.practices.get(id) : undefined), [id])
  // Practices created from a Devocionário prayer show that prayer here, so the
  // detail page isn't an empty shell for them.
  const prayer = useLiveQuery(
    () => (practice?.prayerId ? db.prayers.get(practice.prayerId) : undefined),
    [practice?.prayerId]
  )

  if (!practice) {
    return <Spinner className="h-64" />
  }

  return (
    <div className="min-h-full flex flex-col">
      <header className="sticky top-0 bg-surface-card/95 dark:bg-surface-card-dark/95 backdrop-blur-sm shadow-[0_1px_3px_rgba(26,32,48,0.04)] z-10">
        <div className="flex items-center px-4 h-16 mx-auto w-full max-w-2xl">
          <button
            onClick={() => navigate(-1)}
            className="p-2 -ml-2 text-text-secondary dark:text-text-secondary-dark hover:bg-surface-secondary dark:hover:bg-surface-secondary-dark rounded-full transition-colors"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <h1 className="flex-1 text-center font-heading text-lg font-semibold text-text-primary dark:text-text-primary-dark truncate px-2">
            {practice.name}
          </h1>
          <button
            onClick={() => navigate(`/settings/practices/${practice.id}/edit`)}
            className="p-2 -mr-2 text-text-secondary dark:text-text-secondary-dark hover:bg-surface-secondary dark:hover:bg-surface-secondary-dark rounded-full transition-colors"
            aria-label="Editar prática"
          >
            <Pencil className="w-5 h-5" />
          </button>
        </div>
      </header>

      <div className="mx-auto w-full max-w-2xl">
        {practice.imageData && (
          <div className="w-full flex justify-center bg-surface-secondary dark:bg-surface-secondary-dark">
            <img
              src={practice.imageData}
              alt={practice.name}
              className="max-h-[40vh] w-auto max-w-full object-contain"
            />
          </div>
        )}

        {practice.content && (
          <div
            className="prose prose-slate dark:prose-invert max-w-full p-4"
            dangerouslySetInnerHTML={{ __html: practice.content }}
          />
        )}

        {prayer && (
          <div className="p-4">
            <Link
              to={`/devocionario/${prayer.id}`}
              className="text-xs font-heading uppercase tracking-widest text-primary dark:text-primary-light"
            >
              Devocionário · {prayerTitle(prayer)}
            </Link>
            <MarkdownRenderer
              markdown={prayerText(prayer, 'pt')}
              className="prose-prayer mt-3"
            />
          </div>
        )}

        {!practice.content && !practice.imageData && !practice.prayerId && (
          <EmptyState icon={FileText} message="Nenhum conteúdo adicionado" />
        )}
      </div>
    </div>
  )
}
