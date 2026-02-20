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
    <nav className="fixed bottom-0 left-0 right-0 bg-white dark:bg-slate-800 border-t border-slate-200 dark:border-slate-700 pb-[var(--safe-area-bottom)]">
      <div className="flex justify-around items-center h-14">
        {tabs.map((tab) => (
          <NavLink
            key={tab.to}
            to={tab.to}
            className={({ isActive }) =>
              `flex flex-col items-center justify-center px-4 py-2 text-xs transition-colors ${
                isActive
                  ? 'text-primary dark:text-indigo-400'
                  : 'text-slate-500 dark:text-slate-400'
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
