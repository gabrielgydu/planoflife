import { useState } from 'react'
import { Target, X } from 'lucide-react'
import type { Proposito } from '../../types'

interface PropositoCardProps {
  proposito: Proposito | undefined
  onSetProposito: (text: string) => void
}

export function PropositoCard({ proposito, onSetProposito }: PropositoCardProps) {
  const [showForm, setShowForm] = useState(false)
  const [text, setText] = useState('')

  const handleSubmit = () => {
    if (!text.trim()) return
    onSetProposito(text.trim())
    setText('')
    setShowForm(false)
  }

  if (proposito) {
    return (
      <div className="p-4 bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/30 rounded-lg">
        <div className="flex items-start gap-3">
          <Target className="w-5 h-5 text-amber-600 dark:text-amber-400 mt-0.5 shrink-0" />
          <div className="flex-1">
            <p className="text-xs font-medium text-amber-700 dark:text-amber-400 uppercase tracking-wide mb-1">
              Propósito de hoje
            </p>
            <p className="text-sm text-slate-900 dark:text-slate-100">{proposito.text}</p>
          </div>
        </div>
      </div>
    )
  }

  if (showForm) {
    return (
      <div className="p-4 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-lg">
        <p className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-2">
          Definir propósito de hoje
        </p>
        <div className="flex gap-2">
          <input
            type="text"
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Qual é seu propósito hoje?"
            className="flex-1 px-3 py-2 text-sm bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-primary/50"
            autoFocus
          />
          <button
            onClick={handleSubmit}
            disabled={!text.trim()}
            className="px-4 py-2 text-sm font-medium text-white bg-primary rounded-lg disabled:opacity-50"
          >
            OK
          </button>
          <button
            onClick={() => setShowForm(false)}
            className="px-3 py-2 text-sm text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>
    )
  }

  return (
    <button
      onClick={() => setShowForm(true)}
      className="w-full p-3 text-sm text-slate-400 dark:text-slate-500 border border-dashed border-slate-200 dark:border-slate-700 rounded-lg hover:border-slate-300 dark:hover:border-slate-600 hover:text-slate-500 dark:hover:text-slate-400 transition-colors flex items-center justify-center gap-2"
    >
      <Target className="w-4 h-4" />
      <span>Definir propósito do dia</span>
    </button>
  )
}
