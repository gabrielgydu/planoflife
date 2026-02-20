import { useState } from 'react'
import { useNavigate } from 'react-router'
import { ChevronLeft, FileText, Lightbulb } from 'lucide-react'
import { format, subMonths } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { generateMonthPdf } from '../../utils/pdf'

export function PdfExport() {
  const navigate = useNavigate()
  const now = new Date()

  const [selectedYear, setSelectedYear] = useState(now.getFullYear())
  const [selectedMonth, setSelectedMonth] = useState(now.getMonth())
  const [isGenerating, setIsGenerating] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Generate month options (last 12 months)
  const monthOptions: { year: number; month: number; label: string }[] = []
  for (let i = 0; i < 12; i++) {
    const date = subMonths(now, i)
    monthOptions.push({
      year: date.getFullYear(),
      month: date.getMonth(),
      label: format(date, "MMMM 'de' yyyy", { locale: ptBR }),
    })
  }

  const handleGenerate = async () => {
    setError(null)
    setIsGenerating(true)

    try {
      await generateMonthPdf(selectedYear, selectedMonth)
    } catch (err) {
      console.error(err)
      setError('Erro ao gerar PDF')
    } finally {
      setIsGenerating(false)
    }
  }

  return (
    <div className="min-h-full">
      <header className="sticky top-0 bg-surface-card/95 dark:bg-surface-card-dark/95 backdrop-blur-sm shadow-[0_1px_3px_rgba(26,32,48,0.04)] z-10">
        <div className="flex items-center px-4 h-16">
          <button
            onClick={() => navigate('/settings')}
            className="p-2 -ml-2 text-text-secondary dark:text-text-secondary-dark hover:bg-surface-secondary dark:hover:bg-surface-secondary-dark rounded-full transition-colors"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <h1 className="flex-1 text-center font-heading text-lg font-semibold text-text-primary dark:text-text-primary-dark pr-10">
            Exportar PDF
          </h1>
        </div>
      </header>

      <div className="p-4 space-y-6">
        {error && (
          <div className="p-4 bg-[#9B6B6B]/10 border border-[#9B6B6B]/30 rounded-lg">
            <p className="text-sm text-[#9B6B6B]">{error}</p>
          </div>
        )}

        <section className="bg-surface-secondary dark:bg-surface-secondary-dark rounded-lg p-4">
          <div className="flex items-start gap-4">
            <FileText className="w-5 h-5 text-text-secondary dark:text-text-secondary-dark mt-0.5" />
            <div className="flex-1">
              <h2 className="text-sm font-semibold text-text-primary dark:text-text-primary-dark mb-1">
                Gerar Relatório Mensal
              </h2>
              <p className="text-xs text-text-muted dark:text-text-muted-dark mb-4">
                Gera um PDF com a grade de práticas do mês, mostrando quais foram feitas a cada dia.
              </p>

              <div className="mb-4">
                <label className="block text-xs font-medium text-text-secondary dark:text-text-secondary-dark mb-2">
                  Selecione o mês
                </label>
                <select
                  value={`${selectedYear}-${selectedMonth}`}
                  onChange={(e) => {
                    const [year, month] = e.target.value.split('-').map(Number)
                    setSelectedYear(year)
                    setSelectedMonth(month)
                  }}
                  className="w-full px-4 py-3 bg-surface-card dark:bg-surface-dark border border-border dark:border-border-dark rounded-lg text-text-primary dark:text-text-primary-dark capitalize focus:outline-none focus:ring-2 focus:ring-primary/50"
                >
                  {monthOptions.map((opt) => (
                    <option key={`${opt.year}-${opt.month}`} value={`${opt.year}-${opt.month}`}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>

              <button
                onClick={handleGenerate}
                disabled={isGenerating}
                className="w-full py-3 text-sm font-medium text-white bg-primary rounded-lg hover:bg-primary-dark disabled:opacity-50 transition-colors"
              >
                {isGenerating ? 'Gerando...' : 'Gerar PDF'}
              </button>
            </div>
          </div>
        </section>

        <div className="p-4 bg-primary/5 border border-primary/15 rounded-lg">
          <div className="flex items-start gap-3">
            <Lightbulb className="w-5 h-5 text-primary dark:text-primary-light mt-0.5 shrink-0" />
            <div>
              <p className="text-sm font-medium text-text-primary dark:text-text-primary-dark mb-1">Dica</p>
              <p className="text-xs text-text-secondary dark:text-text-secondary-dark">
                O PDF é gerado em formato paisagem A4, ideal para imprimir e acompanhar suas práticas
                ao longo do mês.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
