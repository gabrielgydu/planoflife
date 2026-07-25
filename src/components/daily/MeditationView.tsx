import { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence, type PanInfo } from 'motion/react'
import { X, Check, Dices, AlertCircle, ChevronLeft, ChevronRight } from 'lucide-react'
import { MarkdownRenderer } from '../shared/MarkdownRenderer'
import { Spinner } from '../shared/Spinner'
import {
  BOOKS,
  bookMax,
  getBookWindow,
  loadEscrivaPoints,
  getEscrivaPoint,
  type BookKey,
  type EscrivaPoints,
  type MeditacaoSlot,
} from '../../data/meditation'
import { useMeditationDay } from '../../hooks/useMeditationDay'
import { formatDate } from '../../utils/dates'

const SWIPE_THRESHOLD = 50
const VELOCITY_THRESHOLD = 500

// direction 0 = the content changed under the same page (a reroll) rather than a
// page move, so the slide cross-fades instead of sliding in from a side.
const slideVariants = {
  enter: (d: number) => ({ x: d > 0 ? '100%' : d < 0 ? '-100%' : 0, opacity: 0 }),
  center: { x: 0, opacity: 1 },
  exit: (d: number) => ({ x: d > 0 ? '-100%' : d < 0 ? '100%' : 0, opacity: 0 }),
}

// The swipe sequence: the three-book overview (what the reader always showed),
// then one page per book with the drawn point in context — `om`'s single-book mode.
interface Page {
  key: string
  label: string
  book: BookKey | null // null = the three-book overview
}
const PAGES: Page[] = [
  { key: 'todos', label: 'Três livros', book: null },
  ...BOOKS.map((b) => ({ key: b.key, label: b.label, book: b.key })),
]

// Pixels of the preceding point left visible above the drawn one when a book page
// opens: the day's point lands at the top, with a sliver hinting at what's above.
const PEEK = 56

interface MeditationViewProps {
  // The meditation practice id — drives the complete-toggle / streaks.
  practiceId: string
  // Which daily slot this reader is for; the point is drawn/stored per slot.
  slot: MeditacaoSlot
  // Header title — the practice's name ("Meditação" / "Meditação da Tarde").
  title: string
  // The day being viewed in DailyView; the drawn point is stored per this date.
  viewDate: Date
  isCompleted: (practiceId: string) => boolean
  onTogglePractice: (practiceId: string) => void
  onClose: () => void
}

/**
 * The Meditação reader: the day's point number across four swipeable pages. Page
 * one is the overview — the number in Caminho, Sulco and Forja stacked (the `om`
 * CLI's three boxes). Swiping on walks book by book, each showing that point with
 * the two before and the two after it, the drawn one highlighted — `om`'s
 * single-book mode. "Sortear" redraws the slot's number for the day.
 */
