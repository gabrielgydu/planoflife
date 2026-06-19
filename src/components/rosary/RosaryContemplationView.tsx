import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router'
import { ChevronLeft, ChevronRight, Shuffle, BookOpen, X } from 'lucide-react'
import { motion, AnimatePresence, type PanInfo } from 'motion/react'
import { getToday } from '../../utils/dates'
import rosaryRaw from '../../data/rosary_contemplation.json'
import rosaryImagesRaw from '../../data/rosary_images.json'

type SetKey = 'gozosos' | 'dolorosos' | 'gloriosos' | 'luminosos'
interface RosaryMystery {
  title: string
  quotes: string[]
}
interface RosarySet {
  label: string
  vocalDays: number[]
  mysteries: RosaryMystery[]
}
interface RosaryData {
  prologo: { title: string; author: string; date: string | null; paragraphs: string[] }
  nonDaySetByWeekday: Record<string, SetKey>
  sets: Record<SetKey, RosarySet>
}
interface ImageCandidate {
  f: string // path relative to /rosary-images/, e.g. "gozosos/1-a-anunciacao-1.jpg"
  a: string // painter (caption)
}

const data = rosaryRaw as unknown as RosaryData
// Per set: one array of candidate images per mystery (index-aligned to sets.mysteries).
const images = rosaryImagesRaw as unknown as Record<SetKey, ImageCandidate[][]>

const SWIPE_THRESHOLD = 50
const VELOCITY_THRESHOLD = 500

function randomItem<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]
}

const slideVariants = {
  enter: (d: number) => ({ x: d > 0 ? '100%' : '-100%', opacity: 0 }),
  center: { x: 0, opacity: 1 },
  exit: (d: number) => ({ x: d > 0 ? '-100%' : '100%', opacity: 0 }),
}

