import type { PracticeDomain } from '../../types'

interface DomainToggleProps {
  value: PracticeDomain
  onChange: (domain: PracticeDomain) => void
  /** Which domains to offer. Parent renders the toggle only when length > 1. */
  domains: PracticeDomain[]
}

const LABELS: Record<PracticeDomain, string> = {
  spiritual: 'Espiritual',
  lifestyle: 'Hábito',
  career: 'Carreira',
}

// Segmented control that splits the History stats between spiritual devotions,
// lifestyle habits and (when present) career habits. Mirrors the segmented
// selectors in SettingsView. Rendered as a standalone full-width row (owns its
// own padding) under the History/DayDetail header.
export function DomainToggle({ value, onChange, domains }: DomainToggleProps) {
  return (
    <div className="flex gap-2 px-4 py-3 mx-auto w-full max-w-md">
      {domains.map((key) => (
        <button
          key={key}
          onClick={() => onChange(key)}
          aria-pressed={value === key}
          className={`flex-1 py-2 px-3 text-sm rounded-lg transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary dark:focus-visible:ring-primary-light ${
            value === key
              ? 'bg-btn dark:bg-btn-dark text-btn-text dark:text-btn-dark-text'
              : 'bg-surface-secondary dark:bg-surface-secondary-dark text-text-secondary dark:text-text-secondary-dark hover:bg-border dark:hover:bg-border-dark'
          }`}
        >
          {LABELS[key]}
        </button>
      ))}
    </div>
  )
}
