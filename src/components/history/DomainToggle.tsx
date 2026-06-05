import type { PracticeDomain } from '../../types'

interface DomainToggleProps {
  value: PracticeDomain
  onChange: (domain: PracticeDomain) => void
}

const OPTIONS: { key: PracticeDomain; label: string }[] = [
  { key: 'spiritual', label: 'Espiritual' },
  { key: 'lifestyle', label: 'Hábito' },
]

// Segmented control that splits the History stats between spiritual devotions and
// lifestyle habits. Mirrors the segmented selectors in SettingsView. Rendered as a
// standalone full-width row (owns its own padding) under the History/DayDetail
// header.
export function DomainToggle({ value, onChange }: DomainToggleProps) {
  return (
    <div className="flex gap-2 px-4 py-3">
      {OPTIONS.map((opt) => (
        <button
          key={opt.key}
          onClick={() => onChange(opt.key)}
          aria-pressed={value === opt.key}
          className={`flex-1 py-2 px-3 text-sm rounded-lg transition-colors ${
            value === opt.key
              ? 'bg-btn dark:bg-btn-dark text-btn-text dark:text-btn-dark-text'
              : 'bg-surface-secondary dark:bg-surface-secondary-dark text-text-secondary dark:text-text-secondary-dark hover:bg-border dark:hover:bg-border-dark'
          }`}
        >
          {opt.label}
        </button>
      ))}
    </div>
  )
}
