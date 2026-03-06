import { useState } from 'react'
import { useNavigate } from 'react-router'
import { ChevronLeft, Check, Sparkles } from 'lucide-react'
import { useUnconfessedEntries } from '../../hooks/useExamen'
import { formatDateShort, parseDate, formatDate, getToday } from '../../utils/dates'
import { Spinner } from '../shared/Spinner'
import { EmptyState } from '../shared/EmptyState'
import { ConfirmDialog } from '../shared/ConfirmDialog'

export function ConfessionView() {
  const navigate = useNavigate()
  const { entries, entriesByDate, isLoading, markAsConfessed } = useUnconfessedEntries()
  const [showConfirmDialog, setShowConfirmDialog] = useState(false)

  const handleMarkAllConfessed = async () => {
    const today = formatDate(getToday())
    const ids = entries.map((e) => e.id)
    await markAsConfessed(ids, today)
    setShowConfirmDialog(false)
  }

  if (isLoading) {
    return <Spinner className="h-64" />
  }

  const sortedDates = [...entriesByDate.keys()].sort((a, b) => b.localeCompare(a))

  return (
    <div className="min-h-full">
      <header className="sticky top-0 bg-surface-card dark:bg-surface-card-dark border-b border-border dark:border-border-dark z-10">
        <div className="flex items-center px-4 h-16">
          <button
            onClick={() => navigate(-1)}
            className="p-2 -ml-2 text-text-secondary dark:text-text-secondary-dark hover:bg-surface-secondary dark:hover:bg-surface-secondary-dark rounded-full transition-colors"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <h1 className="flex-1 text-center font-heading text-lg font-semibold text-text-primary dark:text-text-primary-dark">
            Preparação para Confissão
          </h1>
          <div className="w-10" />
        </div>
      </header>

      {entries.length === 0 ? (
        <EmptyState icon={Sparkles} message="Nenhum item pendente para confissão" />
      ) : (
        <>
          <div className="p-4 space-y-8">
            {sortedDates.map((date) => {
              const dateEntries = entriesByDate.get(date) ?? []
              return (
                <section key={date}>
                  <h3 className="font-heading text-xs font-medium text-text-muted dark:text-text-muted-dark uppercase tracking-widest mb-2">
                    {formatDateShort(parseDate(date))}
                  </h3>
                  <div className="space-y-2">
                    {dateEntries.map((entry) => (
                      <div
                        key={entry.id}
                        className="p-3 bg-surface-card dark:bg-surface-card-dark rounded-lg border border-border dark:border-border-dark border-l-[3px] border-l-[#9B6B6B]"
                      >
                        <p className="text-sm text-text-primary dark:text-text-primary-dark whitespace-pre-wrap">
                          {entry.text}
                        </p>
                      </div>
                    ))}
                  </div>
                </section>
              )
            })}
          </div>

          <div className="sticky bottom-0 p-4 bg-surface-card/95 dark:bg-surface-card-dark/95 backdrop-blur-sm border-t border-border dark:border-border-dark">
            <button
              onClick={() => setShowConfirmDialog(true)}
              className="w-full py-3 bg-success hover:bg-success-dark text-white font-medium rounded-lg transition-colors flex items-center justify-center gap-2"
            >
              <Check className="w-5 h-5" />
              Marcar tudo como confessado
            </button>
          </div>

          <ConfirmDialog
            isOpen={showConfirmDialog}
            title="Marcar como confessado"
            message={`Confirma que você confessou estes ${entries.length} itens?`}
            confirmLabel="Confirmar"
            onConfirm={handleMarkAllConfessed}
            onCancel={() => setShowConfirmDialog(false)}
          />
        </>
      )}
    </div>
  )
}
