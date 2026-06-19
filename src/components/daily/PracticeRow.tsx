import { motion } from 'motion/react'
import { Check } from 'lucide-react'
import type { Practice } from '../../types'

interface PracticeRowProps {
  practice: Practice
  // Optional second line under the name (e.g. the novena's "Terceiro dia · …").
  subtitle?: string
  isCompleted: boolean
  onToggle: () => void
  onOpenDetail: () => void
}

export function PracticeRow({ practice, subtitle, isCompleted, onToggle, onOpenDetail }: PracticeRowProps) {
  const nameClasses = `flex-1 text-sm text-left transition-colors duration-200 rounded hover:bg-surface-secondary dark:hover:bg-surface-secondary-dark focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary dark:focus-visible:ring-primary-light ${
    isCompleted
      ? 'text-text-muted dark:text-text-muted-dark'
      : 'text-text-primary dark:text-text-primary-dark'
  }`

  return (
    <div className="flex items-center gap-3 py-3.5 px-5">
      <motion.button
        onClick={onToggle}
        whileTap={{ scale: 1.15 }}
        transition={{ type: 'spring', stiffness: 400, damping: 15 }}
        className={`w-5 h-5 rounded-full flex items-center justify-center shrink-0 transition-all duration-200 ${
          isCompleted
            ? 'bg-btn border-[1.5px] border-btn dark:bg-btn-dark dark:border-btn-dark'
            : 'border-[1.5px] border-border dark:border-border-dark'
        }`}
        aria-label={isCompleted ? 'Desmarcar' : 'Marcar como feito'}
      >
        {isCompleted && <Check className="w-3 h-3 text-btn-text dark:text-btn-dark-text" strokeWidth={3} />}
      </motion.button>

      <button onClick={onOpenDetail} className={nameClasses}>
        <span>
          {practice.name}
          {practice.isRequired && (
            <span className="ml-1 text-xs text-[#A89548]">*</span>
          )}
        </span>
        {subtitle && (
          <span className="block text-xs text-text-secondary dark:text-text-secondary-dark mt-0.5">
            {subtitle}
          </span>
        )}
      </button>
    </div>
  )
}
