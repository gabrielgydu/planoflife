import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router'
import { motion, AnimatePresence, type PanInfo } from 'motion/react'
import { X, Check, ChevronLeft, ChevronRight, MoreVertical, Pencil, Archive, Trash2 } from 'lucide-react'
import { CategoryIcon } from '../shared/CategoryIcon'
import { ConfirmDialog } from '../shared/ConfirmDialog'
import { MarkdownRenderer } from '../shared/MarkdownRenderer'
import { usePractices } from '../../hooks/usePractices'
import { getBundledText, PRACTICE_TEXT_LANG_KEY } from '../../data/bundledTexts'
import { resolveNovenaReaderText } from '../../data/novena'
import { resolveAngelusReaderText } from '../../data/angelus'
import { isLifestyle } from '../../utils/domain'
import type { Practice, Category } from '../../types'

interface PracticeWithCategory {
  practice: Practice
  category: Category
}

interface PracticeReaderProps {
  items: PracticeWithCategory[]
  initialPracticeId: string
  // The day being viewed in DailyView — drives date-dependent content (e.g. the
  // novena shows the reflection for whichever of its nine days this date is).
  viewDate: Date
  isCompleted: (practiceId: string) => boolean
  onTogglePractice: (practiceId: string) => void
  onMarkViewed: (practiceId: string) => void
  onClose: () => void
}

const SWIPE_THRESHOLD = 50
const VELOCITY_THRESHOLD = 500
const LANG_KEY = PRACTICE_TEXT_LANG_KEY

type Lang = 'pt' | 'la'

const LANG_LABELS: Record<Lang, string> = {
  pt: 'Portugues',
  la: 'Latim',
}

