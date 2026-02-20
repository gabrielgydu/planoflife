import { ChevronLeft, ChevronRight } from 'lucide-react'
import { formatDateLong, isToday } from '../../utils/dates'

interface HeaderProps {
  date: Date
  onPrevDay: () => void
  onNextDay: () => void
  title?: string
  rightAction?: React.ReactNode
}

export function Header({ date, onPrevDay, onNextDay, title, rightAction }: HeaderProps) {
  const dateStr = formatDateLong(date)
  const todayLabel = isToday(date) ? ' (Hoje)' : ''

  return (
    <header className="sticky top-0 bg-surface-card/95 dark:bg-surface-card-dark/95 backdrop-blur-sm shadow-[0_1px_3px_rgba(26,32,48,0.04)] z-10">
      <div className="flex items-center justify-between px-4 h-16">
        <button
          onClick={onPrevDay}
          className="p-2 -ml-2 text-text-secondary dark:text-text-secondary-dark hover:bg-surface-secondary dark:hover:bg-surface-secondary-dark rounded-full transition-colors"
          aria-label="Dia anterior"
        >
          <ChevronLeft className="w-5 h-5" />
        </button>

        <div className="flex-1 text-center">
          {title ? (
            <h1 className="font-heading text-lg font-semibold text-text-primary dark:text-text-primary-dark">{title}</h1>
          ) : (
            <h1 className="font-heading text-base font-medium text-text-primary dark:text-text-primary-dark capitalize">
              {dateStr}
              {todayLabel && <span className="text-primary dark:text-primary-light">{todayLabel}</span>}
            </h1>
          )}
        </div>

        {rightAction ? (
          rightAction
        ) : (
          <button
            onClick={onNextDay}
            className="p-2 -mr-2 text-text-secondary dark:text-text-secondary-dark hover:bg-surface-secondary dark:hover:bg-surface-secondary-dark rounded-full transition-colors"
            aria-label="Próximo dia"
          >
            <ChevronRight className="w-5 h-5" />
          </button>
        )}
      </div>
    </header>
  )
}
