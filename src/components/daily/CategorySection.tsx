import { useState } from 'react'
import { motion, AnimatePresence } from 'motion/react'
import { ChevronDown } from 'lucide-react'
import type { Category, Practice } from '../../types'
import { PracticeRow } from './PracticeRow'
import { CategoryIcon } from '../shared/CategoryIcon'

interface CategorySectionProps {
  category: Category
  practices: Practice[]
  isCompleted: (practiceId: string) => boolean
  practiceHasText: (practice: Practice) => boolean
  onTogglePractice: (practiceId: string) => void
  onOpenPracticeDetail: (practice: Practice) => void
}

export function CategorySection({
  category,
  practices,
  isCompleted,
  practiceHasText,
  onTogglePractice,
  onOpenPracticeDetail,
}: CategorySectionProps) {
  const [isExpanded, setIsExpanded] = useState(true)

  const completedCount = practices.filter((p) => isCompleted(p.id)).length
  const totalCount = practices.length

  if (practices.length === 0) return null

  return (
    <section className="mb-2">
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center gap-2 px-5 py-4 hover:bg-surface-secondary/50 dark:hover:bg-surface-secondary-dark/50 transition-colors"
      >
        <CategoryIcon name={category.emoji} className="w-4 h-4 text-text-secondary dark:text-text-secondary-dark" />
        <span className="flex-1 text-left font-heading text-base font-medium tracking-wide text-text-secondary dark:text-text-secondary-dark">
          {category.name}
        </span>
        <span className="text-xs text-text-muted dark:text-text-muted-dark mr-2">
          {completedCount}/{totalCount}
        </span>
        <motion.div
          animate={{ rotate: isExpanded ? 180 : 0 }}
          transition={{ duration: 0.2 }}
        >
          <ChevronDown className="w-4 h-4 text-text-muted" />
        </motion.div>
      </button>

      <AnimatePresence initial={false}>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2, ease: 'easeInOut' }}
            style={{ overflow: 'hidden' }}
          >
            {practices.map((practice) => (
              <PracticeRow
                key={practice.id}
                practice={practice}
                isCompleted={isCompleted(practice.id)}
                hasText={practiceHasText(practice)}
                onToggle={() => onTogglePractice(practice.id)}
                onOpenDetail={() => onOpenPracticeDetail(practice)}
              />
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  )
}
