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
      className="relative bg-surface-card dark:bg-surface-card-dark rounded-lg shadow-sm border border-border dark:border-border-dark overflow-hidden"
      style={{ borderLeftWidth: 3, borderLeftColor: color }}
    >
      <div className="p-3">
        <p className="text-sm text-text-primary dark:text-text-primary-dark whitespace-pre-wrap">{entry.text}</p>

        <div className="flex items-center justify-between mt-3 pt-2 border-t border-border/30 dark:border-border-dark">
          <div className="flex items-center gap-2">
            {entry.category === 'perdon' && (
              <button
                onClick={onToggleConfession}
                className={`flex items-center gap-1 text-xs px-2 py-1 rounded-full transition-colors ${
                  entry.isForConfession
                    ? 'bg-[#9B6B6B]/15 text-[#9B6B6B]'
                    : 'bg-surface-secondary dark:bg-surface-secondary-dark text-text-muted dark:text-text-muted-dark'
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
                className="flex items-center gap-1 text-xs px-2 py-1 rounded-full bg-[#A89548]/15 text-[#A89548] hover:bg-[#A89548]/25 transition-colors"
              >
                <ArrowRight className="w-3 h-3" />
                Propósito
              </button>
            )}
          </div>

          <div className="flex items-center gap-1">
            <button
              onClick={onEdit}
              className="p-1.5 text-text-muted dark:text-text-muted-dark hover:text-text-secondary dark:hover:text-text-secondary-dark hover:bg-surface-secondary dark:hover:bg-surface-secondary-dark rounded transition-colors"
            >
              <Pencil className="w-4 h-4" />
            </button>
            <button
              onClick={onDelete}
              className="p-1.5 text-text-muted dark:text-text-muted-dark hover:text-[#9B6B6B] hover:bg-surface-secondary dark:hover:bg-surface-secondary-dark rounded transition-colors"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
