import { memo, useEffect, useMemo } from 'react'
import { BOOKS, type BookKey, type EscrivaPoints } from '../../data/meditation'
import { bookLabel } from '../../data/escriva'
import { pointPlainText } from '../../data/escrivaText'
import {
  parsePointRef,
  pointSnippet,
  resolvePointRef,
  searchBooks,
  searchChapters,
  searchPoints,
  warmPointIndex,
  type ChapterHit,
  type PointHit,
} from '../../data/pointSearch'
import { BookRow, ChapterRow, PointRow } from './PointRows'
import { SectionHeading } from './SectionHeading'
import { ShowMoreButton } from './ShowMoreButton'
import { useResultLimits } from '../../hooks/useResultLimits'

/** Points shown per book before "Mostrar mais" — "amor" alone matches hundreds. */
const FIRST_PAGE = 20
const NEXT_PAGE = 100

export interface PointSearch {
  /** A number query, resolved: "238" → that point in each book that has it. */
  refs: { book: BookKey; n: number }[]
  books: BookKey[]
  chapters: ChapterHit[]
  /** Text matches, in book order. Empty for a number query. */
  hits: PointHit[]
  /** The text has not loaded yet (or failed to), so `refs`/`hits` can't be known. */
  pending: boolean
  total: number
}

/**
 * Everything in St. Josemaría's books that answers `query`. Chapters and books need
 * no text, so they show up even before the ~750 KB of points has loaded.
 */
export function usePointSearch(points: EscrivaPoints | null, query: string): PointSearch {
  // Folding 3054 points is the one slow step: start it in the background as soon as
  // the text arrives, rather than on the keystroke that first needs it.
  useEffect(() => (points ? warmPointIndex(points) : undefined), [points])

  return useMemo(() => {
    const ref = parsePointRef(query)
    const books = ref ? [] : searchBooks(query)
    const chapters = ref ? [] : searchChapters(query)
    const refs = ref ? resolvePointRef(ref) : []
    const hits = !ref && points ? searchPoints(points, query) : []
    return {
      refs: points ? refs : [],
      books,
      chapters,
      hits,
      pending: !points,
      total: (points ? refs.length : 0) + books.length + chapters.length + hits.length,
    }
  }, [points, query])
}

/** First line of a point, for a number hit (there is no match to quote around). */
function opening(points: EscrivaPoints, book: BookKey, n: number): string {
  const md = points[book]?.[String(n)]
  return md ? pointPlainText(md).replace(/\s+/g, ' ').trim() : ''
}

/**
 * A text hit with its one-line quote. Memoized per hit: quoting means folding the
 * whole point, and "Mostrar mais" should only pay for the rows it adds.
 */
const PointHitRow = memo(function PointHitRow({ hit, query }: { hit: PointHit; query: string }) {
  return <PointRow book={hit.entry.book} n={hit.entry.n} snippet={pointSnippet(hit, query)} />
})

/**
 * Memoized, and every prop is stable while the query is (`search` is a memo, the
 * points a module cache, onRetry a callback): a keystroke renders the Devocionário
 * at once with the OLD deferred query, and must not re-quote every hit for it.
 */
export const PointSearchResults = memo(function PointSearchResults({
  search,
  points,
  query,
  error,
  onRetry,
}: {
  search: PointSearch
  points: EscrivaPoints | null
  query: string
  error: boolean
  onRetry: () => void
}) {
  const { limit: limitOf, more } = useResultLimits(query)

  const hitsByBook = useMemo(() => {
    const map = new Map<BookKey, PointHit[]>()
    for (const hit of search.hits) {
      const list = map.get(hit.entry.book) ?? []
      list.push(hit)
      map.set(hit.entry.book, list)
    }
    return map
  }, [search.hits])

  return (
    <>
      {points && search.refs.length > 0 && (
        <div>
          <SectionHeading>{search.refs.length === 1 ? 'Ponto' : 'Pontos'}</SectionHeading>
          {search.refs.map(({ book, n }) => (
            <PointRow key={`${book}:${n}`} book={book} n={n} snippet={opening(points, book, n)} />
          ))}
        </div>
      )}

      {search.books.length > 0 && (
        <div>
          <SectionHeading>São Josemaria</SectionHeading>
          {search.books.map((book) => (
            <BookRow key={book} book={book} />
          ))}
        </div>
      )}

      {search.chapters.length > 0 && (
        <div>
          <SectionHeading>
            {search.chapters.length === 1 ? '1 capítulo' : `${search.chapters.length} capítulos`}
          </SectionHeading>
          {search.chapters.map(({ book, chapter }) => (
            <ChapterRow key={`${book}:${chapter.slug}`} book={book} chapter={chapter} showBook />
          ))}
        </div>
      )}

      {BOOKS.map(({ key }) => {
        const hits = hitsByBook.get(key)
        if (!hits?.length) return null
        const limit = limitOf(key, FIRST_PAGE)
        return (
          <div key={key}>
            <SectionHeading>
              {bookLabel(key)} · {hits.length === 1 ? '1 ponto' : `${hits.length} pontos`}
            </SectionHeading>
            {hits.slice(0, limit).map((hit) => (
              <PointHitRow key={hit.entry.n} hit={hit} query={query} />
            ))}
            {hits.length > limit && (
              <ShowMoreButton
                remaining={hits.length - limit}
                onClick={() => more(key, limit, NEXT_PAGE)}
              />
            )}
          </div>
        )
      })}

      {search.pending &&
        (error ? (
          <div className="flex items-center gap-3 px-4 py-3 text-sm text-text-muted dark:text-text-muted-dark">
            <span className="flex-1">Não foi possível carregar os pontos de São Josemaria.</span>
            <button
              onClick={onRetry}
              className="shrink-0 px-3 py-1.5 rounded-full text-sm font-medium bg-surface-secondary text-text-primary dark:bg-surface-secondary-dark dark:text-text-primary-dark"
            >
              Tentar novamente
            </button>
          </div>
        ) : (
          <p className="px-4 py-3 text-sm text-text-muted dark:text-text-muted-dark">
            Carregando os pontos de São Josemaria…
          </p>
        ))}
    </>
  )
})