export function RosaryContemplationView() {
  const navigate = useNavigate()

  const weekday = getToday().getDay() // 0=Sun … 6=Sat
  const setKey = data.nonDaySetByWeekday[String(weekday)]
  const set = data.sets[setKey]
  const imageSet = images[setKey] ?? []

  // One random quote AND one random image per mystery, re-rolled fresh on every
  // open (mount) and on demand via the shuffle button.
  const roll = useCallback(
    () => ({
      quotes: set.mysteries.map((m) => randomItem(m.quotes)),
      imgs: set.mysteries.map((_, i) => (imageSet[i]?.length ? randomItem(imageSet[i]) : undefined)),
    }),
    [set, imageSet],
  )
  const [picks, setPicks] = useState(roll)
  const [index, setIndex] = useState(0)
  const [direction, setDirection] = useState(0)
  const [showPrologo, setShowPrologo] = useState(false)

  // Lock body scroll: this is a full-screen reader.
  useEffect(() => {
    const original = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = original
    }
  }, [])

  const goTo = useCallback(
    (next: number) => {
      if (next < 0 || next >= set.mysteries.length) return
      setDirection(next > index ? 1 : -1)
      setIndex(next)
    },
    [index, set.mysteries.length],
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

  const reshuffle = () => {
    setPicks(roll())
    setShowPrologo(false)
  }

  const mystery = set.mysteries[index]
  const quote = picks.quotes[index]
  const img = picks.imgs[index]
  const imgSrc = img ? `${import.meta.env.BASE_URL}rosary-images/${img.f}` : undefined

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-surface dark:bg-surface-dark">
      {/* Header */}
      <header className="shrink-0 border-b border-border dark:border-border-dark pt-[var(--safe-area-top)]">
        <div className="flex items-center gap-2 px-3 h-14">
          <button
            onClick={() => navigate(-1)}
            className="p-2 text-text-secondary dark:text-text-secondary-dark hover:bg-surface-secondary dark:hover:bg-surface-secondary-dark rounded-full transition-colors"
            aria-label="Voltar"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <div className="flex-1 min-w-0 text-center">
            <p className="text-[10px] leading-none text-text-muted dark:text-text-muted-dark uppercase tracking-widest font-heading">
              Contemplação do Rosário
            </p>
            <h1 className="font-heading text-base font-semibold text-primary dark:text-primary-light truncate mt-0.5">
              {set.label}
            </h1>
          </div>
          <button
            onClick={() => setShowPrologo(true)}
            className="p-2 text-text-secondary dark:text-text-secondary-dark hover:bg-surface-secondary dark:hover:bg-surface-secondary-dark rounded-full transition-colors"
            aria-label="Prólogo"
          >
            <BookOpen className="w-5 h-5" />
          </button>
          <button
            onClick={reshuffle}
            className="p-2 text-text-secondary dark:text-text-secondary-dark hover:bg-surface-secondary dark:hover:bg-surface-secondary-dark rounded-full transition-colors"
            aria-label="Trocar citações e imagens"
          >
            <Shuffle className="w-5 h-5" />
          </button>
        </div>
      </header>

      {/* Swipeable mystery carousel */}
      <div className="flex-1 overflow-hidden relative">
        <AnimatePresence mode="wait" custom={direction}>
          <motion.div
            key={index}
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
              {imgSrc && (
                <div className="w-full flex justify-center bg-surface-secondary dark:bg-surface-secondary-dark">
                  <img
                    src={imgSrc}
                    alt={mystery.title}
                    className="max-h-[55vh] w-auto max-w-full object-contain select-none"
                    draggable={false}
                  />
                </div>
              )}

              <div className="px-6 py-6 space-y-3">
                <p className="text-[11px] text-text-muted dark:text-text-muted-dark uppercase tracking-widest font-heading">
                  Mistério {index + 1} de {set.mysteries.length}
                </p>
                <h2 className="font-heading text-2xl font-semibold text-text-primary dark:text-text-primary-dark">
                  {mystery.title}
                </h2>
                <p className="text-lg italic text-text-secondary dark:text-text-secondary-dark leading-relaxed">
                  {quote}
                </p>
                {img?.a && (
                  <p className="text-xs text-text-muted dark:text-text-muted-dark pt-1">
                    Arte: {img.a}
                  </p>
                )}
              </div>
            </div>
          </motion.div>
        </AnimatePresence>

        {/* Prólogo overlay */}
        <AnimatePresence>
          {showPrologo && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="absolute inset-0 z-20 bg-surface dark:bg-surface-dark overflow-y-auto"
            >
              <div className="mx-auto w-full max-w-2xl px-6 py-5">
                <div className="flex items-center justify-between mb-3">
                  <h2 className="font-heading text-lg font-semibold text-text-primary dark:text-text-primary-dark">
                    Prólogo — São Josemaria
                  </h2>
                  <button
                    onClick={() => setShowPrologo(false)}
                    className="p-2 -mr-2 text-text-secondary dark:text-text-secondary-dark hover:bg-surface-secondary dark:hover:bg-surface-secondary-dark rounded-full transition-colors"
                    aria-label="Fechar"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
                <div className="space-y-3">
                  {data.prologo.paragraphs.map((p, i) => (
                    <p key={i} className="text-sm text-text-secondary dark:text-text-secondary-dark leading-relaxed">
                      {p}
                    </p>
                  ))}
                </div>
                <p className="text-xs text-text-muted dark:text-text-muted-dark leading-relaxed mt-6 pt-4 border-t border-border dark:border-border-dark">
                  Citações de «Santo Rosário», de São Josemaria. Uma frase ao acaso por mistério — toque
                  em ↻ para trocar.
                  {setKey === 'luminosos' &&
                    ' Os mistérios luminosos foram acrescentados após o texto original de 1934.'}
                </p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Footer: position + dots + prev/next */}
      <footer className="shrink-0 border-t border-border dark:border-border-dark pb-[var(--safe-area-bottom)]">
        <div className="flex items-center px-4 h-14 mx-auto w-full max-w-2xl">
          <button
            onClick={goPrev}
            disabled={index === 0}
            className="p-2 text-text-secondary dark:text-text-secondary-dark disabled:opacity-30 hover:bg-surface-secondary dark:hover:bg-surface-secondary-dark rounded-full transition-colors"
            aria-label="Mistério anterior"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>

          <div className="flex-1 flex items-center justify-center gap-2">
            {set.mysteries.map((m, i) => (
              <button
                key={m.title}
                onClick={() => goTo(i)}
                aria-label={`Ir para mistério ${i + 1}`}
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
            disabled={index === set.mysteries.length - 1}
            className="p-2 text-text-secondary dark:text-text-secondary-dark disabled:opacity-30 hover:bg-surface-secondary dark:hover:bg-surface-secondary-dark rounded-full transition-colors"
            aria-label="Próximo mistério"
          >
            <ChevronRight className="w-5 h-5" />
          </button>
        </div>
      </footer>
    </div>
  )
}
