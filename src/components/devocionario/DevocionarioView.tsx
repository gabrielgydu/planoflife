import { Fragment, useDeferredValue, useEffect, useMemo, useRef, useState } from 'react'
import {
  Link,
  createSearchParams,
  useLocation,
  useNavigate,
  useNavigationType,
  useSearchParams,
} from 'react-router'
import { AnimatePresence, motion } from 'motion/react'
import {
  BookOpen,
  Check,
  ChevronRight,
  GripVertical,
  ListOrdered,
  Plus,
  Search,
  SearchX,
  Star,
  X,
} from 'lucide-react'
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core'
import {
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable,
  arrayMove,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { Spinner } from '../shared/Spinner'
import { EmptyState } from '../shared/EmptyState'
import { usePrayers } from '../../hooks/usePrayers'
import { useEscrivaPoints } from '../../hooks/useEscrivaPoints'
import {
  DEVOCIONARIO_SECTIONS,
  USER_SECTION_SLUG,
  prayerTitle,
  sectionName,
} from '../../data/devocionario'
import { buildSearchIndex, matchSnippet, searchPrayers } from '../../data/prayerSearch'
import { isSearchQuery } from '../../data/pointSearch'
import { BOOKS } from '../../data/meditation'
import { BookRow } from './PointRows'
import { useBackState } from '../../hooks/useBackNavigation'
import { PointSearchResults, usePointSearch } from './PointSearchResults'
import { SectionHeading } from './SectionHeading'
import { ShowMoreButton } from './ShowMoreButton'
import { forgetResultLimits, useResultLimits } from '../../hooks/useResultLimits'
import { forgetScrollPosition } from '../layout/ScrollMemory'
import type { Prayer } from '../../types'

/** The pinned group of favorites is a view, not a section — hence a reserved key. */
const FAVORITES_KEY = '@favoritos'

/**
 * Prayers shown in search results before "Mostrar mais": enough for any prayer
 * query, short enough that a broad word ("oração" — 35 prayers) still leaves the
 * chapters and points that follow in reach.
 */
const PRAYER_RESULTS_FIRST_PAGE = 10

/** How far the book has to scroll before the search field slides out of the header. */
const SEARCH_REVEAL_PX = 24

function FavoriteButton({ prayer, onToggle }: { prayer: Prayer; onToggle: () => void }) {
  return (
    <button
      onClick={(e) => {
        e.preventDefault()
        e.stopPropagation()
        onToggle()
      }}
      className="p-2 -m-1 text-text-muted dark:text-text-muted-dark hover:text-[#A89548] transition-colors rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary dark:focus-visible:ring-primary-light"
      aria-label={prayer.isFavorite ? 'Remover dos favoritos' : 'Marcar como favorita'}
      aria-pressed={prayer.isFavorite}
    >
      <Star
        className={`w-4 h-4 ${prayer.isFavorite ? 'fill-[#A89548] text-[#A89548]' : ''}`}
      />
    </button>
  )
}

function PrayerRow({
  prayer,
  onToggleFavorite,
  subtitle,
}: {
  prayer: Prayer
  onToggleFavorite: () => void
  /** Secondary line — the section, or a quote of the match, in search results. */
  subtitle?: string
}) {
  const latinOnly = !prayer.title.pt
  const backState = useBackState()
  return (
    <Link
      to={`/devocionario/${prayer.id}`}
      state={backState}
      className="flex items-center gap-2 px-4 py-3 hover:bg-surface-secondary dark:hover:bg-surface-secondary-dark transition-colors"
    >
      <span className="flex-1 min-w-0">
        <span className="block text-sm text-text-primary dark:text-text-primary-dark truncate">
          {prayerTitle(prayer)}
          {latinOnly && (
            <span className="ml-2 text-[10px] uppercase tracking-widest text-text-muted dark:text-text-muted-dark">
              la
            </span>
          )}
        </span>
        {subtitle && (
          <span className="block text-xs text-text-muted dark:text-text-muted-dark truncate mt-0.5">
            {subtitle}
          </span>
        )}
      </span>
      <FavoriteButton prayer={prayer} onToggle={onToggleFavorite} />
      <ChevronRight className="w-5 h-5 shrink-0 text-text-muted" />
    </Link>
  )
}

function SortablePrayerRow({ prayer }: { prayer: Prayer }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: prayer.id,
  })
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    zIndex: isDragging ? 1 : 0,
  }
  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className="flex items-center gap-3 px-4 py-3 bg-surface-card dark:bg-surface-card-dark touch-none"
    >
      <GripVertical className="w-4 h-4 shrink-0 text-text-muted dark:text-text-muted-dark" />
      <span className="flex-1 min-w-0 text-sm text-text-primary dark:text-text-primary-dark truncate">
        {prayerTitle(prayer)}
      </span>
    </div>
  )
}

