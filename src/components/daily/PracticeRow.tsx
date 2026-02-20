import { motion } from 'motion/react'
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
    <div className="flex items-center gap-3 py-3.5 px-5">
      <motion.button
        onClick={onToggle}
        whileTap={{ scale: 1.15 }}
        transition={{ type: 'spring', stiffness: 400, damping: 15 }}
        className={`w-5 h-5 rounded-full flex items-center justify-center transition-all duration-200 ${
          isCompleted
            ? 'bg-primary border-[1.5px] border-primary'
            : 'border-[1.5px] border-border dark:border-border-dark'
        }`}
        aria-label={isCompleted ? 'Desmarcar' : 'Marcar como feito'}
      >
        {isCompleted && <Check className="w-3 h-3 text-white" strokeWidth={3} />}
      </motion.button>

      <span
        className={`flex-1 text-sm transition-colors duration-200 ${
          isCompleted
            ? 'text-text-muted dark:text-text-muted-dark'
            : 'text-text-primary dark:text-text-primary-dark'
        }`}
      >
        {practice.name}
        {practice.isRequired && (
          <span className="ml-1 text-xs text-[#A89548]">*</span>
        )}
      </span>

      {(practice.content || practice.imageData) && (
        <button
          onClick={onOpenDetail}
          className="p-2 -mr-2 text-text-muted dark:text-text-muted-dark hover:text-text-secondary dark:hover:text-text-secondary-dark transition-colors"
          aria-label="Ver detalhes"
        >
          <MoreVertical className="w-5 h-5" />
        </button>
      )}
    </div>
  )
}
