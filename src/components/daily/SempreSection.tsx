import { motion, AnimatePresence } from 'motion/react'
import { ChevronDown, Infinity as InfinityIcon } from 'lucide-react'
import { SEMPRE_ITEMS, SEMPRE_NAME } from '../../data/planoDeVida'

interface SempreSectionProps {
  isExpanded: boolean
  onToggleExpanded: () => void
}

// The "Sempre" norms under the Plano de Vida category. Folds like a category
// (same header) but has no count and no checkboxes: it is there to be read.
export function SempreSection({ isExpanded, onToggleExpanded }: SempreSectionProps) {
  return (
    <section className="mb-2">
      <button
        onClick={onToggleExpanded}
        aria-expanded={isExpanded}
        className="w-full flex items-center gap-2 px-5 py-4 hover:bg-surface-secondary/50 dark:hover:bg-surface-secondary-dark/50 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary dark:focus-visible:ring-primary-light"
      >
        <InfinityIcon className="w-4 h-4 text-text-secondary dark:text-text-secondary-dark" />
        <span className="flex-1 text-left font-heading text-base font-medium tracking-wide text-text-secondary dark:text-text-secondary-dark">
          {SEMPRE_NAME}
        </span>
        <motion.div animate={{ rotate: isExpanded ? 180 : 0 }} transition={{ duration: 0.2 }}>
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
            <ul className="px-5 pb-3 space-y-2">
              {SEMPRE_ITEMS.map((item) => (
                <li
                  key={item}
                  className="flex items-start gap-3 text-sm text-text-secondary dark:text-text-secondary-dark"
                >
                  {/* Dot centred in the checkbox column, so the text lines up with
                      the practice names above. */}
                  <span className="w-5 pt-[7px] flex justify-center shrink-0">
                    <span className="w-1 h-1 rounded-full bg-primary/60 dark:bg-primary-light/60" />
                  </span>
                  {item}
                </li>
              ))}
            </ul>
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  )
}
