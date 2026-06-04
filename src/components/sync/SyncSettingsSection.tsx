import { useState } from 'react'
import { RefreshCw, Cloud, CloudOff, Check, AlertTriangle, Loader2 } from 'lucide-react'
import { useSync } from '../../sync/SyncProvider'
import { isCryptoAvailable } from '../../sync/syncCrypto'
import { PasswordInput } from '../shared/PasswordInput'

const COUNT_LABELS: Record<string, string> = {
  practices: 'práticas',
  examenEntries: 'exames',
  dailyRecords: 'registros diários',
  propositos: 'propósitos',
  categories: 'categorias',
}

function summarizeCounts(counts: Record<string, number>): string {
  return Object.entries(COUNT_LABELS)
    .filter(([k]) => (counts[k] ?? 0) > 0)
    .map(([k, label]) => `${counts[k]} ${label}`)
    .join(', ') || 'vazio'
}

export function SyncSettingsSection() {
  const sync = useSync()
  const secure = isCryptoAvailable() && (typeof window === 'undefined' || window.isSecureContext)
  const [url, setUrl] = useState(sync.workerUrl ?? '')
  const [passphrase, setPassphrase] = useState('')
  const [busy, setBusy] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)
  const [confirm, setConfirm] = useState<{
    cloud: Record<string, number>
    local: Record<string, number>
  } | null>(null)

  const handleConnect = async () => {
    if (!url.trim() || !passphrase) return
    setBusy(true)
    setNotice(null)
    try {
      const res = await sync.connect(url.trim(), passphrase)
      if ('needsConfirm' in res) {
        setConfirm({ cloud: res.cloudCounts, local: res.localCounts })
      } else if (res.ok) {
        setPassphrase('')
        setNotice('Conectado e sincronizado.')
      } else if (res.reason === 'empty') {
        setNotice('Conectado, mas a nuvem está vazia. Faça o seed pelo CLI; depois reconecte.')
      }
    } catch {
      /* error surfaced via sync.error */
    } finally {
      setBusy(false)
    }
  }

  const handleAdopt = async () => {
    setBusy(true)
    try {
      await sync.confirmAdopt()
      setConfirm(null)
      setPassphrase('')
      setNotice('Dados da nuvem aplicados a este dispositivo.')
    } finally {
      setBusy(false)
    }
  }

  const statusChip = () => {
    switch (sync.status) {
      case 'syncing':
        return { icon: Loader2, text: 'Sincronizando…', spin: true, tone: 'muted' as const }
      case 'idle':
        return { icon: Check, text: 'Sincronizado', spin: false, tone: 'ok' as const }
      case 'offline':
        return { icon: CloudOff, text: 'Offline', spin: false, tone: 'muted' as const }
      case 'error':
        return { icon: AlertTriangle, text: 'Erro', spin: false, tone: 'warn' as const }
      case 'locked':
        return { icon: CloudOff, text: 'Bloqueado', spin: false, tone: 'muted' as const }
      default:
        return { icon: Cloud, text: 'Não configurado', spin: false, tone: 'muted' as const }
    }
  }

  const chip = statusChip()
  const toneClass =
    chip.tone === 'ok'
      ? 'text-green-600 dark:text-green-400'
      : chip.tone === 'warn'
        ? 'text-amber-600 dark:text-amber-400'
        : 'text-text-muted dark:text-text-muted-dark'

  return (
    <section>
      <h2 className="font-heading text-xs font-medium text-text-muted dark:text-text-muted-dark uppercase tracking-widest mb-3">
        Sincronização
      </h2>

      <div className="bg-surface-secondary dark:bg-surface-secondary-dark rounded-lg p-4 space-y-3">
        <div className={`flex items-center gap-2 text-sm ${toneClass}`}>
          <chip.icon className={`w-4 h-4 ${chip.spin ? 'animate-spin' : ''}`} />
          <span>{chip.text}</span>
          {sync.unlocked && sync.lastSyncedAt && (
            <span className="text-text-muted dark:text-text-muted-dark ml-auto text-xs">
              {new Date(sync.lastSyncedAt).toLocaleString('pt-BR')}
            </span>
          )}
        </div>

        {sync.error && (
          <p className="text-xs text-amber-600 dark:text-amber-400">{sync.error}</p>
        )}
        {notice && <p className="text-xs text-text-secondary dark:text-text-secondary-dark">{notice}</p>}

        {!secure ? (
          <div className="flex items-start gap-2 text-xs text-amber-700 dark:text-amber-400">
            <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
            <span>
              Sincronização requer HTTPS. Abra o app por <b>https://</b> (não http) — toque em
              Compartilhar → recarregar pela URL https, ou reinstale o ícone a partir do endereço
              https.
            </span>
          </div>
        ) : confirm ? (
          <div className="space-y-3">
            <div className="flex items-start gap-2 text-xs text-amber-700 dark:text-amber-400">
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>
                Este dispositivo já tem dados ({summarizeCounts(confirm.local)}). Substituir pelos
                dados da nuvem ({summarizeCounts(confirm.cloud)})?
              </span>
            </div>
            <div className="flex gap-2">
              <button
                onClick={handleAdopt}
                disabled={busy}
                className="flex-1 py-2.5 text-sm rounded-lg bg-btn dark:bg-btn-dark text-btn-text dark:text-btn-dark-text disabled:opacity-50"
              >
                Substituir
              </button>
              <button
                onClick={() => {
                  sync.cancelAdopt()
                  setConfirm(null)
                }}
                disabled={busy}
                className="flex-1 py-2.5 text-sm rounded-lg bg-surface-card dark:bg-surface-card-dark text-text-secondary dark:text-text-secondary-dark border border-border dark:border-border-dark"
              >
                Cancelar
              </button>
            </div>
          </div>
        ) : sync.unlocked ? (
          <div className="flex gap-2">
            <button
              onClick={() => void sync.syncNow()}
              disabled={sync.status === 'syncing'}
              className="flex-1 py-2.5 text-sm rounded-lg bg-surface-card dark:bg-surface-card-dark text-text-secondary dark:text-text-secondary-dark border border-border dark:border-border-dark flex items-center justify-center gap-2 disabled:opacity-50"
            >
              <RefreshCw className={`w-4 h-4 ${sync.status === 'syncing' ? 'animate-spin' : ''}`} />
              Sincronizar agora
            </button>
            <button
              onClick={() => void sync.disconnect()}
              className="px-4 py-2.5 text-sm rounded-lg text-amber-600 dark:text-amber-400 border border-border dark:border-border-dark"
            >
              Desconectar
            </button>
          </div>
        ) : (
          <div className="space-y-2">
            <input
              type="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://planoflife-sync.SEU.workers.dev"
              className="w-full px-3 py-2.5 text-sm bg-surface-card dark:bg-surface-card-dark text-text-primary dark:text-text-primary-dark border border-border dark:border-border-dark rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/50"
            />
            <PasswordInput value={passphrase} onChange={setPassphrase} placeholder="Senha de sincronização" />
            <button
              onClick={handleConnect}
              disabled={busy || !url.trim() || !passphrase}
              className="w-full py-2.5 text-sm rounded-lg bg-btn dark:bg-btn-dark text-btn-text dark:text-btn-dark-text disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {busy && <Loader2 className="w-4 h-4 animate-spin" />}
              Conectar
            </button>
          </div>
        )}
      </div>
    </section>
  )
}
