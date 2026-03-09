import { Link } from 'react-router'
import { ClipboardList, FolderOpen, Download, FileText, ChevronRight, Sun, Moon, Circle, type LucideIcon } from 'lucide-react'
import { useThemeMode, type ThemeMode } from '../../hooks/useThemeMode'
import { useIndividualReasons, usePracticeFontSize, useUIFontSize, type FontSizeLevel } from '../../hooks/useSettings'

const menuItems: { to: string; label: string; icon: LucideIcon; description: string }[] = [
  { to: '/settings/practices', label: 'Práticas', icon: ClipboardList, description: 'Gerenciar práticas espirituais' },
  { to: '/settings/categories', label: 'Categorias', icon: FolderOpen, description: 'Organizar categorias' },
  { to: '/settings/backup', label: 'Backup', icon: Download, description: 'Exportar e importar dados' },
  { to: '/settings/pdf', label: 'Exportar PDF', icon: FileText, description: 'Gerar relatório mensal' },
]

const themeOptions: { key: ThemeMode; label: string; icon: LucideIcon }[] = [
  { key: 'light', label: 'Claro', icon: Sun },
  { key: 'dark', label: 'Escuro', icon: Moon },
  { key: 'black', label: 'Preto', icon: Circle },
]

const fontSizeOptions: { key: FontSizeLevel; label: string }[] = [
  { key: 'small', label: 'Pequeno' },
  { key: 'medium', label: 'Médio' },
  { key: 'large', label: 'Grande' },
]

export function SettingsView() {
  const [themeMode, setThemeMode] = useThemeMode()
  const [individualReasons, setIndividualReasons] = useIndividualReasons()
  const [practiceFontSize, setPracticeFontSize] = usePracticeFontSize()
  const [uiFontSize, setUIFontSize] = useUIFontSize()

  return (
    <div className="min-h-full">
      <header className="sticky top-0 bg-surface-card dark:bg-surface-card-dark border-b border-border dark:border-border-dark z-10">
        <div className="flex items-center justify-center px-4 h-16">
          <h1 className="font-heading text-lg font-semibold text-text-primary dark:text-text-primary-dark">Configurações</h1>
        </div>
      </header>

      <div className="p-4 space-y-4">
        {/* Theme Picker */}
        <section>
          <h2 className="font-heading text-xs font-medium text-text-muted dark:text-text-muted-dark uppercase tracking-widest mb-3">
            Tema
          </h2>
          <div className="flex gap-2">
            {themeOptions.map((opt) => (
              <button
                key={opt.key}
                onClick={() => setThemeMode(opt.key)}
                className={`flex-1 py-2.5 px-3 text-sm rounded-lg transition-colors flex items-center justify-center gap-2 ${
                  themeMode === opt.key
                    ? 'bg-btn dark:bg-btn-dark text-btn-text dark:text-btn-dark-text'
                    : 'bg-surface-secondary dark:bg-surface-secondary-dark text-text-secondary dark:text-text-secondary-dark hover:bg-border dark:hover:bg-border-dark'
                }`}
              >
                <opt.icon className="w-4 h-4" />
                {opt.label}
              </button>
            ))}
          </div>
        </section>

        {/* Font Size - Practice Texts */}
        <section>
          <h2 className="font-heading text-xs font-medium text-text-muted dark:text-text-muted-dark uppercase tracking-widest mb-3">
            Tamanho da fonte — Orações
          </h2>
          <div className="flex gap-2">
            {fontSizeOptions.map((opt) => (
              <button
                key={opt.key}
                onClick={() => setPracticeFontSize(opt.key)}
                className={`flex-1 py-2.5 px-3 text-sm rounded-lg transition-colors ${
                  practiceFontSize === opt.key
                    ? 'bg-btn dark:bg-btn-dark text-btn-text dark:text-btn-dark-text'
                    : 'bg-surface-secondary dark:bg-surface-secondary-dark text-text-secondary dark:text-text-secondary-dark hover:bg-border dark:hover:bg-border-dark'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </section>

        {/* Font Size - UI */}
        <section>
          <h2 className="font-heading text-xs font-medium text-text-muted dark:text-text-muted-dark uppercase tracking-widest mb-3">
            Tamanho da fonte — Interface
          </h2>
          <div className="flex gap-2">
            {fontSizeOptions.map((opt) => (
              <button
                key={opt.key}
                onClick={() => setUIFontSize(opt.key)}
                className={`flex-1 py-2.5 px-3 text-sm rounded-lg transition-colors ${
                  uiFontSize === opt.key
                    ? 'bg-btn dark:bg-btn-dark text-btn-text dark:text-btn-dark-text'
                    : 'bg-surface-secondary dark:bg-surface-secondary-dark text-text-secondary dark:text-text-secondary-dark hover:bg-border dark:hover:bg-border-dark'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </section>

        {/* Morning Review */}
        <section>
          <h2 className="font-heading text-xs font-medium text-text-muted dark:text-text-muted-dark uppercase tracking-widest mb-3">
            Revisão matinal
          </h2>
          <button
            onClick={() => setIndividualReasons(!individualReasons)}
            className="flex items-center justify-between w-full p-4 bg-surface-secondary dark:bg-surface-secondary-dark rounded-lg"
          >
            <span className="text-sm text-text-primary dark:text-text-primary-dark">Razão individual por prática</span>
            <div
              className={`relative w-10 h-6 rounded-full transition-colors duration-200 ${
                individualReasons ? 'bg-btn dark:bg-btn-dark' : 'bg-border dark:bg-border-dark'
              }`}
            >
              <div
                className={`absolute top-1 w-4 h-4 rounded-full bg-btn-text dark:bg-btn-dark-text shadow transition-transform duration-200 ${
                  individualReasons ? 'translate-x-5' : 'translate-x-1'
                }`}
              />
            </div>
          </button>
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
