import { useState, useEffect } from 'react'
import { Smartphone, Download, X } from 'lucide-react'

function isIOS(): boolean {
  return /iPhone|iPad|iPod/.test(navigator.userAgent)
}

function isInStandaloneMode(): boolean {
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    ('standalone' in navigator && (navigator as { standalone?: boolean }).standalone === true)
  )
}

export function InstallBanner() {
  const [showBanner, setShowBanner] = useState(false)
  const [dismissed, setDismissed] = useState(false)

  useEffect(() => {
    const wasDismissed = localStorage.getItem('install-banner-dismissed')
    if (wasDismissed) {
      setDismissed(true)
      return
    }

    // Show banner on iOS Safari, not in standalone mode
    if (isIOS() && !isInStandaloneMode()) {
      setShowBanner(true)
    }
  }, [])

  const handleDismiss = () => {
    setShowBanner(false)
    setDismissed(true)
    localStorage.setItem('install-banner-dismissed', 'true')
  }

  if (!showBanner || dismissed) return null

  return (
    <div className="fixed bottom-20 left-4 right-4 z-40 animate-in fade-in slide-in-from-bottom-4">
      <div className="bg-surface-card dark:bg-surface-card-dark rounded-lg shadow-lg border border-border dark:border-border-dark p-4">
        <div className="flex items-start gap-3">
          <Smartphone className="w-5 h-5 text-text-secondary dark:text-text-secondary-dark mt-0.5 shrink-0" />
          <div className="flex-1">
            <p className="text-sm font-medium text-text-primary dark:text-text-primary-dark mb-1">
              Instale o app na tela inicial
            </p>
            <p className="text-xs text-text-muted dark:text-text-muted-dark">
              Toque em{' '}
              <Download className="w-4 h-4 inline-block mx-0.5 align-text-bottom" />{' '}
              e depois em <strong>"Adicionar à Tela de Início"</strong>
            </p>
          </div>
          <button
            onClick={handleDismiss}
            className="p-1 text-text-muted hover:text-text-secondary dark:hover:text-text-secondary-dark"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>
    </div>
  )
}
