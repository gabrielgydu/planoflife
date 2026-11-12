import { useState } from 'react'
import { motion } from 'motion/react'
import { Pencil, Plus, Trash2, X } from 'lucide-react'
import { ConfirmDialog } from '../shared/ConfirmDialog'
import type { Jaculatoria } from '../../types'

interface JaculatoriasSheetProps {
  mysteryTitle: string
  items: Jaculatoria[]
  onAdd: (text: string) => Promise<void>
  onUpdate: (id: string, text: string) => Promise<void>
  onDelete: (id: string) => Promise<void>
  onClose: () => void
}

// What the sheet shows: the list, the form for a new jaculatória, or the form
// editing an existing one (its id).
type Mode = { kind: 'list' } | { kind: 'new' } | { kind: 'edit'; id: string }

/**
 * Bottom sheet where the user writes, edits and deletes the jaculatórias of one
 * rosary mystery. Opened from the contemplation reader; a mystery with none opens
 * straight on the form.
 */
export function JaculatoriasSheet({
  mysteryTitle,
  items,
  onAdd,
  onUpdate,
  onDelete,
  onClose,
}: JaculatoriasSheetProps) {
  const [mode, setMode] = useState<Mode>(items.length ? { kind: 'list' } : { kind: 'new' })
  const [text, setText] = useState('')
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null)

  const openForm = (item?: Jaculatoria) => {
    setMode(item ? { kind: 'edit', id: item.id } : { kind: 'new' })
    setText(item ? item.text : '')
  }

  // Leaving the form goes back to the list — or closes the sheet when there is no
  // list to go back to.
  const closeForm = () => {
    setText('')
    if (items.length) setMode({ kind: 'list' })
    else onClose()
  }

  const save = async () => {
    const value = text.trim()
    if (!value) return
    if (mode.kind === 'new') await onAdd(value)
    else if (mode.kind === 'edit') await onUpdate(mode.id, value)
    setText('')
    setMode({ kind: 'list' })
  }

  const confirmDelete = async () => {
    if (!deleteTarget) return
    await onDelete(deleteTarget)
    setDeleteTarget(null)
  }

  return (
    <div className="fixed inset-0 z-40 flex items-end justify-center sm:items-center">
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
        className="relative w-full max-w-lg max-h-[85dvh] flex flex-col bg-surface-card dark:bg-surface-card-dark rounded-t-2xl sm:rounded-2xl shadow-lg"
      >
        <div className="shrink-0 flex items-start gap-2 p-4 border-b border-border dark:border-border-dark">
          <div className="flex-1 min-w-0">
            <h2 className="font-heading text-lg font-semibold text-text-primary dark:text-text-primary-dark">
              {mode.kind === 'new' ? 'Nova jaculatória' : mode.kind === 'edit' ? 'Editar jaculatória' : 'Jaculatórias'}
            </h2>
            <p className="text-sm text-text-muted dark:text-text-muted-dark truncate">{mysteryTitle}</p>
          </div>
          <button
            onClick={onClose}
            className="p-2 -mr-2 -mt-1 text-text-secondary dark:text-text-secondary-dark hover:bg-surface-secondary dark:hover:bg-surface-secondary-dark rounded-full transition-colors"
            aria-label="Fechar"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {mode.kind === 'list' ? (
          <div className="flex-1 min-h-0 overflow-y-auto pb-[var(--safe-area-bottom)]">
            <ul className="divide-y divide-border/30 dark:divide-border-dark">
              {items.map((item) => (
                <li key={item.id} className="flex items-start gap-2 px-4 py-3">
                  <p className="flex-1 min-w-0 py-1.5 text-sm text-text-primary dark:text-text-primary-dark whitespace-pre-line">
                    {item.text}
                  </p>
                  <button
                    onClick={() => openForm(item)}
                    className="p-1.5 text-text-muted hover:text-text-secondary dark:hover:text-text-secondary-dark transition-colors"
                    aria-label="Editar jaculatória"
                  >
                    <Pencil className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => setDeleteTarget(item.id)}
                    className="p-1.5 text-text-muted hover:text-[#9B6B6B] transition-colors"
                    aria-label="Excluir jaculatória"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </li>
              ))}
            </ul>
            <div className="p-4">
              <button
                onClick={() => openForm()}
                className="w-full py-3 text-sm font-medium text-text-secondary dark:text-text-secondary-dark bg-surface-secondary dark:bg-surface-secondary-dark rounded-lg flex items-center justify-center gap-2"
              >
                <Plus className="w-4 h-4" />
                Adicionar jaculatória
              </button>
            </div>
          </div>
        ) : (
          <div className="p-4 space-y-4 pb-[calc(1rem+var(--safe-area-bottom))]">
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="Escreva a jaculatória…"
              className="w-full h-32 px-4 py-3 bg-surface-secondary dark:bg-surface-dark border border-border dark:border-border-dark rounded-lg text-text-primary dark:text-text-primary-dark resize-none focus:outline-none focus:ring-2 focus:ring-primary/50 dark:focus:ring-ring-dark/30"
              autoFocus
            />
            <div className="flex gap-3">
              <button
                onClick={closeForm}
                className="flex-1 py-3 text-sm font-medium text-text-secondary dark:text-text-secondary-dark bg-surface-secondary dark:bg-surface-secondary-dark rounded-lg"
              >
                Cancelar
              </button>
              <button
                onClick={save}
                disabled={!text.trim()}
                className="flex-1 py-3 text-sm font-medium text-btn-text dark:text-btn-dark-text bg-btn dark:bg-btn-dark rounded-lg disabled:opacity-50"
              >
                Salvar
              </button>
            </div>
          </div>
        )}
      </motion.div>

      <ConfirmDialog
        isOpen={deleteTarget !== null}
        title="Excluir jaculatória"
        message="Tem certeza que deseja excluir esta jaculatória?"
        confirmLabel="Excluir"
        variant="danger"
        onConfirm={confirmDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  )
}
