import { useCallback, useEffect, useRef } from 'react'
import { useLocation, useNavigate, useParams } from 'react-router'
import { motion } from 'motion/react'
import { AlertCircle, BookX, ChevronLeft, ChevronRight, List } from 'lucide-react'
import { MarkdownRenderer } from '../shared/MarkdownRenderer'
import { Spinner } from '../shared/Spinner'
import { EmptyState } from '../shared/EmptyState'
import { getEscrivaPoint } from '../../data/meditation'
import {
  CHAPTERS,
  bookLabel,
  bookPath,
  chapterIndexOf,
  isBookKey,
  isPointInBook,
  pointPath,
} from '../../data/escriva'
import { useEscrivaPoints } from '../../hooks/useEscrivaPoints'
import { useBackState, useGoBack, type BackState } from '../../hooks/useBackNavigation'

// Pixels of the preceding point left in view above the one opened, as in the
// Meditação reader: it lands at the top, with a sliver hinting at what's above.
const PEEK = 56

/**
 * The reader's history entry: where it was opened from, and how far into the
 * chapter it had been read when it was left — so coming back to this entry (from
 * the table of contents, or a reload when the OS discarded the tab) resumes there,
 * not at the opened point again.
 */
interface ReaderState extends BackState {
  scrollTop?: number
}

/**
 * A point of Caminho, Sulco or Forja, read in its chapter: the whole chapter as one
 * scroll, opened at the point (marked), so reading on is just scrolling. The footer
 * walks chapter by chapter, as does ←/→ on a keyboard.
 *
 * It scrolls inside its own full-screen container, not the window: ScrollMemory
 * restores WINDOW positions per path, and a remembered offset would fight the jump
 * to the point every time the same point is opened again. Its own position is kept
 * per history entry instead (ReaderState), which a fresh open never has.
 */
