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
      <header className="sticky top-0 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-700 z-10">
        <div className="flex items-center px-4 h-14">
          <button
            onClick={() => navigate(-1)}
            className="p-2 -ml-2 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-colors"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <h1 className="flex-1 text-center text-lg font-semibold text-slate-900 dark:text-slate-100">
            Preparação para Confissão
          </h1>
          <div className="w-10" />
        </div>
      </header>

      {entries.length === 0 ? (
        <EmptyState icon={Sparkles} message="Nenhum item pendente para confissão" />
      ) : (
        <>
          <div className="p-4 space-y-6">
            {sortedDates.map((date) => {
              const dateEntries = entriesByDate.get(date) ?? []
              return (
                <section key={date}>
                  <h3 className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">
                    {formatDateShort(parseDate(date))}
                  </h3>
                  <div className="space-y-2">
                    {dateEntries.map((entry) => (
                      <div
                        key={entry.id}
                        className="p-3 bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 border-l-4 border-l-red-500"
                      >
                        <p className="text-sm text-slate-900 dark:text-slate-100 whitespace-pre-wrap">
                          {entry.text}
                        </p>
                      </div>
                    ))}
                  </div>
                </section>
              )
            })}
          </div>

          <div className="sticky bottom-0 p-4 bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-700">
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
