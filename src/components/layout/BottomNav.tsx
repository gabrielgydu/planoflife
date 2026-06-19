import { NavLink } from 'react-router'
import { Scale, Calendar, Briefcase, Settings, type LucideIcon } from 'lucide-react'
import { useCareerEnabled } from '../../hooks/useCareerEnabled'

function OpusDeiSeal({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 510 510"
      fill="none"
      stroke="currentColor"
      strokeWidth={16}
      className={className}
    >
      <g transform="translate(255,255) scale(0.85) translate(-255,-255)">
        <path d="m254,11a244,244 0 1,0 2,0z M255,6V499 M43,132H467" />
      </g>
    </svg>
  )
}

const baseTabs: { to: string; icon: LucideIcon | null }[] = [
  { to: '/', icon: null },
  { to: '/examen', icon: Scale },
  { to: '/history', icon: Calendar },
  { to: '/settings', icon: Settings },
]

const careerTab = { to: '/career', icon: Briefcase }

export function BottomNav() {
  // The Carreira tab exists only when career data is present (Gabriel's devices);
  // every other install sees the unchanged four-tab bar.
  const careerEnabled = useCareerEnabled()
  const tabs = careerEnabled
    ? [...baseTabs.slice(0, 3), careerTab, ...baseTabs.slice(3)]
    : baseTabs
  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-surface-card dark:bg-surface-card-dark border-t border-border dark:border-border-dark pb-[var(--safe-area-bottom)] sm:left-1/2 sm:right-auto sm:bottom-6 sm:-translate-x-1/2 sm:w-auto sm:border sm:rounded-2xl sm:shadow-lg sm:pb-0">
      <div className="flex justify-around items-center h-16 sm:justify-center sm:gap-2 sm:px-2">
        {tabs.map((tab) => (
          <NavLink
            key={tab.to}
            to={tab.to}
            className={({ isActive }) =>
              `flex items-center justify-center w-12 h-12 rounded-xl transition-colors hover:bg-surface-secondary dark:hover:bg-surface-secondary-dark focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary dark:focus-visible:ring-primary-light ${
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