export function PracticeReader({
  items,
  initialPracticeId,
  viewDate,
  isCompleted,
  onTogglePractice,
  onMarkViewed,
  onClose,
}: PracticeReaderProps) {
  const navigate = useNavigate()
  const { archivePractice, deletePractice } = usePractices()
  const initialIndex = items.findIndex((i) => i.practice.id === initialPracticeId)
  const [currentIndex, setCurrentIndex] = useState(Math.max(0, initialIndex))
  const [direction, setDirection] = useState(0)
  const [menuOpen, setMenuOpen] = useState(false)
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)
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

  // Auto-mark each viewed practice as done (set-only; never un-marks). Fires on
  // open and on every navigation to a different practice. Lifestyle habits are
  // skipped: they stay in the pager so you can still read/swipe them, but paging
  // past one must NOT silently check it off — only the explicit ✓ marks a habit.
  useEffect(() => {
    const cur = items[currentIndex]
    if (cur && !isLifestyle(cur.practice)) onMarkViewed(cur.practice.id)
  }, [currentIndex, items, onMarkViewed])

  const goTo = useCallback(
    (next: number) => {
      if (next < 0 || next >= items.length) return
      setMenuOpen(false) // the menu acts on the CURRENT practice — never carry it over
      setDirection(next > currentIndex ? 1 : -1)
      setCurrentIndex(next)
    },
    [currentIndex, items.length],
  )

  const goPrev = useCallback(() => goTo(currentIndex - 1), [goTo, currentIndex])
  const goNext = useCallback(() => goTo(currentIndex + 1), [goTo, currentIndex])

  // All hooks are above this return: archiving/deleting from the menu below
  // shrinks `items`, and a re-render can hit this guard before onClose lands —
  // an early return after the hooks keeps React's hook order intact.
  const current = items[currentIndex]
  if (!current) return null

  const { practice, category } = current
  const completed = isCompleted(practice.id)
  // Date-dependent texts first: the Angelus becomes the Regina Coeli during
  // Eastertide, the novena resolves to the day matching viewDate; everything
  // else is a plain bundled-text lookup.
  const bundledText =
    resolveAngelusReaderText(practice, viewDate) ??
    resolveNovenaReaderText(practice, viewDate) ??
    getBundledText(practice.bundledTextId)
  const isBundled = !!bundledText

  const hasMultipleLangs = isBundled && Object.keys(bundledText.texts).length > 1
  const activeLang = isBundled && bundledText.texts[lang] ? lang : Object.keys(bundledText?.texts ?? {})[0] as Lang
  const toggleLang = () => setLang((l) => (l === 'pt' ? 'la' : 'pt'))
  const toggleLabel = lang === 'pt' ? LANG_LABELS.la : LANG_LABELS.pt

  const headerTitle = isBundled
    ? (bundledText.title[activeLang] ?? bundledText.title[Object.keys(bundledText.title)[0]])
    : practice.name

  const handleEdit = () => {
    setMenuOpen(false)
    navigate(`/settings/practices/${practice.id}/edit`)
  }

  // Archive = hide from the daily list (recoverable under Configurações →
  // Práticas → Arquivadas). Close afterwards: the practice leaves `items` and
  // the pager would silently land on a neighbor.
  const handleArchive = async () => {
    setMenuOpen(false)
    await archivePractice(practice.id)
    onClose()
  }

  const handleDelete = async () => {
    await deletePractice(practice.id)
    setShowDeleteDialog(false)
    onClose()
  }

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
    ? `${import.meta.env.BASE_URL}practice-images/${bundledText.id}.jpg`
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

          <div className="relative">
            <button
              onClick={() => setMenuOpen((o) => !o)}
              className="p-2 -mr-2 ml-1 text-text-secondary dark:text-text-secondary-dark hover:bg-surface-secondary dark:hover:bg-surface-secondary-dark rounded-full transition-colors"
              aria-label="Mais opções"
              aria-expanded={menuOpen}
            >
              <MoreVertical className="w-5 h-5" />
            </button>

            {menuOpen && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setMenuOpen(false)} />
                <div className="absolute right-0 top-full z-20 mt-1 w-52 py-1 bg-surface-card dark:bg-surface-card-dark border border-border dark:border-border-dark rounded-lg shadow-lg">
                  <button
                    onClick={handleEdit}
                    className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-left text-text-primary dark:text-text-primary-dark hover:bg-surface-secondary dark:hover:bg-surface-secondary-dark transition-colors"
                  >
                    <Pencil className="w-4 h-4 shrink-0" />
                    Editar prática
                  </button>
                  <button
                    onClick={handleArchive}
                    className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-left text-text-primary dark:text-text-primary-dark hover:bg-surface-secondary dark:hover:bg-surface-secondary-dark transition-colors"
                  >
                    <Archive className="w-4 h-4 shrink-0" />
                    Arquivar prática
                  </button>
                  <button
                    onClick={() => {
                      setMenuOpen(false)
                      setShowDeleteDialog(true)
                    }}
                    className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-left text-[#9B6B6B] dark:text-gray-400 hover:bg-surface-secondary dark:hover:bg-surface-secondary-dark transition-colors"
                  >
                    <Trash2 className="w-4 h-4 shrink-0" />
                    Excluir prática
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
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
            <div className="mx-auto w-full max-w-2xl">
              {imageSrc && (
                <div className="w-full flex justify-center bg-surface-secondary dark:bg-surface-secondary-dark">
                  <img
                    src={imageSrc}
                    alt={practice.name}
                    className="max-h-[40vh] w-auto max-w-full object-contain"
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
              ) : practice.content ? (
                <div
                  className="prose prose-slate dark:prose-invert max-w-full p-4"
                  dangerouslySetInnerHTML={{ __html: practice.content }}
                />
              ) : !imageSrc ? (
                <div className="flex items-center justify-center min-h-[50vh] px-8 text-center">
                  <p className="font-heading text-2xl font-medium text-text-secondary dark:text-text-secondary-dark">
                    {practice.name}
                  </p>
                </div>
              ) : null}
            </div>
          </motion.div>
        </AnimatePresence>

        {/* Language toggle button */}
        {hasMultipleLangs && (
          <button
            onClick={toggleLang}
            className="absolute bottom-4 right-4 px-4 py-2 rounded-full text-sm font-medium bg-surface-secondary text-text-primary dark:bg-surface-secondary-dark dark:text-text-primary-dark shadow-lg transition-transform active:scale-95 hover:bg-surface-secondary dark:hover:bg-surface-secondary-dark focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary dark:focus-visible:ring-primary-light"
          >
            {toggleLabel}
          </button>
        )}
      </div>

      {/* Footer */}
      <footer className="shrink-0 border-t border-border/30 dark:border-border-dark/30">
        <div className="flex items-center px-4 h-12 mx-auto w-full max-w-2xl">
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
        </div>
      </footer>

      <ConfirmDialog
        isOpen={showDeleteDialog}
        title="Excluir prática"
        message={`Excluir "${practice.name}" e todo o seu histórico? Esta ação não pode ser desfeita.`}
        confirmLabel="Excluir"
        variant="danger"
        onConfirm={handleDelete}
        onCancel={() => setShowDeleteDialog(false)}
      />
    </motion.div>
  )
}
