import { Check, Pencil, Trash2, ArrowRight } from 'lucide-react'
import { EXAMEN_COLORS } from '../../utils/constants'
import type { ExamenEntry } from '../../types'

interface ExamenEntryCardProps {
  entry: ExamenEntry
  onEdit: () => void
  onDelete: () => void
  onToggleConfession: () => void
  onMakeProposito?: () => void
}

export function ExamenEntryCard({
  entry,
  onEdit,
  onDelete,
  onToggleConfession,
  onMakeProposito,
}: ExamenEntryCardProps) {
  const color = EXAMEN_COLORS[entry.category]

  return (
    <div
      className="relative bg-white dark:bg-slate-800 rounded-lg shadow-sm border border-slate-200 dark:border-slate-700 overflow-hidden"
      style={{ borderLeftWidth: 4, borderLeftColor: color }}
    >
      <div className="p-3">
        <p className="text-sm text-slate-900 dark:text-slate-100 whitespace-pre-wrap">{entry.text}</p>

        <div className="flex items-center justify-between mt-3 pt-2 border-t border-slate-100 dark:border-slate-700">
          <div className="flex items-center gap-2">
            {entry.category === 'perdon' && (
              <button
                onClick={onToggleConfession}
                className={`flex items-center gap-1 text-xs px-2 py-1 rounded-full transition-colors ${
                  entry.isForConfession
                    ? 'bg-red-100 dark:bg-red-500/20 text-red-600 dark:text-red-400'
                    : 'bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400'
                }`}
              >
                {entry.isForConfession ? (
                  <Check className="w-3 h-3" />
                ) : (
                  <span className="w-3 h-3 rounded-full border border-current" />
                )}
                Confissão
              </button>
            )}

            {onMakeProposito && (
              <button
                onClick={onMakeProposito}
                className="flex items-center gap-1 text-xs px-2 py-1 rounded-full bg-amber-100 dark:bg-amber-500/20 text-amber-600 dark:text-amber-400 hover:bg-amber-200 dark:hover:bg-amber-500/30 transition-colors"
              >
                <ArrowRight className="w-3 h-3" />
                Propósito
              </button>
            )}
          </div>

          <div className="flex items-center gap-1">
            <button
              onClick={onEdit}
              className="p-1.5 text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 rounded transition-colors"
            >
              <Pencil className="w-4 h-4" />
            </button>
            <button
              onClick={onDelete}
              className="p-1.5 text-slate-400 dark:text-slate-500 hover:text-red-600 dark:hover:text-red-400 hover:bg-slate-100 dark:hover:bg-slate-700 rounded transition-colors"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
