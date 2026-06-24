import { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence, type PanInfo } from 'motion/react'
import { X, Check, ChevronLeft, ChevronRight, Dices, AlertCircle } from 'lucide-react'
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

const SWIPE_THRESHOLD = 50
const VELOCITY_THRESHOLD = 500

/**
 * The Meditação reader: three swipeable cards (Caminho / Sulco / Forja), all
 * showing the same day-number's Escrivá point. Clones PracticeReader's full-screen
 * swipe-pager scaffold; swaps the bundled-text machinery for the per-day point
 * lookup + a reroll button.
 */
export function MeditationView({
  practiceId,
  viewDate,
  isCompleted,
  onTogglePractice,
  onClose,
}: MeditationViewProps) {
  const dateStr = formatDate(viewDate)
  const { pointNumber, source, loading, drawing, reroll } = useMeditationDay(dateStr)
  const [points, setPoints] = useState<EscrivaPoints | null>(null)
  const [loadError, setLoadError] = useState(false)
  const [currentIndex, setCurrentIndex] = useState(0)
  const [direction, setDirection] = useState(0)

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

  const goTo = useCallback(
    (next: number) => {
      if (next < 0 || next >= BOOKS.length) return
      setDirection(next > currentIndex ? 1 : -1)
      setCurrentIndex(next)
    },
    [currentIndex],
  )
  const goPrev = useCallback(() => goTo(currentIndex - 1), [goTo, currentIndex])
  const goNext = useCallback(() => goTo(currentIndex + 1), [goTo, currentIndex])

  const handleDragEnd = (_: unknown, info: PanInfo) => {
    const { offset, velocity } = info
    if (offset.x < -SWIPE_THRESHOLD || velocity.x < -VELOCITY_THRESHOLD) goNext()
    else if (offset.x > SWIPE_THRESHOLD || velocity.x > VELOCITY_THRESHOLD) goPrev()
  }

  const slideVariants = {
    enter: (d: number) => ({ x: d > 0 ? '100%' : '-100%', opacity: 0 }),
    center: { x: 0, opacity: 1 },
    exit: (d: number) => ({ x: d > 0 ? '-100%' : '100%', opacity: 0 }),
  }

  const book = BOOKS[currentIndex]
  const completed = isCompleted(practiceId)
  const sourceLabel =
    source === 'random.org' ? 'random.org' : source === 'crypto' ? 'aleatório' : ''

  const showCard = !loadError && points !== null && pointNumber !== null
  const showSpinner = !loadError && (points === null || (pointNumber === null && loading))
  const showEmpty = !loadError && points !== null && pointNumber === null && !loading
  const text = showCard ? getEscrivaPoint(points, book.key, pointNumber) : null

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
            {book.label}
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
        ) : (
          <AnimatePresence mode="wait" custom={direction}>
            <motion.div
              key={book.key}
              custom={direction}
              variants={slideVariants}
              initial="enter"
              animate="center"
              exit="exit"
              transition={{ duration: 0.25, ease: 'easeInOut' }}
              drag="x"
              dragDirectionLock
              dragConstraints={{ left: 0, right: 0 }}
              dragElastic={0.15}
              onDragEnd={handleDragEnd}
              className="absolute inset-0 overflow-y-auto touch-pan-y"
            >
              <div className="mx-auto w-full max-w-2xl p-5 pb-24">
                <p className="mb-3 text-sm text-text-muted dark:text-text-muted-dark tabular-nums">
                  № {pointNumber}
                  {sourceLabel && (
                    <span className="text-text-muted dark:text-text-muted-dark"> · {sourceLabel}</span>
                  )}
                </p>
                {text ? (
                  <MarkdownRenderer markdown={text} className="prose-prayer" />
                ) : (
                  <p className="mt-16 text-center italic text-text-secondary dark:text-text-secondary-dark">
                    (sem ponto)
                  </p>
                )}
              </div>
            </motion.div>
          </AnimatePresence>
        )}

        {/* Reroll button — sorteia um novo ponto para o dia (também desenha o
            primeiro ponto num dia passado/futuro ainda sem sorteio). */}
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

      {/* Footer */}
      <footer className="shrink-0 border-t border-border/30 dark:border-border-dark/30">
        <div className="flex items-center px-4 h-12 mx-auto w-full max-w-2xl">
          <div className="flex-1" />
          <span className="text-xs text-text-muted dark:text-text-muted-dark tabular-nums">
            {currentIndex + 1}/{BOOKS.length}
          </span>
          <div className="flex items-center gap-1 flex-1 justify-end">
            <button
              onClick={goPrev}
              disabled={currentIndex === 0}
              className="p-1.5 text-text-secondary dark:text-text-secondary-dark disabled:opacity-30 hover:bg-surface-secondary dark:hover:bg-surface-secondary-dark rounded-full transition-colors"
              aria-label="Anterior"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
            <button
              onClick={goNext}
              disabled={currentIndex === BOOKS.length - 1}
              className="p-1.5 text-text-secondary dark:text-text-secondary-dark disabled:opacity-30 hover:bg-surface-secondary dark:hover:bg-surface-secondary-dark rounded-full transition-colors"
              aria-label="Próximo"
            >
              <ChevronRight className="w-5 h-5" />
            </button>
          </div>
        </div>
      </footer>
    </motion.div>
  )
}
