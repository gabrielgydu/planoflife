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
      <Icon className="w-10 h-10 text-slate-300 dark:text-slate-600 mb-4" />
      <p className="text-slate-600 dark:text-slate-400 mb-4">{message}</p>
      {action && (
        action.to ? (
          <Link
            to={action.to}
            className="px-4 py-2 bg-primary text-white rounded-lg text-sm font-medium"
          >
            {action.label}
          </Link>
        ) : action.onClick ? (
          <button
            onClick={action.onClick}
            className="px-4 py-2 bg-primary text-white rounded-lg text-sm font-medium"
          >
            {action.label}
          </button>
        ) : null
      )}
    </div>
  )
}
