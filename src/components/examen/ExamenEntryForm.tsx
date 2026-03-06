import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'motion/react'
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

  const color = EXAMEN_COLORS[category]

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-end justify-center">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="absolute inset-0 bg-black/40"
            onClick={onClose}
          />
          <motion.div
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 30, stiffness: 300 }}
            className="relative w-full max-w-lg bg-surface-card dark:bg-surface-card-dark rounded-t-2xl shadow-lg"
          >
            <div className="p-4 border-b border-border dark:border-border-dark">
              <div className="flex items-center justify-between">
                <h2 className="font-heading text-lg font-semibold" style={{ color }}>
                  {EXAMEN_LABELS[category]}
                </h2>
                <button
                  onClick={onClose}
                  className="p-2 text-text-muted hover:text-text-secondary dark:hover:text-text-secondary-dark transition-colors"
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
                className="w-full h-32 px-4 py-3 bg-surface-secondary dark:bg-surface-dark border border-border dark:border-border-dark rounded-lg text-text-primary dark:text-text-primary-dark resize-none focus:outline-none focus:ring-2 focus:ring-primary/50 dark:focus:ring-ring-dark/30"
                autoFocus
              />

              {category === 'perdon' && (
                <label className="flex items-center gap-3 py-2">
                  <button
                    type="button"
                    onClick={() => setIsForConfession(!isForConfession)}
                    className={`w-6 h-6 rounded-md border-2 flex items-center justify-center transition-colors ${
                      isForConfession
                        ? 'bg-[#9B6B6B] border-[#9B6B6B]'
                        : 'border-border dark:border-border-dark'
                    }`}
                  >
                    {isForConfession && <Check className="w-4 h-4 text-white" strokeWidth={3} />}
                  </button>
                  <span className="text-sm text-text-secondary dark:text-text-secondary-dark">
                    Incluir na lista de confissão
                  </span>
                </label>
              )}

              <div className="flex gap-3 pt-2 pb-4">
                <button
                  type="button"
                  onClick={onClose}
                  className="flex-1 py-3 text-sm font-medium text-text-secondary dark:text-text-secondary-dark bg-surface-secondary dark:bg-surface-secondary-dark rounded-lg hover:bg-border dark:hover:bg-border-dark transition-colors"
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
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  )
}
