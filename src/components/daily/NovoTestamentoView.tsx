import { useState, useEffect, useLayoutEffect, useCallback, useRef, useMemo } from 'react'
import { motion, AnimatePresence, type PanInfo } from 'motion/react'
import { X, Check, ChevronLeft, ChevronRight, ChevronDown } from 'lucide-react'
import { Spinner } from '../shared/Spinner'
import { NtBookPicker } from './NtBookPicker'
import { useReadingPosition } from '../../hooks/useReadingPosition'
import { NT_READING_ID } from '../../data/novoTestamento'
import { NT_BOOKS, NT_FIRST_BOOK, getNtBook, nextNtBook, prevNtBook } from '../../data/nt/books'
import { loadNtBook, chapterNumbers, clampToBook, type NtBookText } from '../../data/nt'

const SWIPE_THRESHOLD = 60
const VELOCITY_THRESHOLD = 500
// How long the anchor must hold still before the bookmark is written. Every write
// marks the sync state dirty and schedules an encrypted push, so this is
// deliberately longer than a flick.
const SAVE_DEBOUNCE_MS = 800
// Programmatic scrolls settle within a frame or two; ignore anchor reports until
// then so a restore can't overwrite the position it just restored.
const RESTORE_SETTLE_MS = 250
// Distance from the top of the viewport at which a verse counts as "where I am".
const ANCHOR_OFFSET_PX = 12

type NtLang = 'pt' | 'la' | 'both'

// Device-local, deliberately NOT synced and deliberately NOT the shared
// PRACTICE_TEXT_LANG_KEY: this reader has a third mode the prayer readers don't
// understand, and writing 'both' into the shared key would silently degrade them.
const NT_LANG_KEY = 'ntReaderLang'

const LANG_OPTIONS: { value: NtLang; label: string; aria: string }[] = [
  { value: 'pt', label: 'PT', aria: 'Português' },
  { value: 'la', label: 'LA', aria: 'Latim' },
  { value: 'both', label: 'PT·LA', aria: 'Português e latim' },
]

function readSavedLang(): NtLang {
  const saved = localStorage.getItem(NT_LANG_KEY)
  return saved === 'la' || saved === 'both' ? saved : 'pt'
}

interface NovoTestamentoViewProps {
  practiceId: string
  isCompleted: (practiceId: string) => boolean
  onTogglePractice: (practiceId: string) => void
  onClose: () => void
}

/**
 * Full-screen reader for "Leitura do Novo Testamento": the whole New Testament in
 * Portuguese (Pe. Matos Soares, 1956) and the Clementine Vulgate, one book per
 * continuous scroll, swipe to change book.
 *
 * The point of the thing is resuming: the verse at the top of the viewport is saved
 * (debounced) to db.readingPositions, which syncs, so five minutes on the phone
 * this morning and five on the laptop tomorrow are one continuous read-through.
 * Completion is MANUAL (header checkmark) — opening the reader to look something up
 * must not claim the day's reading was done.
 */
