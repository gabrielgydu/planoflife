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
      <header className="sticky top-0 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-700 z-10">
        <div className="flex items-center justify-between px-4 h-14">
          <button
            onClick={handlePrevMonth}
            className="p-2 -ml-2 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-colors"
            aria-label="Mês anterior"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>

          <h1 className="text-lg font-semibold text-slate-900 dark:text-slate-100 capitalize">
            {monthLabel}
          </h1>

          <button
            onClick={handleNextMonth}
            className="p-2 -mr-2 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-colors"
            aria-label="Próximo mês"
          >
            <ChevronRight className="w-5 h-5" />
          </button>
        </div>
      </header>

      <MonthGrid month={currentMonth} />

      <div className="p-4 border-t border-slate-200 dark:border-slate-700">
        <Link
          to="/settings/pdf"
          className="flex items-center justify-center gap-2 py-3 text-sm font-medium text-primary dark:text-indigo-400 bg-primary/5 rounded-lg hover:bg-primary/10 transition-colors"
        >
          <FileText className="w-5 h-5" />
          Exportar PDF do mês
        </Link>
      </div>
    </div>
  )
}
