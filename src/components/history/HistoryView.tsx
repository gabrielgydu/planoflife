import { useState } from 'react'
import { Link } from 'react-router'
import { ChevronLeft, ChevronRight, FileText } from 'lucide-react'
import { MonthGrid } from './MonthGrid'
import { format, addMonths, subMonths, startOfMonth } from 'date-fns'
import { ptBR } from 'date-fns/locale'

export function HistoryView() {
  const [currentMonth, setCurrentMonth] = useState(() => startOfMonth(new Date()))

  const handlePrevMonth = () => setCurrentMonth((d) => subMonths(d, 1))
  const handleNextMonth = () => setCurrentMonth((d) => addMonths(d, 1))

  const monthLabel = format(currentMonth, "MMMM 'de' yyyy", { locale: ptBR })

  return (
    <div className="flex flex-col min-h-full">
      <header className="sticky top-0 bg-surface-card/95 dark:bg-surface-card-dark/95 backdrop-blur-sm shadow-[0_1px_3px_rgba(26,32,48,0.04)] z-10">
        <div className="flex items-center justify-between px-4 h-16">
          <button
            onClick={handlePrevMonth}
            className="p-2 -ml-2 text-text-secondary dark:text-text-secondary-dark hover:bg-surface-secondary dark:hover:bg-surface-secondary-dark rounded-full transition-colors"
            aria-label="Mês anterior"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>

          <h1 className="font-heading text-lg font-semibold text-text-primary dark:text-text-primary-dark capitalize">
            {monthLabel}
          </h1>

          <button
            onClick={handleNextMonth}
            className="p-2 -mr-2 text-text-secondary dark:text-text-secondary-dark hover:bg-surface-secondary dark:hover:bg-surface-secondary-dark rounded-full transition-colors"
            aria-label="Próximo mês"
          >
            <ChevronRight className="w-5 h-5" />
          </button>
        </div>
      </header>

      <MonthGrid month={currentMonth} />

      <div className="p-4 border-t border-border dark:border-border-dark">
        <Link
          to="/settings/pdf"
          className="flex items-center justify-center gap-2 py-3 text-sm font-medium text-primary dark:text-primary-light bg-primary/5 rounded-lg hover:bg-primary/10 transition-colors"
        >
          <FileText className="w-5 h-5" />
          Exportar PDF do mês
        </Link>
      </div>
    </div>
  )
}
