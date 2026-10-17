import { useState } from 'react'
import { useNavigate, useParams } from 'react-router'
import { motion } from 'motion/react'
import { BookX, ChevronLeft } from 'lucide-react'
import { EmptyState } from '../shared/EmptyState'
import { ChapterRow } from './PointRows'
import { SectionHeading } from './SectionHeading'
import { bookMax } from '../../data/meditation'
import { CHAPTERS, bookLabel, isBookKey, isPointInBook, pointPath } from '../../data/escriva'
import { useBackState, useGoBack } from '../../hooks/useBackNavigation'

/**
 * One of St. Josemaría's books: a field to open a point by its number, then the
 * table of contents — every chapter with its range of points. A chapter opens the
 * reader at its first point.
 */
export function PointBookView() {
  const { book } = useParams<{ book: string }>()
  const navigate = useNavigate()
  const goBack = useGoBack('/devocionario')
  const backState = useBackState()
  const [number, setNumber] = useState('')
  const [invalid, setInvalid] = useState(false)

  if (!isBookKey(book)) {
    return (
      <EmptyState
        icon={BookX}
        message="Livro não encontrado"
        action={{ label: 'Voltar ao devocionário', to: '/devocionario' }}
      />
    )
  }

  const max = bookMax(book)

  const openPoint = (e: React.FormEvent) => {
    e.preventDefault()
    const n = Number(number.trim())
    if (!isPointInBook(book, n)) {
      setInvalid(true)
      return
    }
    navigate(pointPath(book, n), { state: backState })
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.2 }}
      className="min-h-full flex flex-col bg-surface dark:bg-surface-dark"
    >
      <header className="sticky top-0 z-10 bg-surface-card dark:bg-surface-card-dark border-b border-border dark:border-border-dark">
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
              São Josemaria
            </p>
            <h1 className="font-heading text-base font-semibold text-text-primary dark:text-text-primary-dark truncate mt-0.5">
              {bookLabel(book)}
            </h1>
          </div>
          {/* Balances the back button so the title stays centred. */}
          <span className="w-9 shrink-0" aria-hidden="true" />
        </div>
      </header>

      <div className="mx-auto w-full max-w-2xl pb-24">
        <form onSubmit={openPoint} className="px-4 py-4 flex items-start gap-2">
          <div className="flex-1 min-w-0">
            <input
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              value={number}
              onChange={(e) => {
                setNumber(e.target.value.replace(/\D/g, ''))
                setInvalid(false)
              }}
              className={`w-full px-3 py-2.5 text-sm bg-surface-secondary dark:bg-surface-secondary-dark border rounded-lg text-text-primary dark:text-text-primary-dark placeholder:text-text-muted dark:placeholder:text-text-muted-dark focus:outline-none focus:ring-2 focus:ring-primary/50 ${
                invalid ? 'border-[#9B6B6B]' : 'border-border dark:border-border-dark'
              }`}
              placeholder={`Número do ponto (1–${max})`}
              aria-label={`Número do ponto em ${bookLabel(book)}`}
              aria-invalid={invalid}
              aria-describedby={invalid ? 'point-number-error' : undefined}
            />
            {invalid && (
              <p id="point-number-error" className="mt-1.5 text-xs text-[#9B6B6B] dark:text-gray-400">
                {bookLabel(book)} vai do ponto 1 ao {max}.
              </p>
            )}
          </div>
          <button
            type="submit"
            disabled={!number}
            className="shrink-0 px-4 py-2.5 rounded-lg text-sm font-medium bg-btn dark:bg-btn-dark text-btn-text dark:text-btn-dark-text disabled:opacity-40"
          >
            Abrir
          </button>
        </form>

        <div className="divide-y divide-border/30 dark:divide-border-dark">
          <SectionHeading>
            {CHAPTERS[book].length} capítulos · {max} pontos
          </SectionHeading>
          {CHAPTERS[book].map((chapter) => (
            <ChapterRow key={chapter.slug} book={book} chapter={chapter} />
          ))}
        </div>
      </div>
    </motion.div>
  )
}