export function NovoTestamentoView({
  practiceId,
  isCompleted,
  onTogglePractice,
  onClose,
}: NovoTestamentoViewProps) {
  const { position, loading: positionLoading, save } = useReadingPosition(NT_READING_ID)

  const [bookKey, setBookKey] = useState<string | null>(null)
  const [book, setBook] = useState<NtBookText | null>(null)
  const [lang, setLang] = useState<NtLang>(readSavedLang)
  const [current, setCurrent] = useState<{ chapter: number; verse: number }>({ chapter: 1, verse: 1 })
  const [pickerOpen, setPickerOpen] = useState(false)
  const [direction, setDirection] = useState(0)

  const scrollRef = useRef<HTMLDivElement>(null)
  // Where the next render should scroll to. Also the anchor a language switch
  // re-lands on, so changing mode never loses your place.
  const restoreRef = useRef<{ chapter: number; verse: number }>({ chapter: 1, verse: 1 })
  const restoringUntilRef = useRef(0)
  const initializedRef = useRef(false)
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  // Latest anchor, for the flush-on-close path (state would be stale in cleanup).
  const latestRef = useRef<{ book: string; chapter: number; verse: number } | null>(null)

  // --- open at the saved position -------------------------------------------
  // Runs ONCE, after the position query resolves. Deliberately not reactive to
  // later changes: a snapshot pulled from the other device mid-read must not yank
  // the page out from under you.
  useEffect(() => {
    if (initializedRef.current || positionLoading) return
    initializedRef.current = true
    const startBook = (position && getNtBook(position.book) ? position.book : NT_FIRST_BOOK.key)
    const startAt = position
      ? { chapter: position.chapter, verse: position.verse }
      : { chapter: 1, verse: 1 }
    restoreRef.current = startAt
    setCurrent(startAt)
    setBookKey(startBook)
  }, [positionLoading, position])

  // --- load the book's text --------------------------------------------------
  useEffect(() => {
    if (!bookKey) return
    let cancelled = false
    setBook(null)
    loadNtBook(bookKey).then((loaded) => {
      if (cancelled) return
      if (!loaded) {
        // Unknown/removed chunk — fall back to the start of the NT rather than
        // leaving the reader stuck on a spinner.
        setBookKey(NT_FIRST_BOOK.key)
        restoreRef.current = { chapter: 1, verse: 1 }
        return
      }
      restoreRef.current = clampToBook(loaded, restoreRef.current.chapter, restoreRef.current.verse)
      setBook(loaded)
    })
    return () => {
      cancelled = true
    }
  }, [bookKey])

  useEffect(() => {
    localStorage.setItem(NT_LANG_KEY, lang)
  }, [lang])

  // Lock body scroll: this is a full-screen reader.
  useEffect(() => {
    const original = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = original
    }
  }, [])

  const scrollToVerse = useCallback((chapter: number, verse: number) => {
    const container = scrollRef.current
    if (!container) return
    // Landing on a chapter's first verse should show the "CAPÍTULO N" marker above
    // it — otherwise resuming at 5,1 hides the very heading that tells you where
    // you are. Any other verse anchors on itself.
    const el =
      container.querySelector<HTMLElement>(`[data-chapter-head="${chapter}"][data-first-verse="${verse}"]`) ??
      container.querySelector<HTMLElement>(`[data-c="${chapter}"][data-v="${verse}"]`)
    if (!el) return
    restoringUntilRef.current = Date.now() + RESTORE_SETTLE_MS
    const delta = el.getBoundingClientRect().top - container.getBoundingClientRect().top
    container.scrollTop += delta - ANCHOR_OFFSET_PX
  }, [])

  // Restore the anchor after the text for a book (or a language mode) renders.
  // Layout effect so the jump happens before paint — no flash of chapter 1.
  //
  // This is why the text is NOT wrapped in AnimatePresence: with mode="wait" the
  // incoming content mounts only after the outgoing one finishes animating, so this
  // effect would measure the OLD DOM and land somewhere else entirely (switching to
  // Latin drifted several verses; to interlinear, several chapters). A keyed
  // motion.div re-mounts within the same commit, so the elements measured here are
  // the ones about to be painted.
  useLayoutEffect(() => {
    if (!book) return
    const { chapter, verse } = restoreRef.current
    scrollToVerse(chapter, verse)
  }, [book, lang, scrollToVerse])

  // --- track the verse at the top of the viewport -----------------------------
  useEffect(() => {
    const container = scrollRef.current
    if (!book || !container) return
    const targets = container.querySelectorAll<HTMLElement>('[data-v]')
    if (targets.length === 0) return

    // Only the top sliver of the viewport is the observation zone, so only a couple
    // of verses are ever in play. Which of them is "where I am" is NOT the one with
    // the smallest top: a verse's rect spans every line it wraps onto, so a verse
    // starting far above but still ending below the top edge would always win and
    // the anchor would creep backwards one verse per restore. See the rule below.
    const visible = new Set<HTMLElement>()
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          const el = entry.target as HTMLElement
          if (entry.isIntersecting) visible.add(el)
          else visible.delete(el)
        }
        // Live rects, not entry.boundingClientRect: the latter is a snapshot from
        // when the threshold was crossed and is stale by the time a fast scroll
        // settles.
        const edge = container.getBoundingClientRect().top + ANCHOR_OFFSET_PX + 2
        let above: HTMLElement | null = null
        let aboveTop = -Infinity
        let below: HTMLElement | null = null
        let belowTop = Infinity
        for (const el of visible) {
          const { top, bottom } = el.getBoundingClientRect()
          // Must actually COVER the edge to count as "the verse I'm looking at".
          // A verse that has scrolled entirely past the top is not where you are —
          // that distinction is what makes jumping to a chapter report the chapter
          // you jumped to rather than the tail of the one before it.
          if (top <= edge && bottom > edge) {
            if (top > aboveTop) {
              aboveTop = top
              above = el
            }
          } else if (top > edge && top < belowTop) {
            belowTop = top
            below = el
          }
        }
        const chosen = above ?? below
        if (!chosen) return
        const next = { chapter: Number(chosen.dataset.c), verse: Number(chosen.dataset.v) }
        setCurrent((prev) => (prev.chapter === next.chapter && prev.verse === next.verse ? prev : next))
      },
      { root: container, rootMargin: '0px 0px -88% 0px', threshold: 0 }
    )
    for (const t of targets) observer.observe(t)
    return () => observer.disconnect()
  }, [book, lang])

  // --- persist the anchor (debounced) -----------------------------------------
  useEffect(() => {
    if (!bookKey || !book) return
    latestRef.current = { book: bookKey, chapter: current.chapter, verse: current.verse }
    // Keep the restore anchor on where you actually are, so switching language
    // mode re-lands on the verse being read rather than wherever the book opened.
    restoreRef.current = { chapter: current.chapter, verse: current.verse }
    // An anchor that settles mid-restore is DEFERRED, never dropped: skipping it
    // outright meant a picker jump only reached the database when the reader was
    // closed (the unmount flush), so a device that was simply left open never
    // pushed the new position.
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
    const delay = Math.max(SAVE_DEBOUNCE_MS, restoringUntilRef.current - Date.now() + 50)
    saveTimerRef.current = setTimeout(() => {
      void save(bookKey, current.chapter, current.verse)
    }, delay)
    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
    }
  }, [bookKey, book, current, save])

  // Closing the reader must not lose the last few seconds of reading: flush the
  // pending anchor immediately instead of waiting out the debounce.
  useEffect(() => {
    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
      const last = latestRef.current
      if (last) void save(last.book, last.chapter, last.verse)
    }
  }, [save])

  // --- navigation -------------------------------------------------------------
  const goToBook = useCallback(
    (key: string, chapter: number, dir: number) => {
      restoreRef.current = { chapter, verse: 1 }
      setDirection(dir)
      setCurrent({ chapter, verse: 1 })
      setBookKey(key)
    },
    []
  )

  const meta = bookKey ? getNtBook(bookKey) : undefined
  const prevBook = bookKey ? prevNtBook(bookKey) : undefined
  const nextBook = bookKey ? nextNtBook(bookKey) : undefined

  const goPrev = useCallback(() => {
    if (prevBook) goToBook(prevBook.key, 1, -1)
  }, [prevBook, goToBook])

  const goNext = useCallback(() => {
    if (nextBook) goToBook(nextBook.key, 1, 1)
  }, [nextBook, goToBook])

  const handleDragEnd = (_: unknown, info: PanInfo) => {
    const { offset, velocity } = info
    if (offset.x < -SWIPE_THRESHOLD || velocity.x < -VELOCITY_THRESHOLD) goNext()
    else if (offset.x > SWIPE_THRESHOLD || velocity.x > VELOCITY_THRESHOLD) goPrev()
  }

  const handlePick = useCallback(
    (pickedBook: string, pickedChapter: number) => {
      setPickerOpen(false)
      if (pickedBook === bookKey && book) {
        restoreRef.current = { chapter: pickedChapter, verse: 1 }
        setCurrent({ chapter: pickedChapter, verse: 1 })
        scrollToVerse(pickedChapter, 1)
        return
      }
      const dir = NT_BOOKS.findIndex((b) => b.key === pickedBook) >= NT_BOOKS.findIndex((b) => b.key === bookKey) ? 1 : -1
      goToBook(pickedBook, pickedChapter, dir)
    },
    [bookKey, book, goToBook, scrollToVerse]
  )

  // Arrow-key navigation (desktop / PWA on laptop).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (pickerOpen) return
      if (e.key === 'ArrowLeft') goPrev()
      else if (e.key === 'ArrowRight') goNext()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [goPrev, goNext, pickerOpen])

  // --- render -----------------------------------------------------------------
  const chapters = useMemo(() => (book ? chapterNumbers(book) : []), [book])
  const completed = isCompleted(practiceId)
  const totalChapters = meta?.chapters ?? chapters.length
  const progress = totalChapters > 0 ? Math.min(1, current.chapter / totalChapters) : 0

  const slideVariants = {
    enter: (d: number) => ({ x: d > 0 ? 40 : -40, opacity: 0 }),
    center: { x: 0, opacity: 1 },
    exit: (d: number) => ({ x: d > 0 ? -40 : 40, opacity: 0 }),
  }

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

          <button
            onClick={() => setPickerOpen(true)}
            className="flex-1 min-w-0 text-center px-1 rounded-lg hover:bg-surface-secondary dark:hover:bg-surface-secondary-dark transition-colors"
            aria-label="Escolher livro e capítulo"
          >
            <p className="text-[10px] leading-none text-text-muted dark:text-text-muted-dark uppercase tracking-widest font-heading">
              {lang === 'la' ? (meta?.latinName ?? 'Novum Testamentum') : 'Novo Testamento'}
            </p>
            <h1 className="font-heading text-base font-semibold text-primary dark:text-primary-light truncate mt-0.5 flex items-center justify-center gap-1">
              {meta ? `${meta.name} ${current.chapter}` : 'Carregando…'}
              <ChevronDown className="w-3.5 h-3.5 shrink-0 opacity-60" />
            </h1>
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
            {completed && <Check className="w-4 h-4 text-btn-text dark:text-btn-dark-text" strokeWidth={3} />}
          </motion.button>
        </div>
        {/* Progress through the current book */}
        <div className="h-0.5 bg-border/40 dark:bg-border-dark/40">
          <div
            className="h-full bg-primary/60 dark:bg-primary-light/60 transition-[width] duration-300"
            style={{ width: `${progress * 100}%` }}
          />
        </div>
      </header>

      {/* Text */}
      <div className="flex-1 overflow-hidden relative">
        <motion.div
          ref={scrollRef}
          drag="x"
          dragDirectionLock
          dragConstraints={{ left: 0, right: 0 }}
          dragElastic={0.15}
          onDragEnd={handleDragEnd}
          className="absolute inset-0 overflow-y-auto touch-pan-y"
        >
          {!book ? (
            <Spinner className="h-full" />
          ) : (
            <motion.div
              key={`${bookKey}-${lang}`}
              custom={direction}
              variants={slideVariants}
              initial="enter"
              animate="center"
              transition={{ duration: 0.18, ease: 'easeOut' }}
              className="mx-auto w-full max-w-2xl px-5 pt-4 pb-[calc(5rem+var(--safe-area-bottom))] nt-text"
            >
              {chapters.map((c) => {
                const verses = book.chapters[String(c)]
                const firstVerse = verses[0]?.v ?? 1
                return (
                  <div key={c}>
                    <p className="nt-chapter" data-chapter-head={c} data-first-verse={firstVerse}>
                      Capítulo {c}
                    </p>
                    {lang === 'both' ? (
                      verses.map((verse) => (
                        <div key={verse.v} data-c={c} data-v={verse.v} className="mb-3">
                          <p lang="pt">
                            <span className="verse-num">{verse.v}</span>
                            {verse.pt}
                          </p>
                          {verse.la && (
                            <p lang="la" className="nt-latin">
                              {verse.la}
                            </p>
                          )}
                        </div>
                      ))
                    ) : (
                      // One verse per line. `lang` drives the browser's hyphenation
                      // dictionary; without it `hyphens: auto` does nothing and the
                      // justified column opens up rivers of whitespace.
                      verses.map((verse) => (
                        <p
                          key={verse.v}
                          lang={lang === 'la' ? 'la' : 'pt'}
                          data-c={c}
                          data-v={verse.v}
                          className="nt-verse"
                        >
                          <span className="verse-num">{verse.v}</span>
                          {(lang === 'la' ? verse.la : verse.pt) ?? verse.pt}
                        </p>
                      ))
                    )}
                  </div>
                )
              })}
            </motion.div>
          )}
        </motion.div>

        {/* Language mode */}
        <div className="absolute bottom-4 right-4 flex rounded-full overflow-hidden shadow-lg bg-surface-secondary dark:bg-surface-secondary-dark">
          {LANG_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              onClick={() => setLang(opt.value)}
              aria-label={opt.aria}
              aria-pressed={lang === opt.value}
              className={`px-3 py-2 text-xs font-medium transition-colors ${
                lang === opt.value
                  ? 'bg-primary text-white dark:bg-primary-light dark:text-surface-dark'
                  : 'text-text-secondary dark:text-text-secondary-dark hover:bg-border/50 dark:hover:bg-border-dark/50'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* Footer: book to book */}
      <footer className="shrink-0 border-t border-border dark:border-border-dark pb-[var(--safe-area-bottom)]">
        <div className="flex items-center px-4 h-14 mx-auto w-full max-w-2xl">
          <button
            onClick={goPrev}
            disabled={!prevBook}
            className="p-2 text-text-secondary dark:text-text-secondary-dark disabled:opacity-30 hover:bg-surface-secondary dark:hover:bg-surface-secondary-dark rounded-full transition-colors"
            aria-label={prevBook ? `Livro anterior: ${prevBook.name}` : 'Livro anterior'}
          >
            <ChevronLeft className="w-5 h-5" />
          </button>

          <button
            onClick={() => setPickerOpen(true)}
            className="flex-1 text-center text-xs text-text-muted dark:text-text-muted-dark tabular-nums hover:text-text-secondary dark:hover:text-text-secondary-dark transition-colors"
          >
            Capítulo {current.chapter} de {totalChapters}
          </button>

          <button
            onClick={goNext}
            disabled={!nextBook}
            className="p-2 text-text-secondary dark:text-text-secondary-dark disabled:opacity-30 hover:bg-surface-secondary dark:hover:bg-surface-secondary-dark rounded-full transition-colors"
            aria-label={nextBook ? `Próximo livro: ${nextBook.name}` : 'Próximo livro'}
          >
            <ChevronRight className="w-5 h-5" />
          </button>
        </div>
      </footer>

      <AnimatePresence>
        {pickerOpen && bookKey && (
          <NtBookPicker
            currentBook={bookKey}
            currentChapter={current.chapter}
            onSelect={handlePick}
            onClose={() => setPickerOpen(false)}
          />
        )}
      </AnimatePresence>
    </motion.div>
  )
}
