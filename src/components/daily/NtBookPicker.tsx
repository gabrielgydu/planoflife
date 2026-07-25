import { useState } from 'react'
import { motion } from 'motion/react'
import { X } from 'lucide-react'
import { NT_BOOKS } from '../../data/nt/books'

interface NtBookPickerProps {
  /** Book currently open, so it starts expanded and highlighted. */
  currentBook: string
  currentChapter: number
  onSelect: (book: string, chapter: number) => void
  onClose: () => void
}

/**
 * Full-screen book/chapter picker for the New Testament reader. Tapping a book
 * expands its chapter grid in place rather than pushing a second screen — 27 books
 * and at most 28 chapters fit comfortably, and staying on one surface means one tap
 * to change your mind about the book.
 */
export function NtBookPicker({ currentBook, currentChapter, onSelect, onClose }: NtBookPickerProps) {
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
            return (
              <div key={book.key} className="border-b border-border/40 dark:border-border-dark/40">
                <button
                  onClick={() => setExpanded(isExpanded ? '' : book.key)}
                  className="w-full flex items-baseline gap-3 px-4 py-3 text-left hover:bg-surface-secondary dark:hover:bg-surface-secondary-dark transition-colors"
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
                  <span className="text-xs text-text-muted dark:text-text-muted-dark tabular-nums shrink-0">
                    {book.chapters}
                  </span>
                </button>

                {isExpanded && (
                  <div className="grid grid-cols-7 gap-1.5 px-4 pb-4 sm:grid-cols-10">
                    {Array.from({ length: book.chapters }, (_, i) => i + 1).map((c) => {
                      const active = isCurrent && c === currentChapter
                      return (
                        <button
                          key={c}
                          onClick={() => onSelect(book.key, c)}
                          className={`h-10 rounded-lg text-sm tabular-nums transition-colors ${
                            active
                              ? 'bg-primary text-white dark:bg-primary-light dark:text-surface-dark font-semibold'
                              : 'bg-surface-secondary text-text-primary dark:bg-surface-secondary-dark dark:text-text-primary-dark hover:bg-border dark:hover:bg-border-dark'
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
