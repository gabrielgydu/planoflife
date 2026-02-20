import { Link } from 'react-router'
import { ClipboardList, FolderOpen, Download, FileText, ChevronRight, type LucideIcon } from 'lucide-react'
import { useFont, FONT_MAP, type FontKey } from '../../hooks/useFont'

const menuItems: { to: string; label: string; icon: LucideIcon; description: string }[] = [
  { to: '/settings/practices', label: 'Práticas', icon: ClipboardList, description: 'Gerenciar práticas espirituais' },
  { to: '/settings/categories', label: 'Categorias', icon: FolderOpen, description: 'Organizar categorias' },
  { to: '/settings/backup', label: 'Backup', icon: Download, description: 'Exportar e importar dados' },
  { to: '/settings/pdf', label: 'Exportar PDF', icon: FileText, description: 'Gerar relatório mensal' },
]

const fontOptions: { key: FontKey; label: string }[] = [
  { key: 'cormorant', label: 'Cormorant' },
  { key: 'lora', label: 'Lora' },
  { key: 'dm-sans', label: 'DM Sans' },
]

export function SettingsView() {
  const [fontKey, setFontKey] = useFont()

  return (
    <div className="min-h-full">
      <header className="sticky top-0 bg-surface-card/95 dark:bg-surface-card-dark/95 backdrop-blur-sm shadow-[0_1px_3px_rgba(26,32,48,0.04)] z-10">
        <div className="flex items-center justify-center px-4 h-16">
          <h1 className="font-heading text-lg font-semibold text-text-primary dark:text-text-primary-dark">Configurações</h1>
        </div>
      </header>

      <div className="p-4 space-y-4">
        {/* Font Picker */}
        <section>
          <h2 className="font-heading text-xs font-medium text-text-muted dark:text-text-muted-dark uppercase tracking-widest mb-3">
            Fonte
          </h2>
          <div className="flex gap-2">
            {fontOptions.map((opt) => (
              <button
                key={opt.key}
                onClick={() => setFontKey(opt.key)}
                className={`flex-1 py-2.5 px-3 text-sm rounded-lg transition-colors ${
                  fontKey === opt.key
                    ? 'bg-primary text-white'
                    : 'bg-surface-secondary dark:bg-surface-secondary-dark text-text-secondary dark:text-text-secondary-dark hover:bg-border dark:hover:bg-border-dark'
                }`}
                style={{ fontFamily: FONT_MAP[opt.key] }}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </section>

        {/* Menu Items */}
        <div className="space-y-2">
          {menuItems.map((item) => (
            <Link
              key={item.to}
              to={item.to}
              className="flex items-center gap-4 p-4 bg-surface-secondary dark:bg-surface-secondary-dark rounded-lg hover:bg-border/50 dark:hover:bg-border-dark/50 transition-colors"
            >
              <item.icon className="w-5 h-5 text-text-secondary dark:text-text-secondary-dark" />
              <div className="flex-1">
                <div className="text-sm font-medium text-text-primary dark:text-text-primary-dark">{item.label}</div>
                <div className="text-xs text-text-muted dark:text-text-muted-dark">{item.description}</div>
              </div>
              <ChevronRight className="w-5 h-5 text-text-muted" />
            </Link>
          ))}
        </div>
      </div>

      <div className="px-4 py-8 text-center">
        <p className="text-xs text-text-muted dark:text-text-muted-dark">Plano de Vida v1.0.0</p>
      </div>
    </div>
  )
}
