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
    <header className="sticky top-0 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-700 z-10">
      <div className="flex items-center justify-between px-4 h-14">
        <button
          onClick={onPrevDay}
          className="p-2 -ml-2 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-colors"
          aria-label="Dia anterior"
        >
          <ChevronLeft className="w-5 h-5" />
        </button>

        <div className="flex-1 text-center">
          {title ? (
            <h1 className="text-lg font-semibold text-slate-900 dark:text-slate-100">{title}</h1>
          ) : (
            <h1 className="text-sm font-medium text-slate-900 dark:text-slate-100 capitalize">
              {dateStr}
              {todayLabel && <span className="text-primary dark:text-indigo-400">{todayLabel}</span>}
            </h1>
          )}
        </div>

        {rightAction ? (
          rightAction
        ) : (
          <button
            onClick={onNextDay}
            className="p-2 -mr-2 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-colors"
            aria-label="Próximo dia"
          >
            <ChevronRight className="w-5 h-5" />
          </button>
        )}
      </div>
    </header>
  )
}
