import { NavLink } from 'react-router'
import { ClipboardList, BookOpen, Calendar, Settings, type LucideIcon } from 'lucide-react'

const tabs: { to: string; label: string; icon: LucideIcon }[] = [
  { to: '/', label: 'Hoje', icon: ClipboardList },
  { to: '/examen', label: 'Exame', icon: BookOpen },
  { to: '/history', label: 'Histórico', icon: Calendar },
  { to: '/settings', label: 'Config', icon: Settings },
]

export function BottomNav() {
  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-surface-card/95 dark:bg-surface-card-dark/95 backdrop-blur-sm shadow-[0_-1px_3px_rgba(26,32,48,0.04)] pb-[var(--safe-area-bottom)]">
      <div className="flex justify-around items-center h-16">
        {tabs.map((tab) => (
          <NavLink
            key={tab.to}
            to={tab.to}
            className={({ isActive }) =>
              `flex flex-col items-center justify-center px-4 py-2 text-xs font-heading tracking-wide transition-colors ${
                isActive
                  ? 'text-primary dark:text-primary-light'
                  : 'text-text-muted dark:text-text-muted-dark'
              }`
            }
          >
            <tab.icon className="w-5 h-5 mb-0.5" />
            <span>{tab.label}</span>
          </NavLink>
        ))}
      </div>
    </nav>
  )
}
