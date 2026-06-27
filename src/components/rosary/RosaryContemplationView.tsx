import { useState, useEffect, useCallback, useMemo } from 'react'
import { ChevronLeft, ChevronRight, Shuffle, BookOpen, X, Check } from 'lucide-react'
import { motion, AnimatePresence, type PanInfo } from 'motion/react'
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

// Which set is prayed vocally on a given weekday, per the traditional schedule
// (Mon/Sat → Gozosos, Tue/Fri → Dolorosos, Wed/Sun → Gloriosos, Thu → Luminosos),
// derived from each set's vocalDays. The contemplation shows everything BUT this set.
const setByWeekday = (Object.keys(data.sets) as SetKey[]).reduce<Record<number, SetKey>>(
  (acc, key) => {
    for (const day of data.sets[key].vocalDays) acc[day] = key
    return acc
  },
  {},
)

// Canonical liturgical order (Joyful → Luminous → Sorrowful → Glorious). The
// contemplation walks the three NON-prayed sets in this order, so the swipe always
// starts at the first remaining group and ends at the last.
const SET_ORDER: SetKey[] = ['gozosos', 'luminosos', 'dolorosos', 'gloriosos']

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

interface Slide {
  setKey: SetKey
  setLabel: string
  mysteryIndex: number // position within its group (0-based)
  groupSize: number
  mystery: RosaryMystery
  imageCandidates: ImageCandidate[]
}

interface RosaryContemplationViewProps {
  // The practice id — drives the complete-toggle / streaks.
  practiceId: string
  // The day being viewed in DailyView; its weekday picks the prayed (excluded) set.
  viewDate: Date
  isCompleted: (practiceId: string) => boolean
  onTogglePractice: (practiceId: string) => void
  onClose: () => void
}

/**
 * Full-screen contemplation reader for the rosary mysteries NOT prayed on the
 * viewed day. The three remaining sets are flattened into one continuous sequence
 * of 15 mysteries; swiping left/right walks from the first group to the last. One
 * random Escrivá quote and one random painting per mystery, re-rolled on every open
 * and on demand (↻).
 */
export function RosaryContemplationView({
  practiceId,
  viewDate,
  isCompleted,
  onTogglePractice,
  onClose,
}: RosaryContemplationViewProps) {
  // Sets not prayed on the viewed weekday, in canonical order → three groups.
  const nonDaySets = useMemo(() => {
    const prayed = setByWeekday[viewDate.getDay()]
    return SET_ORDER.filter((k) => k !== prayed)
  }, [viewDate])

  // Flatten the three groups into one swipeable sequence of mysteries.
  const slides = useMemo<Slide[]>(() => {
    const out: Slide[] = []
    for (const key of nonDaySets) {
      const set = data.sets[key]
      const imgs = images[key] ?? []
      set.mysteries.forEach((mystery, i) =>
        out.push({
          setKey: key,
          setLabel: set.label,
          mysteryIndex: i,
          groupSize: set.mysteries.length,
          mystery,
          imageCandidates: imgs[i] ?? [],
        }),
      )
    }
    return out
  }, [nonDaySets])

  // One random quote AND one random image per slide, re-rolled fresh on every open
  // (mount) and on demand via the shuffle button.
  const roll = useCallback(
    () => ({
      quotes: slides.map((s) => randomItem(s.mystery.quotes)),
      imgs: slides.map((s) => (s.imageCandidates.length ? randomItem(s.imageCandidates) : undefined)),
    }),
    [slides],
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
      if (next < 0 || next >= slides.length) return
      setDirection(next > index ? 1 : -1)
      setIndex(next)
    },
    [index, slides.length],
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

  const slide = slides[index]
  const quote = picks.quotes[index]
  const img = picks.imgs[index]
  const imgSrc = img ? `${import.meta.env.BASE_URL}rosary-images/${img.f}` : undefined
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
              Contemplação do Rosário
            </p>
            <h1 className="font-heading text-base font-semibold text-primary dark:text-primary-light truncate mt-0.5">
              {slide.setLabel}
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
                    alt={slide.mystery.title}
                    className="max-h-[55vh] w-auto max-w-full object-contain select-none"
                    draggable={false}
                  />
                </div>
              )}

              <div className="px-6 py-6 space-y-3">
                <p className="text-[11px] text-text-muted dark:text-text-muted-dark uppercase tracking-widest font-heading">
                  Mistério {slide.mysteryIndex + 1} de {slide.groupSize}
                </p>
                <h2 className="font-heading text-2xl font-semibold text-text-primary dark:text-text-primary-dark">
                  {slide.mystery.title}
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
                  em ↻ para trocar. Contemplam-se hoje os mistérios que não são rezados no dia. Os
                  mistérios luminosos foram acrescentados após o texto original de 1934.
                </p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Footer: grouped dots (one cluster per set) + prev/next */}
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

          <div className="flex-1 flex items-center justify-center gap-3">
            {nonDaySets.map((key, gi) => {
              const base = gi * data.sets[key].mysteries.length
              return (
                <div key={key} className="flex items-center gap-1.5">
                  {data.sets[key].mysteries.map((m, mi) => {
                    const slideIdx = base + mi
                    return (
                      <button
                        key={m.title}
                        onClick={() => goTo(slideIdx)}
                        aria-label={`Ir para ${data.sets[key].label}, mistério ${mi + 1}`}
                        className={`h-2 rounded-full transition-all ${
                          slideIdx === index
                            ? 'w-5 bg-primary dark:bg-primary-light'
                            : 'w-2 bg-border dark:bg-border-dark'
                        }`}
                      />
                    )
                  })}
                </div>
              )
            })}
          </div>

          <button
            onClick={goNext}
            disabled={index === slides.length - 1}
            className="p-2 text-text-secondary dark:text-text-secondary-dark disabled:opacity-30 hover:bg-surface-secondary dark:hover:bg-surface-secondary-dark rounded-full transition-colors"
            aria-label="Próximo mistério"
          >
            <ChevronRight className="w-5 h-5" />
          </button>
        </div>
      </footer>
    </motion.div>
  )
}
