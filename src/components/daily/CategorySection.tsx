import { useState } from 'react'
import { ChevronDown } from 'lucide-react'
import type { Category, Practice } from '../../types'
import { PracticeRow } from './PracticeRow'

interface CategorySectionProps {
  category: Category
  practices: Practice[]
  isCompleted: (practiceId: string) => boolean
  onTogglePractice: (practiceId: string) => void
  onOpenPracticeDetail: (practice: Practice) => void
}

export function CategorySection({
  category,
  practices,
  isCompleted,
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
        className="w-full flex items-center gap-2 px-4 py-3 bg-slate-50 dark:bg-slate-800/50 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
      >
        <span className="text-base">{category.emoji}</span>
        <span className="flex-1 text-left text-sm font-medium text-slate-700 dark:text-slate-300">
          {category.name}
        </span>
        <span className="text-xs text-slate-500 dark:text-slate-400 mr-2">
          {completedCount}/{totalCount}
        </span>
        <ChevronDown
          className={`w-4 h-4 text-slate-400 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
        />
      </button>

      {isExpanded && (
        <div className="divide-y divide-slate-100 dark:divide-slate-800">
          {practices.map((practice) => (
            <PracticeRow
              key={practice.id}
              practice={practice}
              isCompleted={isCompleted(practice.id)}
              onToggle={() => onTogglePractice(practice.id)}
              onOpenDetail={() => onOpenPracticeDetail(practice)}
            />
          ))}
        </div>
      )}
    </section>
  )
}
