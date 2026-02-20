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
      <div className="p-4 bg-surface-secondary dark:bg-surface-secondary-dark border border-border dark:border-border-dark rounded-lg">
        <div className="flex items-start gap-3">
          <Target className="w-5 h-5 text-primary dark:text-primary-light mt-0.5 shrink-0" />
          <div className="flex-1">
            <p className="text-xs font-heading font-medium text-text-secondary dark:text-text-secondary-dark uppercase tracking-wide mb-1">
              Propósito de hoje
            </p>
            <p className="text-sm italic text-text-primary dark:text-text-primary-dark">{proposito.text}</p>
          </div>
        </div>
      </div>
    )
  }

  if (showForm) {
    return (
      <div className="p-4 bg-surface-secondary dark:bg-surface-secondary-dark border border-border dark:border-border-dark rounded-lg">
        <p className="text-xs font-heading font-medium text-text-muted dark:text-text-muted-dark uppercase tracking-wide mb-2">
          Definir propósito de hoje
        </p>
        <div className="flex gap-2">
          <input
            type="text"
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Qual é seu propósito hoje?"
            className="flex-1 px-3 py-2 text-sm bg-surface-card dark:bg-surface-dark border border-border dark:border-border-dark rounded-lg text-text-primary dark:text-text-primary-dark placeholder-text-muted focus:outline-none focus:ring-2 focus:ring-primary/50"
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
            className="px-3 py-2 text-sm text-text-muted hover:text-text-secondary dark:hover:text-text-secondary-dark"
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
      className="w-full p-3 text-sm text-text-muted dark:text-text-muted-dark border border-dashed border-border dark:border-border-dark rounded-lg hover:border-text-muted dark:hover:border-text-muted-dark hover:text-text-secondary dark:hover:text-text-secondary-dark transition-colors flex items-center justify-center gap-2"
    >
      <Target className="w-4 h-4" />
      <span>Definir propósito do dia</span>
    </button>
  )
}