export function PointReader() {
  const params = useParams<{ book: string; n: string }>()
  const navigate = useNavigate()
  const location = useLocation()
  const { points, error, retry } = useEscrivaPoints()
  const book = isBookKey(params.book) ? params.book : null
  const goBack = useGoBack(book ? bookPath(book) : '/devocionario')
  const tocState = useBackState()
  const state = location.state as ReaderState | null
  const boxRef = useRef<HTMLDivElement | null>(null)

  const n = Number(params.n)
  const valid = book !== null && isPointInBook(book, n)
  const chapterIndex = valid ? chapterIndexOf(book, n) : -1
  const chapters = book ? CHAPTERS[book] : []
  const chapter = chapters[chapterIndex]
  const prev = chapters[chapterIndex - 1]
  const next = chapters[chapterIndex + 1]

  // Moving between chapters REPLACES the entry and keeps its back state, so back
  // still returns to wherever the reader was first opened from — but not the
  // position, which belonged to the chapter left.
  const back = state?.back
  const goToChapter = useCallback(
    (first: number | undefined) => {
      if (!book || first === undefined) return
      navigate(pointPath(book, first), { replace: true, state: { back } satisfies ReaderState })
    },
    [book, navigate, back]
  )

  // Writes the reading position into this entry, before leaving it.
  const savePosition = useCallback(() => {
    const box = boxRef.current
    if (!box) return
    navigate(location.pathname, {
      replace: true,
      state: { ...state, scrollTop: box.scrollTop } satisfies ReaderState,
    })
  }, [navigate, location.pathname, state])

  // A PWA in the background can be discarded and come back as a reload, which
  // re-reads this entry's state. `hidden` is the last moment that reliably runs.
  useEffect(() => {
    const onHide = () => {
      if (document.visibilityState === 'hidden') savePosition()
    }
    document.addEventListener('visibilitychange', onHide)
    return () => document.removeEventListener('visibilitychange', onHide)
  }, [savePosition])

  // The table of contents. Opened from it (the entry before this one IS the
  // book), the reader goes back to it rather than stacking another copy of the
  // book on top — otherwise every chapter picked from the contents costs one more
  // "Voltar" on the way out. From anywhere else it opens the book on top, and
  // keeps this position for the way back.
  const openContents = () => {
    if (!book) return
    if (back === bookPath(book)) {
      navigate(-1)
      return
    }
    savePosition()
    navigate(bookPath(book), { state: tocState })
  }

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft') goToChapter(prev?.first)
      else if (e.key === 'ArrowRight') goToChapter(next?.first)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [goToChapter, prev, next])

  // Runs as a ref callback on the keyed scroll container, i.e. once the chapter's
  // DOM exists: a saved position resumes; otherwise a chapter's first point opens at
  // the very top, any other one just under a sliver of the point before it.
  // Deliberately NOT keyed on the state: savePosition() changes it, and re-running
  // this then would move the text under the reader. The state it reads is the one
  // the point arrived with, which is the one that matters.
  const scrollToPoint = useCallback(
    (el: HTMLDivElement | null) => {
      boxRef.current = el
      if (!el) return
      const savedTop = state?.scrollTop
      if (typeof savedTop === 'number') {
        el.scrollTop = savedTop
        return
      }
      const target = el.querySelector<HTMLElement>(`[data-point="${n}"]`)
      el.scrollTop = target && chapter && n !== chapter.first ? Math.max(0, target.offsetTop - PEEK) : 0
    },
    [n, chapter]
  )

  if (!valid || !chapter) {
    return (
      <EmptyState
        icon={BookX}
        message="Ponto não encontrado"
        action={{ label: 'Voltar ao devocionário', to: '/devocionario' }}
      />
    )
  }

  const numbers = Array.from({ length: chapter.last - chapter.first + 1 }, (_, i) => chapter.first + i)

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.2 }}
      className="fixed inset-0 z-40 flex flex-col bg-surface dark:bg-surface-dark"
    >
      <header className="shrink-0 bg-surface-card dark:bg-surface-card-dark border-b border-border dark:border-border-dark pt-[var(--safe-area-top)]">
        <div className="flex items-center px-2 h-16 mx-auto w-full max-w-2xl">
          <button
            onClick={goBack}
            className="p-2 text-text-secondary dark:text-text-secondary-dark hover:bg-surface-secondary dark:hover:bg-surface-secondary-dark rounded-full transition-colors"
            aria-label="Voltar"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <div className="flex-1 min-w-0 text-center px-1">
            <p className="text-[10px] leading-none text-text-muted dark:text-text-muted-dark uppercase tracking-widest font-heading">
              {bookLabel(book)}
            </p>
            <h1 className="font-heading text-base font-semibold text-text-primary dark:text-text-primary-dark truncate mt-0.5">
              {chapter.title}
            </h1>
          </div>
          <button
            onClick={openContents}
            className="p-2 text-text-secondary dark:text-text-secondary-dark hover:bg-surface-secondary dark:hover:bg-surface-secondary-dark rounded-full transition-colors"
            aria-label={`Capítulos de ${bookLabel(book)}`}
          >
            <List className="w-5 h-5" />
          </button>
        </div>
      </header>

      {error ? (
        <div className="flex-1 flex flex-col items-center justify-center gap-4 px-8 text-center">
          <AlertCircle className="w-8 h-8 text-text-muted dark:text-text-muted-dark" />
          <p className="text-text-secondary dark:text-text-secondary-dark">
            Não foi possível carregar os textos.
          </p>
          <button
            onClick={retry}
            className="px-4 py-2 rounded-full text-sm font-medium bg-surface-secondary text-text-primary dark:bg-surface-secondary-dark dark:text-text-primary-dark transition-transform active:scale-95"
          >
            Tentar novamente
          </button>
        </div>
      ) : !points ? (
        <Spinner className="flex-1" />
      ) : (
        <div
          // Keyed by the point, so opening another one (a chapter step, a new
          // search result) remounts the scroll box and re-runs scrollToPoint.
          key={`${book}:${n}`}
          ref={scrollToPoint}
          // `relative` makes this box the points' offsetParent, so their offsetTop
          // is measured from the top of the scroll, not from above the header.
          className="relative flex-1 overflow-y-auto overscroll-contain"
        >
          <div className="mx-auto w-full max-w-2xl px-5 py-5 pb-10">
            <p className="mb-6 text-center text-xs text-text-muted dark:text-text-muted-dark tabular-nums">
              {bookLabel(book)} {chapter.first}–{chapter.last}
            </p>
            {numbers.map((num, i) => {
              const text = getEscrivaPoint(points, book, num)
              const opened = num === n
              return (
                <section
                  key={num}
                  data-point={num}
                  aria-current={opened ? 'true' : undefined}
                  className={`${i > 0 ? 'mt-3' : ''} rounded-xl px-4 py-4 ${
                    opened ? 'bg-surface-secondary dark:bg-surface-secondary-dark' : ''
                  }`}
                >
                  <h2
                    className={`mb-2 font-heading text-xs uppercase tracking-widest tabular-nums ${
                      opened
                        ? 'text-primary dark:text-primary-light font-semibold'
                        : 'text-text-muted dark:text-text-muted-dark'
                    }`}
                  >
                    № {num}
                  </h2>
                  {text ? (
                    <MarkdownRenderer markdown={text} className="prose-prayer prose-point" />
                  ) : (
                    <p className="italic text-text-muted dark:text-text-muted-dark">(sem ponto)</p>
                  )}
                </section>
              )
            })}
          </div>
        </div>
      )}

      <footer className="shrink-0 border-t border-border/30 dark:border-border-dark/30 pb-[var(--safe-area-bottom)]">
        <div className="flex items-center gap-1 px-2 h-14 mx-auto w-full max-w-2xl">
          <button
            onClick={() => goToChapter(prev?.first)}
            disabled={!prev}
            className="flex-1 min-w-0 flex items-center gap-1 p-2 text-sm text-left text-text-secondary dark:text-text-secondary-dark disabled:opacity-30 hover:bg-surface-secondary dark:hover:bg-surface-secondary-dark rounded-lg transition-colors"
            aria-label={prev ? `Capítulo anterior: ${prev.title}` : 'Capítulo anterior'}
          >
            <ChevronLeft className="w-5 h-5 shrink-0" />
            <span className="truncate">{prev?.title}</span>
          </button>
          <span className="shrink-0 px-1 text-xs tabular-nums text-text-muted dark:text-text-muted-dark">
            {chapterIndex + 1}/{chapters.length}
          </span>
          <button
            onClick={() => goToChapter(next?.first)}
            disabled={!next}
            className="flex-1 min-w-0 flex items-center justify-end gap-1 p-2 text-sm text-right text-text-secondary dark:text-text-secondary-dark disabled:opacity-30 hover:bg-surface-secondary dark:hover:bg-surface-secondary-dark rounded-lg transition-colors"
            aria-label={next ? `Próximo capítulo: ${next.title}` : 'Próximo capítulo'}
          >
            <span className="truncate">{next?.title}</span>
            <ChevronRight className="w-5 h-5 shrink-0" />
          </button>
        </div>
      </footer>
    </motion.div>
  )
}
