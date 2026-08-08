import { useState } from 'react'
import { motion } from 'motion/react'
import { Link, useParams } from 'react-router'
import { Plus, BookOpen, CalendarDays, HelpCircle } from 'lucide-react'
import { Header } from '../layout/Header'
import { ExamenEntryCard } from './ExamenEntryCard'
import { ExamenEntryForm } from './ExamenEntryForm'
import { Spinner } from '../shared/Spinner'
import { useExamenEntries } from '../../hooks/useExamen'
import { usePropositoTarget, setPropositoForDate } from '../../hooks/usePropositos'
import { formatDate, getToday, parseDate, addDay, subDay } from '../../utils/dates'
import { EXAMEN_COLORS, EXAMEN_LABELS } from '../../utils/constants'
import type { ExamenCategory, ExamenEntry } from '../../types'

// The examen's three sibling pages. They used to be split across two
// presentations — Histórico and Confissão as bare icons in the day header,
// Perguntas as a labelled link at the foot of the page — which left the header
// too crowded to show a long date: "quarta-feira, 30 de setembro" truncated on
// a phone once the header also had to carry both day chevrons. One labelled row
// above the content keeps all three a single tap away, gives the date the whole
// header, and names what the two icons never did.
const EXAMEN_LINKS = [
  { to: '/examen/history', label: 'Histórico', icon: CalendarDays },
  { to: '/examen/confession', label: 'Confissão', icon: BookOpen },
  { to: '/examen/questions', label: 'Perguntas', icon: HelpCircle },
]

export function ExamenView() {
  const { date: dateParam } = useParams<{ date: string }>()
  const [currentDate, setCurrentDate] = useState(() =>
    dateParam ? parseDate(dateParam) : getToday()
  )
  const [showEntryForm, setShowEntryForm] = useState(false)
  const [formCategory, setFormCategory] = useState<ExamenCategory>('gracias')
  const [editingEntry, setEditingEntry] = useState<ExamenEntry | null>(null)

  const dateStr = formatDate(currentDate)
  // Keyed off the clock, not the viewed day: a propósito is for the day you can
  // still live it out on, even when promoted from an older examen.
  const propositoTarget = usePropositoTarget()
  const { entriesByCategory, addEntry, updateEntry, deleteEntry, toggleConfession, isLoading } =
    useExamenEntries(dateStr)

  const handlePrevDay = () => setCurrentDate((d) => subDay(d, 1))
  const handleNextDay = () => setCurrentDate((d) => addDay(d, 1))
  const handleToday = () => setCurrentDate(getToday())

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
    await setPropositoForDate(propositoTarget.date, entry.text, entry.id)
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
        onToday={handleToday}
      />

      <nav className="flex mx-auto w-full max-w-2xl border-b border-border dark:border-border-dark">
        {EXAMEN_LINKS.map((link) => (
          <Link
            key={link.to}
            to={link.to}
            className="flex-1 flex items-center justify-center gap-2 py-3 text-xs text-text-secondary dark:text-text-secondary-dark hover:text-text-primary dark:hover:text-text-primary-dark hover:bg-surface-secondary dark:hover:bg-surface-secondary-dark transition-colors"
          >
            <link.icon className="w-4 h-4 shrink-0" />
            {link.label}
          </Link>
        ))}
      </nav>

      <motion.div
        className="flex-1 p-4 space-y-8 mx-auto w-full max-w-2xl"
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.2 }}
        key={dateStr}
      >
        {(['gracias', 'perdon', 'ayudame'] as ExamenCategory[]).map((category) => (
          <section key={category}>
            <div
              className="flex items-center justify-between mb-3 pb-2 border-b-2"
              style={{ borderColor: EXAMEN_COLORS[category] }}
            >
              <h2
                className="font-heading text-sm font-semibold uppercase tracking-widest"
                style={{ color: EXAMEN_COLORS[category] }}
              >
                {EXAMEN_LABELS[category]}
              </h2>
              <button
                onClick={() => handleAddEntry(category)}
                className="p-1 hover:bg-surface-secondary dark:hover:bg-surface-secondary-dark rounded transition-colors"
                style={{ color: EXAMEN_COLORS[category] }}
              >
                <Plus className="w-5 h-5" />
              </button>
            </div>

            {entriesByCategory[category].length === 0 ? (
              <button
                onClick={() => handleAddEntry(category)}
                className="w-full py-4 text-sm text-text-muted dark:text-text-muted-dark border border-dashed border-border dark:border-border-dark rounded-lg hover:border-text-muted dark:hover:border-text-muted-dark transition-colors"
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
                    propositoTargetLabel={propositoTarget.isTomorrow ? 'amanhã' : 'hoje'}
                  />
                ))}
              </div>
            )}
          </section>
        ))}
      </motion.div>

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
