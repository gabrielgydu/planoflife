import type { LucideIcon } from 'lucide-react'
import { Link } from 'react-router'

interface EmptyStateProps {
  icon: LucideIcon
  message: string
  action?: {
    label: string
    onClick?: () => void
    to?: string
  }
}

export function EmptyState({ icon: Icon, message, action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center px-4">
      <Icon className="w-10 h-10 text-text-muted/50 dark:text-text-muted-dark/50 mb-4" />
      <p className="text-text-secondary dark:text-text-secondary-dark mb-4">{message}</p>
      {action && (
        action.to ? (
          <Link
            to={action.to}
            className="px-4 py-2 bg-btn dark:bg-btn-dark text-btn-text dark:text-btn-dark-text rounded-lg text-sm font-medium"
          >
            {action.label}
          </Link>
        ) : action.onClick ? (
          <button
            onClick={action.onClick}
            className="px-4 py-2 bg-btn dark:bg-btn-dark text-btn-text dark:text-btn-dark-text rounded-lg text-sm font-medium"
          >
            {action.label}
          </button>
        ) : null
      )}
    </div>
  )
}
