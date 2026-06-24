import { useState, useEffect, useCallback } from 'react'
import { motion } from 'motion/react'
import { X, Check, Dices, AlertCircle } from 'lucide-react'
import { MarkdownRenderer } from '../shared/MarkdownRenderer'
import { Spinner } from '../shared/Spinner'
import {
  BOOKS,
  loadEscrivaPoints,
  getEscrivaPoint,
  type EscrivaPoints,
} from '../../data/meditation'
import { useMeditationDay } from '../../hooks/useMeditationDay'
import { formatDate } from '../../utils/dates'

interface MeditationViewProps {
  // The seeded "Meditação" practice id — drives the complete-toggle / streaks.
  practiceId: string
  // The day being viewed in DailyView; the drawn point is stored per this date.
  viewDate: Date
  isCompleted: (practiceId: string) => boolean
  onTogglePractice: (practiceId: string) => void
  onClose: () => void
}

/**
 * The Meditação reader: the day's single point number shown across all three
 * books — Caminho, Sulco, Forja — stacked on one scrollable page (like the `om`
 * CLI's three boxes). A "Sortear" button redraws the day's number.
 */
export function MeditationView({
  practiceId,
  viewDate,
  isCompleted,
  onTogglePractice,
  onClose,
}: MeditationViewProps) {
  const dateStr = formatDate(viewDate)
  const { pointNumber, loading, drawing, reroll } = useMeditationDay(dateStr)
  const [points, setPoints] = useState<EscrivaPoints | null>(null)
  const [loadError, setLoadError] = useState(false)

  // Lazy-load the bundled point text. Retryable: a failed dynamic import clears
  // its cached promise (see loadEscrivaPoints), so loadPoints() re-imports.
  const loadPoints = useCallback(() => {
    setLoadError(false)
    loadEscrivaPoints()
      .then(setPoints)
      .catch(() => setLoadError(true))
  }, [])

  useEffect(() => {
    loadPoints()
  }, [loadPoints])

  // Lock background scroll behind the full-screen overlay.
  useEffect(() => {
    const original = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = original
    }
  }, [])

  const completed = isCompleted(practiceId)
  const showPoints = !loadError && points !== null && pointNumber !== null
  const showSpinner = !loadError && (points === null || (pointNumber === null && loading))
  const showEmpty = !loadError && points !== null && pointNumber === null && !loading

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2 }}
      className="fixed inset-0 z-50 flex flex-col bg-surface dark:bg-surface-dark"
    >
      {/* Header */}
      <header className="shrink-0 border-b border-border/30 dark:border-border-dark/30">
        <div className="flex items-center px-4 h-14 mx-auto w-full max-w-2xl">
          <button
            onClick={onClose}
            className="p-2 -ml-2 text-text-secondary dark:text-text-secondary-dark hover:bg-surface-secondary dark:hover:bg-surface-secondary-dark rounded-full transition-colors"
            aria-label="Fechar"
          >
            <X className="w-5 h-5" />
          </button>

          <h1 className="flex-1 text-center font-heading text-lg font-semibold text-text-primary dark:text-text-primary-dark truncate px-2">
            Meditação
          </h1>

          <motion.button
            onClick={() => onTogglePractice(practiceId)}
            whileTap={{ scale: 1.15 }}
            transition={{ type: 'spring', stiffness: 400, damping: 15 }}
            className={`w-7 h-7 rounded-full flex items-center justify-center transition-all duration-200 ${
              completed
                ? 'bg-btn border-[1.5px] border-btn dark:bg-btn-dark dark:border-btn-dark'
                : 'border-[1.5px] border-border dark:border-border-dark'
            }`}
            aria-label={completed ? 'Desmarcar' : 'Marcar como feito'}
          >
            {completed && (
              <Check className="w-4 h-4 text-btn-text dark:text-btn-dark-text" strokeWidth={3} />
            )}
          </motion.button>
        </div>
      </header>

      {/* Content */}
      <div className="flex-1 overflow-hidden relative">
        {loadError ? (
          <div className="flex flex-col h-full items-center justify-center gap-4 px-8 text-center">
            <AlertCircle className="w-8 h-8 text-text-muted dark:text-text-muted-dark" />
            <p className="text-text-secondary dark:text-text-secondary-dark">
              Não foi possível carregar os textos.
            </p>
            <button
              onClick={loadPoints}
              className="px-4 py-2 rounded-full text-sm font-medium bg-surface-secondary text-text-primary dark:bg-surface-secondary-dark dark:text-text-primary-dark transition-transform active:scale-95"
            >
              Tentar novamente
            </button>
          </div>
        ) : showSpinner ? (
          <Spinner className="h-full" />
        ) : showEmpty ? (
          <div className="flex flex-col h-full items-center justify-center gap-1 px-8 text-center">
            <p className="text-text-secondary dark:text-text-secondary-dark">
              Nenhum ponto sorteado para este dia.
            </p>
            <p className="text-sm text-text-muted dark:text-text-muted-dark">
              Toque em Sortear para escolher um ponto.
            </p>
          </div>
        ) : showPoints ? (
          <div className="absolute inset-0 overflow-y-auto">
            <div className="mx-auto w-full max-w-2xl px-5 py-5 pb-24">
              <p className="mb-6 text-center text-sm text-text-muted dark:text-text-muted-dark tabular-nums">
                № {pointNumber}
              </p>

              {BOOKS.map((b, i) => {
                const text = getEscrivaPoint(points, b.key, pointNumber)
                return (
                  <section key={b.key} className={i > 0 ? 'mt-8' : undefined}>
                    <h2 className="mb-3 pb-1.5 border-b border-border/40 dark:border-border-dark/40 font-heading text-sm font-semibold uppercase tracking-wide text-text-secondary dark:text-text-secondary-dark">
                      {b.label}
                    </h2>
                    {text ? (
                      <MarkdownRenderer markdown={text} className="prose-prayer" />
                    ) : (
                      <p className="italic text-text-muted dark:text-text-muted-dark">(sem ponto)</p>
                    )}
                  </section>
                )
              })}
            </div>
          </div>
        ) : null}

        {/* Reroll — sorteia um novo ponto para o dia (também desenha o primeiro
            ponto num dia ainda sem sorteio). */}
        {points !== null && !loadError && (
          <button
            onClick={reroll}
            disabled={drawing}
            className="absolute bottom-4 right-4 flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium bg-surface-secondary text-text-primary dark:bg-surface-secondary-dark dark:text-text-primary-dark shadow-lg transition-transform active:scale-95 disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary dark:focus-visible:ring-primary-light"
            aria-label="Sortear novo ponto"
          >
            <Dices className={`w-4 h-4 ${drawing ? 'animate-spin' : ''}`} />
            <span>Sortear</span>
          </button>
        )}
      </div>
    </motion.div>
  )
}
