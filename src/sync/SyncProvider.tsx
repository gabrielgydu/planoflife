import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import {
  getSyncUrl,
  setSyncUrl,
  getAuthToken,
  setAuthToken,
  setAccountSalt,
  getSyncVersion,
  setSyncVersion,
  getLastSyncedAt,
  setLastSyncedAt,
  clearSyncCredentials,
} from './config'
import { deriveAuthToken, deriveEncKey, decryptState, base64ToBytes } from './syncCrypto'
import { fetchRemote, SyncAuthError } from './syncClient'
import { applyRemoteState, hasUserData, snapshotLocal } from './applyState'
import { clearEncKey, loadEncKey, saveEncKey } from './keyStore'
import { SYNC_TABLES, type SyncState, type SyncStatus } from './types'

type Counts = Record<string, number>

export type ConnectResult =
  | { ok: true }
  | { ok: false; reason: 'empty' }
  | { needsConfirm: true; cloudCounts: Counts; localCounts: Counts }

interface SyncContextValue {
  status: SyncStatus
  configured: boolean
  unlocked: boolean
  lastSyncedAt: string | null
  error: string | null
  workerUrl: string | null
  connect: (url: string, passphrase: string) => Promise<ConnectResult>
  confirmAdopt: () => Promise<void>
  cancelAdopt: () => void
  syncNow: () => Promise<void>
  disconnect: () => Promise<void>
}

const SyncContext = createContext<SyncContextValue | null>(null)

function countsOf(state: SyncState): Counts {
  const out: Counts = {}
  for (const t of SYNC_TABLES) out[t] = state.data[t]?.length ?? 0
  return out
}

async function localCounts(): Promise<Counts> {
  const out: Counts = {}
  const snap = await snapshotLocal()
  for (const t of SYNC_TABLES) out[t] = snap.data[t]?.length ?? 0
  return out
}

export function SyncProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<SyncStatus>('unconfigured')
  const [unlocked, setUnlocked] = useState(false)
  const [lastSyncedAt, setLast] = useState<string | null>(getLastSyncedAt())
  const [error, setError] = useState<string | null>(null)
  const [workerUrl, setWorkerUrl] = useState<string | null>(getSyncUrl())

  const keyRef = useRef<CryptoKey | null>(null)
  const tokenRef = useRef<string | null>(null)
  const syncingRef = useRef(false)
  const pending = useRef<{
    key: CryptoKey
    token: string
    salt: string
    state: SyncState
    version: number
  } | null>(null)

  const markSynced = useCallback((version: number) => {
    const now = new Date().toISOString()
    setSyncVersion(version)
    setLastSyncedAt(now)
    setLast(now)
  }, [])

  const syncNow = useCallback(async () => {
    if (!keyRef.current || !tokenRef.current || syncingRef.current) return
    const url = getSyncUrl()
    if (!url) return
    syncingRef.current = true
    setStatus('syncing')
    setError(null)
    try {
      const remote = await fetchRemote(url, tokenRef.current)
      if (remote.blob && remote.version > getSyncVersion()) {
        const state = await decryptState(remote.blob, keyRef.current)
        await applyRemoteState(state)
        markSynced(remote.version)
      } else if (remote.blob) {
        // already up to date
      }
      setStatus('idle')
    } catch (e) {
      if (e instanceof SyncAuthError) {
        setError('Sessão inválida. Reconecte.')
        setStatus('error')
      } else {
        setStatus('offline')
      }
    } finally {
      syncingRef.current = false
    }
  }, [markSynced])

  // Restore unlocked session on load.
  useEffect(() => {
    let cancelled = false
    ;(async () => {
      const url = getSyncUrl()
      setWorkerUrl(url)
      if (!url) {
        setStatus('unconfigured')
        return
      }
      const token = getAuthToken()
      const key = token ? await loadEncKey() : null
      if (cancelled) return
      if (token && key) {
        keyRef.current = key
        tokenRef.current = token
        setUnlocked(true)
        setStatus('idle')
        void syncNow()
      } else {
        setStatus('locked')
      }
    })()
    return () => {
      cancelled = true
    }
  }, [syncNow])

  // Pull on focus / when the tab becomes visible.
  useEffect(() => {
    if (!unlocked) return
    const onFocus = () => void syncNow()
    const onVis = () => {
      if (document.visibilityState === 'visible') void syncNow()
    }
    window.addEventListener('focus', onFocus)
    document.addEventListener('visibilitychange', onVis)
    return () => {
      window.removeEventListener('focus', onFocus)
      document.removeEventListener('visibilitychange', onVis)
    }
  }, [unlocked, syncNow])

  const finishUnlock = useCallback(
    async (key: CryptoKey, token: string, salt: string) => {
      await saveEncKey(key)
      setAuthToken(token)
      setAccountSalt(salt)
      keyRef.current = key
      tokenRef.current = token
      setUnlocked(true)
      setStatus('idle')
      void navigator.storage?.persist?.()
    },
    []
  )

  const connect = useCallback(
    async (url: string, passphrase: string): Promise<ConnectResult> => {
      setError(null)
      setStatus('syncing')
      const cleanUrl = url.replace(/\/+$/, '')
      try {
        const token = await deriveAuthToken(passphrase)
        const remote = await fetchRemote(cleanUrl, token) // 401 => SyncAuthError
        setSyncUrl(cleanUrl)
        setWorkerUrl(cleanUrl)

        if (!remote.blob || !remote.salt) {
          setStatus('locked')
          return { ok: false, reason: 'empty' }
        }

        const key = await deriveEncKey(passphrase, base64ToBytes(remote.salt))
        const state = await decryptState(remote.blob, key) // wrong passphrase => throws

        if (await hasUserData()) {
          pending.current = { key, token, salt: remote.salt, state, version: remote.version }
          setStatus('locked')
          return {
            needsConfirm: true,
            cloudCounts: countsOf(state),
            localCounts: await localCounts(),
          }
        }

        await applyRemoteState(state)
        await finishUnlock(key, token, remote.salt)
        markSynced(remote.version)
        return { ok: true }
      } catch (e) {
        if (e instanceof SyncAuthError) setError('Não autorizado — verifique a senha e a URL.')
        else setError(e instanceof Error ? e.message : 'Erro ao conectar.')
        setStatus(getAuthToken() ? 'idle' : 'locked')
        throw e
      }
    },
    [finishUnlock, markSynced]
  )

  const confirmAdopt = useCallback(async () => {
    const p = pending.current
    if (!p) return
    await applyRemoteState(p.state)
    await finishUnlock(p.key, p.token, p.salt)
    markSynced(p.version)
    pending.current = null
  }, [finishUnlock, markSynced])

  const cancelAdopt = useCallback(() => {
    pending.current = null
    setStatus('locked')
  }, [])

  const disconnect = useCallback(async () => {
    await clearEncKey()
    clearSyncCredentials()
    keyRef.current = null
    tokenRef.current = null
    pending.current = null
    setUnlocked(false)
    setLast(null)
    setError(null)
    setStatus(getSyncUrl() ? 'locked' : 'unconfigured')
  }, [])

  const value: SyncContextValue = {
    status,
    configured: Boolean(workerUrl),
    unlocked,
    lastSyncedAt,
    error,
    workerUrl,
    connect,
    confirmAdopt,
    cancelAdopt,
    syncNow,
    disconnect,
  }

  return <SyncContext.Provider value={value}>{children}</SyncContext.Provider>
}

export function useSync(): SyncContextValue {
  const ctx = useContext(SyncContext)
  if (!ctx) throw new Error('useSync must be used within SyncProvider')
  return ctx
}