export function MeditationView({
  practiceId,
  slot,
  title,
  viewDate,
  isCompleted,
  onTogglePractice,
  onClose,
}: MeditationViewProps) {
  const dateStr = formatDate(viewDate)
  const { pointNumber, loading, drawing, reroll } = useMeditationDay(dateStr, slot)
  const [points, setPoints] = useState<EscrivaPoints | null>(null)
  const [loadError, setLoadError] = useState(false)
  const [index, setIndex] = useState(0)
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
      if (next < 0 || next >= PAGES.length) return
      setDirection(next > index ? 1 : -1)
      setIndex(next)
    },
    [index],
  )
  const goPrev = useCallback(() => goTo(index - 1), [goTo, index])
  const goNext = useCallback(() => goTo(index + 1), [goTo, index])

  // Arrow-key navigation (desktop / PWA on laptop).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft') goPrev()
      else if (e.key === 'ArrowRight') goNext()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [goPrev, goNext])

  const handleDragEnd = (_: unknown, info: PanInfo) => {
    const { offset, velocity } = info
    if (offset.x < -SWIPE_THRESHOLD || velocity.x < -VELOCITY_THRESHOLD) goNext()
    else if (offset.x > SWIPE_THRESHOLD || velocity.x > VELOCITY_THRESHOLD) goPrev()
  }

  const handleReroll = useCallback(() => {
    setDirection(0) // new number on the same page → cross-fade, not a side slide
    void reroll()
  }, [reroll])

  // A book page opens scrolled to the drawn point (the middle of five). Runs as a
  // ref callback so it fires once the slide's subtree is in the DOM — a plain
  // effect on `index` would run while the OUTGOING slide is still mounted.
  const focusDrawnPoint = useCallback((el: HTMLDivElement | null) => {
    if (!el) return
    const target = el.querySelector<HTMLElement>('[data-drawn="true"]')
    el.scrollTop = target ? Math.max(0, target.offsetTop - PEEK) : 0
  }, [])

  const completed = isCompleted(practiceId)
  const page = PAGES[index]
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
      <header className="shrink-0 border-b border-border/30 dark:border-border-dark/30 pt-[var(--safe-area-top)]">
        <div className="flex items-center px-4 h-14 mx-auto w-full max-w-2xl">
          <button
            onClick={onClose}
            className="p-2 -ml-2 text-text-secondary dark:text-text-secondary-dark hover:bg-surface-secondary dark:hover:bg-surface-secondary-dark rounded-full transition-colors"
            aria-label="Fechar"
          >
            <X className="w-5 h-5" />
          </button>

          {/* The practice name moves to the overline once there are pages, so the
              heading can name the page the swipe is on. */}
          <div className="flex-1 min-w-0 text-center px-2">
            {showPoints && (
              <p className="text-[10px] leading-none text-text-muted dark:text-text-muted-dark uppercase tracking-widest font-heading truncate">
                {title}
              </p>
            )}
            <h1 className="font-heading text-base font-semibold text-text-primary dark:text-text-primary-dark truncate mt-0.5">
              {showPoints ? page.label : title}
            </h1>
          </div>

          <motion.button
            onClick={() => onTogglePractice(practiceId)}
            whileTap={{ scale: 1.15 }}
            transition={{ type: 'spring', stiffness: 400, damping: 15 }}
            className={`w-7 h-7 shrink-0 rounded-full flex items-center justify-center transition-all duration-200 ${
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
          <AnimatePresence mode="wait" custom={direction}>
            <motion.div
              // The number is in the key so a reroll remounts the slide, which
              // re-runs focusDrawnPoint for the new point.
              key={`${page.key}:${pointNumber}`}
              ref={focusDrawnPoint}
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
              <div className="mx-auto w-full max-w-2xl px-5 py-5 pb-24">
                {page.book === null ? (
                  <OverviewPage points={points} pointNumber={pointNumber} />
                ) : (
                  <BookPage book={page.book} label={page.label} points={points} pointNumber={pointNumber} />
                )}
              </div>
            </motion.div>
          </AnimatePresence>
        ) : null}

        {/* Reroll — sorteia um novo ponto para o dia (também desenha o primeiro
            ponto num dia ainda sem sorteio). */}
        {points !== null && !loadError && (
          <button
            onClick={handleReroll}
            disabled={drawing}
            className="absolute bottom-4 right-4 flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium bg-surface-secondary text-text-primary dark:bg-surface-secondary-dark dark:text-text-primary-dark shadow-lg transition-transform active:scale-95 disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary dark:focus-visible:ring-primary-light"
            aria-label="Sortear novo ponto"
          >
            <Dices className={`w-4 h-4 ${drawing ? 'animate-spin' : ''}`} />
            <span>Sortear</span>
          </button>
        )}
      </div>

      {/* Footer: one dot per page (overview + three books) + prev/next */}
      {showPoints && (
        <footer className="shrink-0 border-t border-border/30 dark:border-border-dark/30 pb-[var(--safe-area-bottom)]">
          <div className="flex items-center px-4 h-14 mx-auto w-full max-w-2xl">
            <button
              onClick={goPrev}
              disabled={index === 0}
              className="p-2 text-text-secondary dark:text-text-secondary-dark disabled:opacity-30 hover:bg-surface-secondary dark:hover:bg-surface-secondary-dark rounded-full transition-colors"
              aria-label="Página anterior"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>

            <div className="flex-1 flex items-center justify-center gap-1.5">
              {PAGES.map((p, i) => (
                <button
                  key={p.key}
                  onClick={() => goTo(i)}
                  aria-label={`Ir para ${p.label}`}
                  aria-current={i === index ? 'true' : undefined}
                  className={`h-2 rounded-full transition-all ${
                    i === index
                      ? 'w-5 bg-primary dark:bg-primary-light'
                      : 'w-2 bg-border dark:bg-border-dark'
                  }`}
                />
              ))}
            </div>

            <button
              onClick={goNext}
              disabled={index === PAGES.length - 1}
              className="p-2 text-text-secondary dark:text-text-secondary-dark disabled:opacity-30 hover:bg-surface-secondary dark:hover:bg-surface-secondary-dark rounded-full transition-colors"
              aria-label="Próxima página"
            >
              <ChevronRight className="w-5 h-5" />
            </button>
          </div>
        </footer>
      )}
    </motion.div>
  )
}

/** Page one: the drawn number in all three books, stacked. */
function OverviewPage({ points, pointNumber }: { points: EscrivaPoints; pointNumber: number }) {
  return (
    <>
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

      <p className="mt-10 text-center text-xs text-text-muted dark:text-text-muted-dark">
        Deslize para ler cada livro com os pontos vizinhos.
      </p>
    </>
  )
}

/** One book, the drawn point in context: two points before, two after. */
function BookPage({
  book,
  label,
  points,
  pointNumber,
}: {
  book: BookKey
  label: string
  points: EscrivaPoints
  pointNumber: number
}) {
  const { numbers, hasDrawn } = getBookWindow(book, pointNumber)

  return (
    <>
      {!hasDrawn && (
        <p className="mb-6 rounded-xl bg-surface-secondary dark:bg-surface-secondary-dark px-4 py-3 text-sm text-text-secondary dark:text-text-secondary-dark">
          {label} vai só até o № {bookMax(book)}, portanto não tem o ponto № {pointNumber}. Abaixo,
          os últimos pontos do livro.
        </p>
      )}

      {numbers.map((n, i) => {
        const drawn = n === pointNumber
        const text = getEscrivaPoint(points, book, n)
        return (
          <section
            key={n}
            data-drawn={drawn ? 'true' : undefined}
            className={
              i > 0 ? 'mt-7 pt-7 border-t border-border/40 dark:border-border-dark/40' : undefined
            }
          >
            <h2 className="mb-3 flex items-center gap-2 font-heading text-xs uppercase tracking-widest">
              <span
                className={
                  drawn
                    ? 'font-semibold text-text-primary dark:text-text-primary-dark tabular-nums'
                    : 'text-text-muted dark:text-text-muted-dark tabular-nums'
                }
              >
                № {n}
              </span>
              {drawn && (
                <span className="rounded-full bg-surface-secondary dark:bg-surface-secondary-dark px-2 py-0.5 text-[10px] tracking-wide text-text-secondary dark:text-text-secondary-dark">
                  ponto do dia
                </span>
              )}
            </h2>
            {text ? (
              <MarkdownRenderer
                markdown={text}
                className={drawn ? 'prose-prayer' : 'prose-prayer opacity-55'}
              />
            ) : (
              <p className="italic text-text-muted dark:text-text-muted-dark">(sem ponto)</p>
            )}
          </section>
        )
      })}
    </>
  )
}
