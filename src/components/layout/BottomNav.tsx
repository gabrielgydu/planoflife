import { NavLink } from 'react-router'
import { Scale, Calendar, Settings, type LucideIcon } from 'lucide-react'

function OpusDeiSeal({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 510 510"
      fill="none"
      stroke="currentColor"
      strokeWidth={12}
      className={className}
    >
      <path d="m254,11a244,244 0 1,0 2,0z M255,6V499 M43,132H467" />
    </svg>
  )
}

const tabs: { to: string; icon: LucideIcon | null }[] = [
  { to: '/', icon: null },
  { to: '/examen', icon: Scale },
  { to: '/history', icon: Calendar },
  { to: '/settings', icon: Settings },
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
              `flex items-center justify-center w-12 h-12 transition-colors ${
                isActive
                  ? 'text-primary dark:text-primary-light'
                  : 'text-text-muted dark:text-text-muted-dark'
              }`
            }
          >
            {tab.icon ? (
              <tab.icon className="w-6 h-6" />
            ) : (
              <OpusDeiSeal className="w-7 h-7" />
            )}
          </NavLink>
        ))}
      </div>
    </nav>
  )
}
