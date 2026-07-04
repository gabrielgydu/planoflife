import { useState, useEffect, useCallback, useMemo } from 'react'
import { motion, AnimatePresence, type PanInfo } from 'motion/react'
import { X, Check, ChevronLeft, ChevronRight } from 'lucide-react'
import { MarkdownRenderer } from '../shared/MarkdownRenderer'
import { getBundledText, PRACTICE_TEXT_LANG_KEY, type BundledText } from '../../data/bundledTexts'
import { ANTIPHON_TEXT_IDS, seasonalAntiphonIndex } from '../../data/antiphon'

const SWIPE_THRESHOLD = 50
const VELOCITY_THRESHOLD = 500

type Lang = 'pt' | 'la'

const LANG_LABELS: Record<Lang, string> = {
  pt: 'Portugues',
  la: 'Latim',
}

const slideVariants = {
  enter: (d: number) => ({ x: d > 0 ? '100%' : '-100%', opacity: 0 }),
  center: { x: 0, opacity: 1 },
  exit: (d: number) => ({ x: d > 0 ? '-100%' : '100%', opacity: 0 }),
}

interface AntiphonViewProps {
  practiceId: string
  // The day being viewed in DailyView — picks which antiphon the reader opens on
  // (the one proper to the liturgical season of that date).
  viewDate: Date
  isCompleted: (practiceId: string) => boolean
  onTogglePractice: (practiceId: string) => void
  onMarkViewed: (practiceId: string) => void
  onClose: () => void
}

/**
 * Full-screen reader for the four traditional Marian antiphons, opening on the
 * season-proper one and swipeable through all of them (fixed liturgical-year
 * order). Unlike the other overlays it auto-marks the practice on open, like the
 * text pager does — reading the antiphon IS the practice.
 */
export function AntiphonView({
  practiceId,
  viewDate,
  isCompleted,
  onTogglePractice,
  onMarkViewed,
  onClose,
}: AntiphonViewProps) {
  const slides = useMemo(
    () => ANTIPHON_TEXT_IDS.map((id) => getBundledText(id)).filter((t): t is BundledText => !!t),
    []
  )
  const seasonalIndex = useMemo(() => seasonalAntiphonIndex(viewDate), [viewDate])
  const [index, setIndex] = useState(() => Math.max(0, seasonalIndex))
  const [direction, setDirection] = useState(0)
  const [lang, setLang] = useState<Lang>(() => {
    const saved = localStorage.getItem(PRACTICE_TEXT_LANG_KEY)
    return saved === 'la' ? 'la' : 'pt'
  })

  // Lock body scroll: this is a full-screen reader.
  useEffect(() => {
    const original = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = original
    }
  }, [])

  useEffect(() => {
    localStorage.setItem(PRACTICE_TEXT_LANG_KEY, lang)
  }, [lang])

  // Auto-mark on open (set-only; never un-marks).
  useEffect(() => {
    onMarkViewed(practiceId)
  }, [onMarkViewed, practiceId])

  const goTo = useCallback(
    (next: number) => {
      if (next < 0 || next >= slides.length) return
      setDirection(next > index ? 1 : -1)
      setIndex(next)
    },
    [index, slides.length]
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

  const slide = slides[index]
  if (!slide) return null

  const activeLang: Lang = slide.texts[lang] ? lang : ('pt' as Lang)
  const toggleLang = () => setLang((l) => (l === 'pt' ? 'la' : 'pt'))
  const title = slide.title[activeLang] ?? slide.title.pt
  const completed = isCompleted(practiceId)

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2 }}
      className="fixed inset-0 z-50 flex flex-col bg-surface dark:bg-surface-dark"
    >
      {/* Header */}
      <header className="shrink-0 border-b border-border dark:border-border-dark pt-[var(--safe-area-top)]">
        <div className="flex items-center gap-1 px-2 h-14">
          <button
            onClick={onClose}
            className="p-2 text-text-secondary dark:text-text-secondary-dark hover:bg-surface-secondary dark:hover:bg-surface-secondary-dark rounded-full transition-colors"
            aria-label="Fechar"
          >
            <X className="w-5 h-5" />
          </button>
          <div className="flex-1 min-w-0 text-center">
            <p className="text-[10px] leading-none text-text-muted dark:text-text-muted-dark uppercase tracking-widest font-heading">
              Antífona da Virgem Maria
            </p>
            <h1 className="font-heading text-base font-semibold text-primary dark:text-primary-light truncate mt-0.5">
              {title}
            </h1>
          </div>
          <motion.button
            onClick={() => onTogglePractice(practiceId)}
            whileTap={{ scale: 1.15 }}
            transition={{ type: 'spring', stiffness: 400, damping: 15 }}
            className={`w-7 h-7 ml-1 shrink-0 rounded-full flex items-center justify-center transition-all duration-200 ${
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

      {/* Swipeable antiphon carousel */}
      <div className="flex-1 overflow-hidden relative">
        <AnimatePresence mode="wait" custom={direction}>
          <motion.div
            key={`${slide.id}-${activeLang}`}
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
            <div className="mx-auto w-full max-w-2xl p-5 pb-20">
              {index === seasonalIndex && (
                <p className="text-[11px] text-text-muted dark:text-text-muted-dark uppercase tracking-widest font-heading mb-3">
                  Própria do tempo litúrgico
                </p>
              )}
              <MarkdownRenderer markdown={slide.texts[activeLang] ?? ''} className="prose-prayer" />
            </div>
          </motion.div>
        </AnimatePresence>

        {/* Language toggle button */}
        <button
          onClick={toggleLang}
          className="absolute bottom-4 right-4 px-4 py-2 rounded-full text-sm font-medium bg-surface-secondary text-text-primary dark:bg-surface-secondary-dark dark:text-text-primary-dark shadow-lg transition-transform active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary dark:focus-visible:ring-primary-light"
        >
          {lang === 'pt' ? LANG_LABELS.la : LANG_LABELS.pt}
        </button>
      </div>

      {/* Footer: one dot per antiphon + prev/next */}
      <footer className="shrink-0 border-t border-border dark:border-border-dark pb-[var(--safe-area-bottom)]">
        <div className="flex items-center px-4 h-14 mx-auto w-full max-w-2xl">
          <button
            onClick={goPrev}
            disabled={index === 0}
            className="p-2 text-text-secondary dark:text-text-secondary-dark disabled:opacity-30 hover:bg-surface-secondary dark:hover:bg-surface-secondary-dark rounded-full transition-colors"
            aria-label="Antífona anterior"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>

          <div className="flex-1 flex items-center justify-center gap-1.5">
            {slides.map((s, i) => (
              <button
                key={s.id}
                onClick={() => goTo(i)}
                aria-label={`Ir para ${s.title.pt}`}
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
            disabled={index === slides.length - 1}
            className="p-2 text-text-secondary dark:text-text-secondary-dark disabled:opacity-30 hover:bg-surface-secondary dark:hover:bg-surface-secondary-dark rounded-full transition-colors"
            aria-label="Próxima antífona"
          >
            <ChevronRight className="w-5 h-5" />
          </button>
        </div>
      </footer>
    </motion.div>
  )
}