/** The "São Josemaria" group: Caminho, Sulco and Forja, each opening its chapters. */
function EscrivaBooks() {
  return (
    <div>
      <SectionHeading>São Josemaria</SectionHeading>
      {BOOKS.map((b) => (
        <BookRow key={b.key} book={b.key} />
      ))}
    </div>
  )
}

/**
 * The prayer book: every section in reading order, with a virtual "Favoritos" group
 * pinned on top. A favorite also keeps its place in its own section (marked with a
 * filled star) so the book itself never changes shape.
 *
 * Reorder mode is per-section and deliberately excludes the favorites group — that
 * group has no order of its own, it inherits the book's. It is also mutually
 * exclusive with search: reordering a FILTERED section would renumber it 0..n-1 and
 * silently throw away the position of every prayer the filter hid.
 */
export function DevocionarioView() {
  const navigate = useNavigate()
  const { prayers, isLoading, toggleFavorite, reorderSection } = usePrayers()
  const [reordering, setReordering] = useState(false)
  const { points, error: pointsError, retry: retryPoints } = useEscrivaPoints()

  // A query that searches lives in the URL (?q=), so coming back from a prayer or a
  // point opened from the results lands on the same results — and ScrollMemory,
  // which keys on path + search, on the same scroll position in them. Only one that
  // searches: the first letter typed still shows the whole book, and changing the
  // URL for it would send the book to the top under your finger. The input itself
  // is bound to local state: a controlled input fed by a router navigation per
  // keystroke would lag behind and lose its cursor.
  const [searchParams, setSearchParams] = useSearchParams()
  const { pathname } = useLocation()
  const navigationType = useNavigationType()
  const urlQuery = searchParams.get('q') ?? ''
  const [query, setQueryState] = useState(urlQuery)
  const writtenQuery = useRef(urlQuery)
  useEffect(() => {
    // A navigation that changed ?q (back/forward, the bottom-bar tab) wins. Never
    // a REPLACE: those are the field's own writes below, which the router applies
    // as a low-priority update — one landing late on a slow phone would put an
    // older query back into the field and swallow what was typed meanwhile.
    if (navigationType === 'REPLACE' || urlQuery === writtenQuery.current) return
    writtenQuery.current = urlQuery
    setQueryState(urlQuery)
  }, [urlQuery, navigationType])
  const setQuery = (next: string) => {
    setQueryState(next)
    const q = isSearchQuery(next) ? next : ''
    if (q === writtenQuery.current) return
    writtenQuery.current = q
    if (q) {
      // Typed, it is a new search, even of a query read before: it starts at the
      // top with every group on its first page. Only coming BACK to a search
      // (Voltar, a reload) puts it where it was left.
      forgetScrollPosition(`${pathname}?${createSearchParams({ q })}`)
      forgetResultLimits(q)
    }
    setSearchParams(q ? { q } : {}, { replace: true })
  }

  const [scrolled, setScrolled] = useState(false)
  const [searchFocused, setSearchFocused] = useState(false)

  // Results trail the keystrokes by a frame when they must: 3054 points is a real
  // amount of text to scan on a phone, and the field must never stutter.
  const deferredQuery = useDeferredValue(query)
  const searching = isSearchQuery(query)
  const resultsQuery = isSearchQuery(deferredQuery) ? deferredQuery : query
  const searchIndex = useMemo(() => buildSearchIndex(prayers), [prayers])
  const results = useMemo(
    () => (searching ? searchPrayers(searchIndex, resultsQuery) : []),
    [searchIndex, resultsQuery, searching]
  )
  const pointSearch = usePointSearch(points, searching ? resultsQuery : '')
  const { limit: limitOf, more } = useResultLimits(resultsQuery)
  const prayerLimit = limitOf('prayers', PRAYER_RESULTS_FIRST_PAGE)

  // The search field stays out of the way until you actually start moving through
  // the book, so the top of the prayer book is just the prayer book. Once it is
  // open a query or the focus keeps it open — collapsing the field out from under
  // the text someone is typing, or hiding an active filter, would be worse than the
  // space it costs.
  const showSearch = scrolled || searchFocused || query.length > 0

  useEffect(() => {
    const onScroll = () => {
      // Position, not direction: a direction-triggered panel flickers on the small
      // reversals every touch scroll ends with.
      const past = window.scrollY > SEARCH_REVEAL_PX
      // A page too short to scroll can never reveal the field, which would strand
      // search entirely (e.g. everything but "Minhas orações" deleted).
      const unscrollable = document.documentElement.scrollHeight <= window.innerHeight + 1
      setScrolled(past || unscrollable)
    }
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    window.addEventListener('resize', onScroll)
    return () => {
      window.removeEventListener('scroll', onScroll)
      window.removeEventListener('resize', onScroll)
    }
  }, [prayers.length])

  const bySection = useMemo(() => {
    const map = new Map<string, Prayer[]>()
    for (const section of DEVOCIONARIO_SECTIONS) map.set(section.slug, [])
    for (const prayer of prayers) {
      const list = map.get(prayer.section)
      if (list) list.push(prayer)
      // A prayer in an unknown section (a future section pulled from a newer
      // client) is still reachable through Favoritos and search-by-URL; dropping it
      // from the list beats inventing a heading for it.
    }
    return map
  }, [prayers])

  const favorites = useMemo(() => prayers.filter((p) => p.isFavorite), [prayers])

  const groups = useMemo(() => {
    const out: { key: string; name: string; prayers: Prayer[] }[] = []
    if (favorites.length) out.push({ key: FAVORITES_KEY, name: 'Favoritos', prayers: favorites })
    for (const section of DEVOCIONARIO_SECTIONS) {
      const list = bySection.get(section.slug) ?? []
      // "Minhas orações" is shown even when empty — it is where the + button lands.
      if (!list.length && section.slug !== USER_SECTION_SLUG) continue
      out.push({ key: section.slug, name: section.namePt, prayers: list })
    }
    return out
  }, [bySection, favorites])

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { delay: 200, tolerance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  )

  const handleDragEnd = (sectionSlug: string) => (event: DragEndEvent) => {
    const { active, over } = event
    if (!over || active.id === over.id) return
    const list = bySection.get(sectionSlug) ?? []
    const from = list.findIndex((p) => p.id === active.id)
    const to = list.findIndex((p) => p.id === over.id)
    if (from === -1 || to === -1) return
    reorderSection(arrayMove(list, from, to).map((p) => p.id))
  }

  if (isLoading) return <Spinner className="h-64" />

  return (
    <div className="min-h-full">
      <header className="sticky top-0 bg-surface-card dark:bg-surface-card-dark border-b border-border dark:border-border-dark z-10">
        <div className="flex items-center px-4 h-16 mx-auto w-full max-w-2xl">
          <button
            onClick={() => setReordering((r) => !r)}
            disabled={searching}
            className={`p-2 -ml-2 rounded-full transition-colors hover:bg-surface-secondary dark:hover:bg-surface-secondary-dark disabled:opacity-30 disabled:hover:bg-transparent ${
              reordering
                ? 'text-primary dark:text-primary-light'
                : 'text-text-secondary dark:text-text-secondary-dark'
            }`}
            aria-label={reordering ? 'Concluir reordenação' : 'Reordenar orações'}
            aria-pressed={reordering}
          >
            {reordering ? <Check className="w-5 h-5" /> : <ListOrdered className="w-5 h-5" />}
          </button>
          <h1 className="flex-1 text-center font-heading text-lg font-semibold text-text-primary dark:text-text-primary-dark">
            Devocionário
          </h1>
          <button
            onClick={() => navigate('/devocionario/new')}
            className="p-2 -mr-2 text-primary dark:text-primary-light hover:bg-surface-secondary dark:hover:bg-surface-secondary-dark rounded-full transition-colors"
            aria-label="Nova oração"
          >
            <Plus className="w-6 h-6" />
          </button>
        </div>

        {/* Inside the sticky header, but only once the book has been scrolled: at
            rest the header is just the title, and from anywhere else in the 88-prayer
            list the field is one glance away. Unmounted while hidden so it can't be
            tabbed into behind a zero-height box. */}
        <AnimatePresence initial={false}>
          {showSearch && (
            <motion.div
              key="search"
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.18, ease: 'easeOut' }}
              className="overflow-hidden"
            >
              <div className="px-4 pb-3 mx-auto w-full max-w-2xl">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted dark:text-text-muted-dark pointer-events-none" />
                  <input
                    type="text"
                    value={query}
                    onChange={(e) => {
                      setQuery(e.target.value)
                      // Leaving reorder mode on while a filter hides rows would let a
                      // drag renumber a partial section — see the component comment.
                      if (isSearchQuery(e.target.value)) setReordering(false)
                    }}
                    onFocus={() => setSearchFocused(true)}
                    onBlur={() => setSearchFocused(false)}
                    className="w-full pl-9 pr-9 py-2.5 text-sm bg-surface-secondary dark:bg-surface-secondary-dark border border-border dark:border-border-dark rounded-lg text-text-primary dark:text-text-primary-dark placeholder:text-text-muted dark:placeholder:text-text-muted-dark focus:outline-none focus:ring-2 focus:ring-primary/50"
                    placeholder="Buscar orações e pontos (ex.: 238)"
                    aria-label="Buscar orações e pontos de São Josemaria"
                    autoCapitalize="none"
                    autoCorrect="off"
                    spellCheck={false}
                  />
                  {query && (
                    <button
                      onClick={() => setQuery('')}
                      className="absolute right-1.5 top-1/2 -translate-y-1/2 p-1.5 text-text-muted dark:text-text-muted-dark hover:text-text-primary dark:hover:text-text-primary-dark rounded-full transition-colors"
                      aria-label="Limpar busca"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </header>

      {reordering && !searching && (
        <p className="px-4 py-2 text-xs text-center text-text-muted dark:text-text-muted-dark mx-auto w-full max-w-2xl">
          Arraste para reordenar dentro de cada seção.
        </p>
      )}

      {searching ? (
        <div className="divide-y divide-border/30 dark:divide-border-dark mx-auto w-full max-w-2xl">
          {results.length > 0 && (
            <div>
              <SectionHeading>
                {results.length === 1 ? '1 oração' : `${results.length} orações`}
              </SectionHeading>
              {results.slice(0, prayerLimit).map(({ prayer, bodyOnly }) => (
                <PrayerRow
                  key={prayer.id}
                  prayer={prayer}
                  onToggleFavorite={() => toggleFavorite(prayer.id)}
                  subtitle={
                    (bodyOnly ? matchSnippet(prayer, resultsQuery) : null) ??
                    sectionName(prayer.section)
                  }
                />
              ))}
              {results.length > prayerLimit && (
                <ShowMoreButton
                  remaining={results.length - prayerLimit}
                  onClick={() => more('prayers', prayerLimit, results.length)}
                />
              )}
            </div>
          )}
          <PointSearchResults
            search={pointSearch}
            points={points}
            query={resultsQuery}
            error={pointsError}
            onRetry={retryPoints}
          />
          {results.length === 0 && pointSearch.total === 0 && !pointSearch.pending && (
            <EmptyState icon={SearchX} message={`Nada encontrado para “${resultsQuery.trim()}”`} />
          )}
        </div>
      ) : (
        <div className="divide-y divide-border/30 dark:divide-border-dark mx-auto w-full max-w-2xl">
          {/* St. Josemaría's books sit right under Favoritos (or on top without
              favorites): three rows into 3054 points. They are books, not prayers,
              so reorder mode — which is about prayers — leaves them out. */}
          {!reordering && !favorites.length && <EscrivaBooks />}
          {groups.map((group) => (
            <Fragment key={group.key}>
              <div>
                <SectionHeading>{group.name}</SectionHeading>
                {group.key === FAVORITES_KEY || !reordering ? (
                  group.prayers.map((prayer) => (
                    <PrayerRow
                      key={`${group.key}:${prayer.id}`}
                      prayer={prayer}
                      onToggleFavorite={() => toggleFavorite(prayer.id)}
                    />
                  ))
                ) : (
                  <DndContext
                    sensors={sensors}
                    collisionDetection={closestCenter}
                    onDragEnd={handleDragEnd(group.key)}
                  >
                    <SortableContext
                      items={group.prayers.map((p) => p.id)}
                      strategy={verticalListSortingStrategy}
                    >
                      {group.prayers.map((prayer) => (
                        <SortablePrayerRow key={prayer.id} prayer={prayer} />
                      ))}
                    </SortableContext>
                  </DndContext>
                )}
                {group.prayers.length === 0 && (
                  <p className="px-4 py-4 text-sm text-text-muted dark:text-text-muted-dark">
                    Nenhuma oração própria ainda — toque em + para escrever uma.
                  </p>
                )}
              </div>
              {!reordering && group.key === FAVORITES_KEY && <EscrivaBooks />}
            </Fragment>
          ))}
        </div>
      )}

      {prayers.length === 0 && !searching && (
        <EmptyState
          icon={BookOpen}
          message="Nenhuma oração no devocionário"
          action={{ label: 'Escrever uma oração', to: '/devocionario/new' }}
        />
      )}
    </div>
  )
}
