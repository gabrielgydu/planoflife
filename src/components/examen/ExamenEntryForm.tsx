import { useState, useEffect } from 'react'
import { X, Check } from 'lucide-react'
import { EXAMEN_COLORS, EXAMEN_LABELS } from '../../utils/constants'
import type { ExamenCategory, ExamenEntry } from '../../types'

interface ExamenEntryFormProps {
  isOpen: boolean
  category: ExamenCategory
  entry: ExamenEntry | null
  onSave: (text: string, isForConfession: boolean) => void
  onClose: () => void
}

export function ExamenEntryForm({ isOpen, category, entry, onSave, onClose }: ExamenEntryFormProps) {
  const [text, setText] = useState('')
  const [isForConfession, setIsForConfession] = useState(false)

  useEffect(() => {
    if (entry) {
      setText(entry.text)
      setIsForConfession(entry.isForConfession)
    } else {
      setText('')
      setIsForConfession(false)
    }
  }, [entry, isOpen])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!text.trim()) return
    onSave(text.trim(), isForConfession)
    setText('')
    setIsForConfession(false)
  }

  if (!isOpen) return null

  const color = EXAMEN_COLORS[category]

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative w-full max-w-lg bg-white dark:bg-slate-800 rounded-t-2xl shadow-lg">
        <div className="p-4 border-b border-slate-200 dark:border-slate-700">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold" style={{ color }}>
              {EXAMEN_LABELS[category]}
            </h2>
            <button
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="p-4 space-y-4">
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder={`O que você ${
              category === 'gracias'
                ? 'agradece a Deus'
                : category === 'perdon'
                  ? 'pede perdão'
                  : 'pede ajuda'
            }?`}
            className="w-full h-32 px-4 py-3 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100 resize-none focus:outline-none focus:ring-2 focus:ring-primary/50"
            autoFocus
          />

          {category === 'perdon' && (
            <label className="flex items-center gap-3 py-2">
              <button
                type="button"
                onClick={() => setIsForConfession(!isForConfession)}
                className={`w-6 h-6 rounded-md border-2 flex items-center justify-center transition-colors ${
                  isForConfession
                    ? 'bg-red-500 border-red-500'
                    : 'border-slate-300 dark:border-slate-600'
                }`}
              >
                {isForConfession && <Check className="w-4 h-4 text-white" strokeWidth={3} />}
              </button>
              <span className="text-sm text-slate-600 dark:text-slate-400">
                Incluir na lista de confissão
              </span>
            </label>
          )}

          <div className="flex gap-3 pt-2 pb-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-3 text-sm font-medium text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-700 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={!text.trim()}
              className="flex-1 py-3 text-sm font-medium text-white rounded-lg transition-colors disabled:opacity-50"
              style={{ backgroundColor: color }}
            >
              {entry ? 'Salvar' : 'Adicionar'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
