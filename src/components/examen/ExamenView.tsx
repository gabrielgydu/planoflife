import { useState } from 'react'
import { Link } from 'react-router'
import { Plus, BookOpen, HelpCircle } from 'lucide-react'
import { Header } from '../layout/Header'
import { ExamenEntryCard } from './ExamenEntryCard'
import { ExamenEntryForm } from './ExamenEntryForm'
import { Spinner } from '../shared/Spinner'
import { useExamenEntries } from '../../hooks/useExamen'
import { useProposito } from '../../hooks/usePropositos'
import { formatDate, getToday, addDay, subDay } from '../../utils/dates'
import { EXAMEN_COLORS, EXAMEN_LABELS } from '../../utils/constants'
import type { ExamenCategory, ExamenEntry } from '../../types'

export function ExamenView() {
  const [currentDate, setCurrentDate] = useState(getToday)
  const [showEntryForm, setShowEntryForm] = useState(false)
  const [formCategory, setFormCategory] = useState<ExamenCategory>('gracias')
  const [editingEntry, setEditingEntry] = useState<ExamenEntry | null>(null)

  const dateStr = formatDate(currentDate)
  const tomorrowStr = formatDate(addDay(currentDate, 1))
  const { entriesByCategory, addEntry, updateEntry, deleteEntry, toggleConfession, isLoading } =
    useExamenEntries(dateStr)
  const { setProposito } = useProposito(tomorrowStr)

  const handlePrevDay = () => setCurrentDate((d) => subDay(d, 1))
  const handleNextDay = () => setCurrentDate((d) => addDay(d, 1))

  const handleAddEntry = (category: ExamenCategory) => {
    setFormCategory(category)
    setEditingEntry(null)
    setShowEntryForm(true)
  }

  const handleEditEntry = (entry: ExamenEntry) => {
    setFormCategory(entry.category)
    setEditingEntry(entry)
    setShowEntryForm(true)
  }

  const handleSaveEntry = async (text: string, isForConfession: boolean) => {
    if (editingEntry) {
      await updateEntry(editingEntry.id, { text, isForConfession })
    } else {
      await addEntry(formCategory, text, isForConfession)
    }
    setShowEntryForm(false)
    setEditingEntry(null)
  }

  const handleMakeProposito = async (entry: ExamenEntry) => {
    await setProposito(entry.text, entry.id)
  }

  if (isLoading) {
    return <Spinner className="h-64" />
  }

  return (
    <div className="flex flex-col min-h-full">
      <Header
        date={currentDate}
        onPrevDay={handlePrevDay}
        onNextDay={handleNextDay}
        rightAction={
          <Link
            to="/examen/confession"
            className="p-2 -mr-2 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-colors"
            aria-label="Confissão"
          >
            <BookOpen className="w-5 h-5" />
          </Link>
        }
      />

      <div className="flex-1 p-4 space-y-6">
        {(['gracias', 'perdon', 'ayudame'] as ExamenCategory[]).map((category) => (
          <section key={category}>
            <div
              className="flex items-center justify-between mb-3 pb-2 border-b-2"
              style={{ borderColor: EXAMEN_COLORS[category] }}
            >
              <h2
                className="text-sm font-semibold uppercase tracking-wide"
                style={{ color: EXAMEN_COLORS[category] }}
              >
                {EXAMEN_LABELS[category]}
              </h2>
              <button
                onClick={() => handleAddEntry(category)}
                className="p-1 hover:bg-slate-100 dark:hover:bg-slate-800 rounded transition-colors"
                style={{ color: EXAMEN_COLORS[category] }}
              >
                <Plus className="w-5 h-5" />
              </button>
            </div>

            {entriesByCategory[category].length === 0 ? (
              <button
                onClick={() => handleAddEntry(category)}
                className="w-full py-4 text-sm text-slate-400 dark:text-slate-500 border border-dashed border-slate-200 dark:border-slate-700 rounded-lg hover:border-slate-300 dark:hover:border-slate-600 transition-colors"
              >
                Toque para adicionar
              </button>
            ) : (
              <div className="space-y-2">
                {entriesByCategory[category].map((entry) => (
                  <ExamenEntryCard
                    key={entry.id}
                    entry={entry}
                    onEdit={() => handleEditEntry(entry)}
                    onDelete={() => deleteEntry(entry.id)}
                    onToggleConfession={() => toggleConfession(entry.id)}
                    onMakeProposito={
                      category === 'ayudame' ? () => handleMakeProposito(entry) : undefined
                    }
                  />
                ))}
              </div>
            )}
          </section>
        ))}

        <div className="pt-4">
          <Link
            to="/examen/questions"
            className="flex items-center justify-center gap-2 py-3 text-sm text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 transition-colors"
          >
            <HelpCircle className="w-4 h-4" />
            Perguntas orientadoras
          </Link>
        </div>
      </div>

      <ExamenEntryForm
        isOpen={showEntryForm}
        category={formCategory}
        entry={editingEntry}
        onSave={handleSaveEntry}
        onClose={() => {
          setShowEntryForm(false)
          setEditingEntry(null)
        }}
      />
    </div>
  )
}
