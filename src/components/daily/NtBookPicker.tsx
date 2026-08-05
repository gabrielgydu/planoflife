import { useState } from 'react'
import { motion } from 'motion/react'
import { X, Bookmark } from 'lucide-react'
import { NT_BOOKS } from '../../data/nt/books'

interface NtBookPickerProps {
  /** Book currently open, so it starts expanded and highlighted. */
  currentBook: string
  currentChapter: number
  /** Where each book was left, keyed by book key — drives the "continuar" badges. */
  bookmarks: ReadonlyMap<string, { chapter: number; verse: number }>
  onSelect: (book: string, chapter: number, verse: number) => void
  onClose: () => void
}

/**
 * Full-screen book/chapter picker for the New Testament reader. Tapping a book
 * expands its chapter grid in place rather than pushing a second screen — 27 books
 * and at most 28 chapters fit comfortably, and staying on one surface means one tap
 * to change your mind about the book.
 *
 * A book you have read before also carries its bookmark on the right: tapping the
 * badge resumes on that exact verse, one tap, no expanding. The two gestures are
 * deliberately different — the badge means "back to where I stopped", a chapter in
 * the grid means "take me to this chapter", which starts at its first verse. The
 * bookmarked chapter is ringed in the grid so the two never disagree silently.
 */
export function NtBookPicker({
  currentBook,
  currentChapter,
  bookmarks,
  onSelect,
  onClose,
}: NtBookPickerProps) {
  const [expanded, setExpanded] = useState(currentBook)

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.15 }}
      className="fixed inset-0 z-[60] flex flex-col bg-surface dark:bg-surface-dark"
    >
      <header className="shrink-0 border-b border-border dark:border-border-dark pt-[var(--safe-area-top)]">
        <div className="flex items-center px-2 h-14 mx-auto w-full max-w-2xl">
          <button
            onClick={onClose}
            className="p-2 text-text-secondary dark:text-text-secondary-dark hover:bg-surface-secondary dark:hover:bg-surface-secondary-dark rounded-full transition-colors"
            aria-label="Fechar"
          >
            <X className="w-5 h-5" />
          </button>
          <h1 className="flex-1 text-center font-heading text-base font-semibold text-text-primary dark:text-text-primary-dark">
            Novo Testamento
          </h1>
          <div className="w-9" aria-hidden="true" />
        </div>
      </header>

      <div className="flex-1 overflow-y-auto">
        <div className="mx-auto w-full max-w-2xl pb-[calc(2rem+var(--safe-area-bottom))]">
          {NT_BOOKS.map((book) => {
            const isExpanded = expanded === book.key
            const isCurrent = currentBook === book.key
            const saved = bookmarks.get(book.key)
            // A bookmark on 1,1 is no bookmark at all — every book merely passed
            // through on the way somewhere else has one, and "continuar em 1,1" would
            // cost 27 chapter counts to say nothing. Only somewhere you actually got
            // to counts as a place to return to.
            const bookmark = saved && (saved.chapter > 1 || saved.verse > 1) ? saved : undefined
            // The open book's bookmark is where you already are, so it gets no
            // "continuar" badge either — it would be a button that does nothing.
            const resume = isCurrent ? undefined : bookmark
            return (
              <div key={book.key} className="border-b border-border/40 dark:border-border-dark/40">
                <div className="flex items-center">
                  <button
                    onClick={() => setExpanded(isExpanded ? '' : book.key)}
                    className="flex-1 min-w-0 flex items-baseline gap-3 px-4 py-3 text-left hover:bg-surface-secondary dark:hover:bg-surface-secondary-dark transition-colors"
                    aria-expanded={isExpanded}
                  >
                    <span
                      className={`font-heading text-sm w-10 shrink-0 ${
                        isCurrent
                          ? 'text-primary dark:text-primary-light font-semibold'
                          : 'text-text-muted dark:text-text-muted-dark'
                      }`}
                    >
                      {book.abbr}
                    </span>
                    <span
                      className={`flex-1 truncate ${
                        isCurrent
                          ? 'text-primary dark:text-primary-light font-semibold'
                          : 'text-text-primary dark:text-text-primary-dark'
                      }`}
                    >
                      {book.name}
                    </span>
                    {!resume && (
                      <span className="text-xs text-text-muted dark:text-text-muted-dark tabular-nums shrink-0">
                        {book.chapters}
                      </span>
                    )}
                  </button>

                  {resume && (
                    // Pill inside a taller, transparent button: the badge stays small
                    // enough not to shout over 27 rows, the thumb target does not.
                    <button
                      onClick={() => onSelect(book.key, resume.chapter, resume.verse)}
                      className="group shrink-0 flex items-center py-3 pl-2 pr-4"
                      aria-label={`Continuar ${book.name} em ${resume.chapter},${resume.verse}`}
                    >
                      <span className="flex items-center gap-1 rounded-full px-2.5 py-1 text-xs tabular-nums text-primary dark:text-primary-light bg-primary/10 dark:bg-primary-light/15 group-hover:bg-primary/20 dark:group-hover:bg-primary-light/25 transition-colors">
                        <Bookmark className="w-3 h-3 shrink-0" strokeWidth={2.5} />
                        {resume.chapter},{resume.verse}
                      </span>
                    </button>
                  )}
                </div>

                {isExpanded && (
                  <div className="grid grid-cols-7 gap-1.5 px-4 pb-4 sm:grid-cols-10">
                    {Array.from({ length: book.chapters }, (_, i) => i + 1).map((c) => {
                      const active = isCurrent && c === currentChapter
                      const marked = !active && bookmark?.chapter === c
                      return (
                        <button
                          key={c}
                          onClick={() => onSelect(book.key, c, 1)}
                          className={`h-10 rounded-lg text-sm tabular-nums transition-colors ${
                            active
                              ? 'bg-primary text-white dark:bg-primary-light dark:text-surface-dark font-semibold'
                              : `bg-surface-secondary text-text-primary dark:bg-surface-secondary-dark dark:text-text-primary-dark hover:bg-border dark:hover:bg-border-dark ${
                                  marked
                                    ? 'ring-1 ring-inset ring-primary/50 dark:ring-primary-light/50'
                                    : ''
                                }`
                          }`}
                        >
                          {c}
                        </button>
                      )
                    })}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>
    </motion.div>
  )
}
