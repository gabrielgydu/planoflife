import { Fragment } from 'react'
import { motion, AnimatePresence } from 'motion/react'
import { ChevronDown } from 'lucide-react'
import type { Category, Practice } from '../../types'
import { PracticeRow } from './PracticeRow'
import { CategoryIcon } from '../shared/CategoryIcon'
import { novenaRowSubtitle } from '../../data/novena'
import { angelusDisplayName } from '../../data/angelus'

// A missed novena day offered for catching up in today's list. Checking it
// completes the MISSED day's record, so the row disappears once prayed.
export interface CatchUpRow {
  practice: Practice
  dateStr: string
  subtitle: string
}

interface CategorySectionProps {
  category: Category
  practices: Practice[]
  viewDate: Date
  // Manual-run start of the novena (YYYY-MM-DD) — drives its per-day subtitle
  // when it runs outside the 17–25 June calendar window.
  novenaStart?: string | null
  // Missed novena days to catch up on — only ever passed on the novena's own
  // category while viewing today. Rendered right above the novena's row so the
  // days stack chronologically; at the top when that row is filtered out.
  catchUpRows?: CatchUpRow[]
  onToggleCatchUp?: (row: CatchUpRow) => void
  onOpenCatchUpDetail?: (row: CatchUpRow) => void
  isCompleted: (practiceId: string) => boolean
  onTogglePractice: (practiceId: string) => void
  onOpenPracticeDetail: (practice: Practice) => void
  hideCompleted?: boolean
  // Controlled by the caller so the fold survives leaving the view — see
  // useCollapsedCategories.
  isExpanded: boolean
  onToggleExpanded: () => void
}

export function CategorySection({
  category,
  practices,
  viewDate,
  novenaStart,
  catchUpRows,
  onToggleCatchUp,
  onOpenCatchUpDetail,
  isCompleted,
  onTogglePractice,
  onOpenPracticeDetail,
  hideCompleted = false,
  isExpanded,
  onToggleExpanded,
}: CategorySectionProps) {
  const catchUp = catchUpRows ?? []
  // Counts always reflect the full set; only the rendered rows are filtered, so
  // the "2/5" badge stays truthful while completed rows are hidden. Pending
  // catch-up days count as open items — the section isn't done while one waits.
  const completedCount = practices.filter((p) => isCompleted(p.id)).length
  const totalCount = practices.length + catchUp.length

  const visiblePractices = hideCompleted ? practices.filter((p) => !isCompleted(p.id)) : practices

  // Collapses empty categories, and fully-completed ones when hiding completed.
  if (visiblePractices.length === 0 && catchUp.length === 0) return null

  // Catch-up rows are always pending (a completed one leaves the list), so they
  // render unchecked and ignore hide-completed.
  const catchUpBlock = catchUp.map((row) => (
    <PracticeRow
      key={`${row.dateStr}|${row.practice.id}`}
      practice={row.practice}
      subtitle={row.subtitle}
      isCompleted={false}
      onToggle={() => onToggleCatchUp?.(row)}
      onOpenDetail={() => onOpenCatchUpDetail?.(row)}
    />
  ))
  const catchUpAnchorId = catchUp[0]?.practice.id

  return (
    <section className="mb-2">
      <button
        onClick={onToggleExpanded}
        aria-expanded={isExpanded}
        className="w-full flex items-center gap-2 px-5 py-4 hover:bg-surface-secondary/50 dark:hover:bg-surface-secondary-dark/50 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary dark:focus-visible:ring-primary-light"
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
            {catchUpAnchorId !== undefined &&
              !visiblePractices.some((p) => p.id === catchUpAnchorId) &&
              catchUpBlock}
            {visiblePractices.map((practice) => (
              <Fragment key={practice.id}>
                {practice.id === catchUpAnchorId && catchUpBlock}
                <PracticeRow
                  practice={practice}
                  nameOverride={angelusDisplayName(practice, viewDate) ?? undefined}
                  subtitle={novenaRowSubtitle(practice, viewDate, novenaStart) ?? undefined}
                  isCompleted={isCompleted(practice.id)}
                  onToggle={() => onTogglePractice(practice.id)}
                  onOpenDetail={() => onOpenPracticeDetail(practice)}
                />
              </Fragment>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  )
}
