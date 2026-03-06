import { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence, type PanInfo } from 'motion/react'
import { X, Check, ChevronLeft, ChevronRight } from 'lucide-react'
import { CategoryIcon } from '../shared/CategoryIcon'
import { MarkdownRenderer } from '../shared/MarkdownRenderer'
import { getBundledText } from '../../data/bundledTexts'
import type { Practice, Category } from '../../types'

interface PracticeWithCategory {
  practice: Practice
  category: Category
}

interface PracticeReaderProps {
  items: PracticeWithCategory[]
  initialPracticeId: string
  isCompleted: (practiceId: string) => boolean
  onTogglePractice: (practiceId: string) => void
  onClose: () => void
}

const SWIPE_THRESHOLD = 50
const VELOCITY_THRESHOLD = 500
const LANG_KEY = 'practiceTextLang'

type Lang = 'pt' | 'la'

const LANG_LABELS: Record<Lang, string> = {
  pt: 'Portugues',
  la: 'Latim',
}

export function PracticeReader({
  items,
  initialPracticeId,
  isCompleted,
  onTogglePractice,
  onClose,
}: PracticeReaderProps) {
  const initialIndex = items.findIndex((i) => i.practice.id === initialPracticeId)
  const [currentIndex, setCurrentIndex] = useState(Math.max(0, initialIndex))
  const [direction, setDirection] = useState(0)
  const [lang, setLang] = useState<Lang>(() => {
    const saved = localStorage.getItem(LANG_KEY)
    return saved === 'la' ? 'la' : 'pt'
  })

  useEffect(() => {
    const original = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = original
    }
  }, [])

  useEffect(() => {
    localStorage.setItem(LANG_KEY, lang)
  }, [lang])

  const current = items[currentIndex]
  if (!current) return null

  const { practice, category } = current
  const completed = isCompleted(practice.id)
  const bundledText = getBundledText(practice.bundledTextId)
  const isBundled = !!bundledText

  const hasMultipleLangs = isBundled && Object.keys(bundledText.texts).length > 1
  const activeLang = isBundled && bundledText.texts[lang] ? lang : Object.keys(bundledText?.texts ?? {})[0] as Lang
  const toggleLang = () => setLang((l) => (l === 'pt' ? 'la' : 'pt'))
  const toggleLabel = lang === 'pt' ? LANG_LABELS.la : LANG_LABELS.pt

  const headerTitle = isBundled
    ? (bundledText.title[activeLang] ?? bundledText.title[Object.keys(bundledText.title)[0]])
    : practice.name

  const goTo = useCallback(
    (next: number) => {
      if (next < 0 || next >= items.length) return
      setDirection(next > currentIndex ? 1 : -1)
      setCurrentIndex(next)
    },
    [currentIndex, items.length],
  )

  const goPrev = useCallback(() => goTo(currentIndex - 1), [goTo, currentIndex])
  const goNext = useCallback(() => goTo(currentIndex + 1), [goTo, currentIndex])

  const handleDragEnd = (_: unknown, info: PanInfo) => {
    const { offset, velocity } = info
    if (offset.x < -SWIPE_THRESHOLD || velocity.x < -VELOCITY_THRESHOLD) {
      goNext()
    } else if (offset.x > SWIPE_THRESHOLD || velocity.x > VELOCITY_THRESHOLD) {
      goPrev()
    }
  }

  const slideVariants = {
    enter: (d: number) => ({ x: d > 0 ? '100%' : '-100%', opacity: 0 }),
    center: { x: 0, opacity: 1 },
    exit: (d: number) => ({ x: d > 0 ? '-100%' : '100%', opacity: 0 }),
  }

  const imageSrc = isBundled && bundledText.hasImage
    ? `${import.meta.env.BASE_URL}practice-images/${bundledText.id}.png`
    : practice.imageData

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2 }}
      className="fixed inset-0 z-50 flex flex-col bg-surface dark:bg-surface-dark"
    >
      {/* Header */}
      <header className="flex items-center px-4 h-14 shrink-0 border-b border-border/30 dark:border-border-dark/30">
        <button
          onClick={onClose}
          className="p-2 -ml-2 text-text-secondary dark:text-text-secondary-dark hover:bg-surface-secondary dark:hover:bg-surface-secondary-dark rounded-full transition-colors"
          aria-label="Fechar"
        >
          <X className="w-5 h-5" />
        </button>

        <h1 className="flex-1 text-center font-heading text-lg font-semibold text-text-primary dark:text-text-primary-dark truncate px-2">
          {headerTitle}
        </h1>

        <motion.button
          onClick={() => onTogglePractice(practice.id)}
          whileTap={{ scale: 1.15 }}
          transition={{ type: 'spring', stiffness: 400, damping: 15 }}
          className={`w-7 h-7 rounded-full flex items-center justify-center transition-all duration-200 ${
            completed
              ? 'bg-btn border-[1.5px] border-btn dark:bg-btn-dark dark:border-btn-dark'
              : 'border-[1.5px] border-border dark:border-border-dark'
          }`}
          aria-label={completed ? 'Desmarcar' : 'Marcar como feito'}
        >
          {completed && <Check className="w-4 h-4 text-btn-text dark:text-btn-dark-text" strokeWidth={3} />}
        </motion.button>
      </header>

      {/* Swipeable content */}
      <div className="flex-1 overflow-hidden relative">
        <AnimatePresence mode="wait" custom={direction}>
          <motion.div
            key={`${practice.id}-${activeLang}`}
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
            {imageSrc && (
              <div className="w-full max-h-[40vh] overflow-hidden bg-surface-secondary dark:bg-surface-secondary-dark">
                <img
                  src={imageSrc}
                  alt={practice.name}
                  className="w-full h-full object-contain"
                  draggable={false}
                />
              </div>
            )}

            {isBundled ? (
              <div className="p-5 pb-20">
                <MarkdownRenderer
                  markdown={bundledText.texts[activeLang] ?? ''}
                  className="prose-prayer"
                />
              </div>
            ) : (
              practice.content && (
                <div
                  className="prose prose-slate dark:prose-invert max-w-none p-4"
                  dangerouslySetInnerHTML={{ __html: practice.content }}
                />
              )
            )}
          </motion.div>
        </AnimatePresence>

        {/* Language toggle button */}
        {hasMultipleLangs && (
          <button
            onClick={toggleLang}
            className="absolute bottom-4 right-4 px-4 py-2 rounded-full text-sm font-medium text-white shadow-lg transition-transform active:scale-95"
            style={{ backgroundColor: '#41a6d9' }}
          >
            {toggleLabel}
          </button>
        )}
      </div>

      {/* Footer */}
      <footer className="flex items-center px-4 h-12 shrink-0 border-t border-border/30 dark:border-border-dark/30">
        <div className="flex items-center gap-1.5 min-w-0 flex-1">
          <CategoryIcon name={category.emoji} className="w-4 h-4 text-text-secondary dark:text-text-secondary-dark shrink-0" />
          <span className="text-xs text-text-secondary dark:text-text-secondary-dark truncate">
            {category.name}
          </span>
        </div>

        <span className="text-xs text-text-muted dark:text-text-muted-dark tabular-nums">
          {currentIndex + 1}/{items.length}
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
            disabled={currentIndex === items.length - 1}
            className="p-1.5 text-text-secondary dark:text-text-secondary-dark disabled:opacity-30 hover:bg-surface-secondary dark:hover:bg-surface-secondary-dark rounded-full transition-colors"
            aria-label="Próximo"
          >
            <ChevronRight className="w-5 h-5" />
          </button>
        </div>
      </footer>
    </motion.div>
  )
}
