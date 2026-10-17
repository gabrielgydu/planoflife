import { Link } from 'react-router'
import { ChevronRight } from 'lucide-react'
import { bookMax, type BookKey } from '../../data/meditation'
import {
  CHAPTERS,
  bookLabel,
  bookPath,
  chapterOf,
  pointPath,
  type EscrivaChapter,
} from '../../data/escriva'
import { useBackState } from '../../hooks/useBackNavigation'

// The rows the Devocionário uses for St. Josemaría's books — a book, a chapter, a
// point — in the list, in search results and in a book's table of contents. Every
// link carries the back state (see useBackNavigation), so the page it opens can
// return here: to the search results, with the query still in the URL, rather
// than to the top of the book.

const ROW =
  'flex items-center gap-2 px-4 py-3 hover:bg-surface-secondary dark:hover:bg-surface-secondary-dark transition-colors'

export function BookRow({ book }: { book: BookKey }) {
  const state = useBackState()
  return (
    <Link to={bookPath(book)} state={state} className={ROW}>
      <span className="flex-1 min-w-0">
        <span className="block text-sm text-text-primary dark:text-text-primary-dark truncate">
          {bookLabel(book)}
        </span>
        <span className="block text-xs text-text-muted dark:text-text-muted-dark truncate mt-0.5">
          {bookMax(book)} pontos · {CHAPTERS[book].length} capítulos
        </span>
      </span>
      <ChevronRight className="w-5 h-5 shrink-0 text-text-muted" />
    </Link>
  )
}

export function ChapterRow({
  book,
  chapter,
  showBook = false,
}: {
  book: BookKey
  chapter: EscrivaChapter
  /** In search results the book is not obvious from context, so it is named. */
  showBook?: boolean
}) {
  const state = useBackState()
  const range = `${chapter.first}–${chapter.last}`
  return (
    <Link to={pointPath(book, chapter.first)} state={state} className={ROW}>
      <span className="flex-1 min-w-0">
        <span className="block text-sm text-text-primary dark:text-text-primary-dark truncate">
          {chapter.title}
        </span>
        {showBook && (
          <span className="block text-xs text-text-muted dark:text-text-muted-dark truncate mt-0.5">
            {bookLabel(book)} {range}
          </span>
        )}
      </span>
      {!showBook && (
        <span className="shrink-0 text-xs tabular-nums text-text-muted dark:text-text-muted-dark">
          {range}
        </span>
      )}
      <ChevronRight className="w-5 h-5 shrink-0 text-text-muted" />
    </Link>
  )
}

export function PointRow({
  book,
  n,
  snippet,
}: {
  book: BookKey
  n: number
  /** One line of the point — around the match in search results. */
  snippet: string
}) {
  const state = useBackState()
  const chapter = chapterOf(book, n)
  return (
    <Link to={pointPath(book, n)} state={state} className={ROW}>
      <span className="flex-1 min-w-0">
        <span className="block text-sm text-text-primary dark:text-text-primary-dark truncate">
          <span className="tabular-nums">
            {bookLabel(book)} {n}
          </span>
          {chapter && (
            <span className="text-text-muted dark:text-text-muted-dark"> · {chapter.title}</span>
          )}
        </span>
        <span className="block text-xs text-text-muted dark:text-text-muted-dark truncate mt-0.5">
          {snippet}
        </span>
      </span>
      <ChevronRight className="w-5 h-5 shrink-0 text-text-muted" />
    </Link>
  )
}
