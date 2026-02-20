import { Link } from 'react-router'
import { ClipboardList, FolderOpen, Download, FileText, ChevronRight, type LucideIcon } from 'lucide-react'

const menuItems: { to: string; label: string; icon: LucideIcon; description: string }[] = [
  { to: '/settings/practices', label: 'Práticas', icon: ClipboardList, description: 'Gerenciar práticas espirituais' },
  { to: '/settings/categories', label: 'Categorias', icon: FolderOpen, description: 'Organizar categorias' },
  { to: '/settings/backup', label: 'Backup', icon: Download, description: 'Exportar e importar dados' },
  { to: '/settings/pdf', label: 'Exportar PDF', icon: FileText, description: 'Gerar relatório mensal' },
]

export function SettingsView() {
  return (
    <div className="min-h-full">
      <header className="sticky top-0 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-700 z-10">
        <div className="flex items-center justify-center px-4 h-14">
          <h1 className="text-lg font-semibold text-slate-900 dark:text-slate-100">Configurações</h1>
        </div>
      </header>

      <div className="p-4 space-y-2">
        {menuItems.map((item) => (
          <Link
            key={item.to}
            to={item.to}
            className="flex items-center gap-4 p-4 bg-slate-50 dark:bg-slate-800/50 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            <item.icon className="w-5 h-5 text-slate-600 dark:text-slate-400" />
            <div className="flex-1">
              <div className="text-sm font-medium text-slate-900 dark:text-slate-100">{item.label}</div>
              <div className="text-xs text-slate-500 dark:text-slate-400">{item.description}</div>
            </div>
            <ChevronRight className="w-5 h-5 text-slate-400" />
          </Link>
        ))}
      </div>

      <div className="px-4 py-8 text-center">
        <p className="text-xs text-slate-400 dark:text-slate-500">Plano de Vida v1.0.0</p>
      </div>
    </div>
  )
}
