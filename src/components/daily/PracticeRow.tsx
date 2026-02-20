import { Check, MoreVertical } from 'lucide-react'
import type { Practice } from '../../types'

interface PracticeRowProps {
  practice: Practice
  isCompleted: boolean
  onToggle: () => void
  onOpenDetail: () => void
}

export function PracticeRow({ practice, isCompleted, onToggle, onOpenDetail }: PracticeRowProps) {
  return (
    <div className="flex items-center gap-3 py-3 px-4">
      <button
        onClick={onToggle}
        className={`w-6 h-6 rounded-full border-2 flex items-center justify-center transition-colors ${
          isCompleted
            ? 'bg-primary border-primary'
            : 'border-slate-300 dark:border-slate-600'
        }`}
        aria-label={isCompleted ? 'Desmarcar' : 'Marcar como feito'}
      >
        {isCompleted && <Check className="w-4 h-4 text-white" strokeWidth={3} />}
      </button>

      <span
        className={`flex-1 text-sm ${
          isCompleted
            ? 'text-slate-400 dark:text-slate-500 line-through'
            : 'text-slate-900 dark:text-slate-100'
        }`}
      >
        {practice.name}
        {practice.isRequired && (
          <span className="ml-1 text-xs text-amber-600 dark:text-amber-500">*</span>
        )}
      </span>

      {(practice.content || practice.imageData) && (
        <button
          onClick={onOpenDetail}
          className="p-2 -mr-2 text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300 transition-colors"
          aria-label="Ver detalhes"
        >
          <MoreVertical className="w-5 h-5" />
        </button>
      )}
    </div>
  )
}
