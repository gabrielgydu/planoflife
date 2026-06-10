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
  getAccountSalt,
  setAccountSalt,
  getSyncVersion,
  setSyncVersion,
  getLastSyncedAt,
  setLastSyncedAt,
  clearSyncCredentials,
} from './config'
import {
  deriveAuthToken,
  deriveEncKey,
  encryptState,
  decryptState,
  base64ToBytes,
  assertCryptoAvailable,
} from './syncCrypto'
import {
  fetchRemote,
  fetchRemoteMeta,
  pushRemote,
  SyncAuthError,
  SyncConflictError,
} from './syncClient'
import {
  applyRemoteState,
  mergeRemoteIntoLocal,
  hasUserData,
  snapshotLocal,
} from './applyState'
import { setDirtyHandler } from './mutationCapture'
import {
  onLocalSettingChanged,
  getLocallyChangedSettingKeys,
  markSettingsPushed,
  clearLocallyChangedSettings,
} from './settingsBus'
import { clearEncKey, loadEncKey, saveEncKey } from './keyStore'
import {
  SYNC_TABLES,
  SyncSchemaError,
  assertKnownSchema,
  type SyncState,
  type SyncStatus,
} from './types'

const SCHEMA_ERROR_MSG =
  'Os dados na nuvem vêm de uma versão mais nova do app. Recarregue para atualizar.'

type Counts = Record<string, number>

// How long to coalesce local writes before pushing, the periodic pull cadence,
// and how many times to pull-merge-retry on a push conflict before giving up.
const PUSH_DEBOUNCE_MS = 1500
const POLL_INTERVAL_MS = 60_000
const MAX_PUSH_CONFLICT_RETRIES = 3

export type ConnectResult =
  | { ok: true }
  | { ok: false; reason: 'empty' }
  | { needsConfirm: true; cloudCounts: Counts; localCounts: Counts }

interface SyncContextValue {
  status: SyncStatus
  configured: boolean
  unlocked: boolean
  pendingPush: boolean
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
  const [pendingPush, setPendingPush] = useState(false)
  const [lastSyncedAt, setLast] = useState<string | null>(getLastSyncedAt())
  const [error, setError] = useState<string | null>(null)
  const [workerUrl, setWorkerUrl] = useState<string | null>(getSyncUrl())

  const keyRef = useRef<CryptoKey | null>(null)
  const tokenRef = useRef<string | null>(null)
  const syncingRef = useRef(false) // a pull or push is in flight
  const dirtyRef = useRef(false) // local edits not yet pushed
  const initialPullDoneRef = useRef(false) // gate pushes until first pull ran
  const pushTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const pushNowRef = useRef<(() => Promise<void>) | null>(null)
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

  // Debounce: (re)arm a single push timer. Reads the latest pushNow via a ref so
  // schedulePush itself never needs to depend on pushNow.
  const schedulePush = useCallback((delay: number) => {
    if (pushTimerRef.current) clearTimeout(pushTimerRef.current)
    pushTimerRef.current = setTimeout(() => {
      pushTimerRef.current = null
      void pushNowRef.current?.()
    }, delay)
  }, [])

  // The applied snapshot came from an older writer and LACKED tables this app
  // knows, so local rows were preserved instead of cleared (see clearAndBulkAdd).
  // Push them back promptly — without this, the cloud stays stripped until an
  // organic edit, and another up-to-date client could push authoritative empty
  // tables in the meantime, cementing the loss.
  const repairAfterPreserve = useCallback(
    (res: { preservedLocalRows: boolean }) => {
      if (!res.preservedLocalRows) return
      dirtyRef.current = true
      setPendingPush(true)
      schedulePush(PUSH_DEBOUNCE_MS)
    },
    [schedulePush]
  )

  // Pull: cheap version probe first, full GET + apply only when the cloud is ahead.
  // Data-safety: applyRemoteState is a destructive full replace. If there are
  // unpushed local edits, a plain pull would clobber them, so we push instead
  // (the push merges on a 409). We also re-check dirtiness right before applying,
  // to catch an edit that landed during the network round-trip.
  const syncNow = useCallback(async () => {
    if (!keyRef.current || !tokenRef.current || syncingRef.current) return
    if (dirtyRef.current) {
      schedulePush(0) // have local edits → push-merge instead of pull-overwrite
      return
    }
    const url = getSyncUrl()
    if (!url) return
    syncingRef.current = true
    setStatus('syncing')
    setError(null)
    try {
      const meta = await fetchRemoteMeta(url, tokenRef.current)
      if (meta.version > getSyncVersion()) {
        const remote = await fetchRemote(url, tokenRef.current)
        if (remote.blob && remote.version > getSyncVersion()) {
          const remoteState = assertKnownSchema(
            await decryptState(remote.blob, keyRef.current)
          )
          if (dirtyRef.current) {
            // An edit landed mid-fetch — merge it in atomically rather than
            // overwrite, then push the merged result so the cloud converges too.
            await mergeRemoteIntoLocal(remoteState, getLocallyChangedSettingKeys())
            setSyncVersion(remote.version)
            schedulePush(0)
          } else {
            const applied = await applyRemoteState(remoteState)
            markSynced(remote.version)
            repairAfterPreserve(applied)
          }
        }
      }
      setStatus('idle')
    } catch (e) {
      if (e instanceof SyncAuthError) {
        setError('Sessão inválida. Reconecte.')
        setStatus('error')
      } else if (e instanceof SyncSchemaError) {
        setError(SCHEMA_ERROR_MSG)
        setStatus('error')
      } else {
        setStatus('offline')
      }
    } finally {
      syncingRef.current = false
    }
  }, [markSynced, schedulePush, repairAfterPreserve])

  // Push: encrypt the local snapshot and PUT it. On a 409 (cloud advanced under
  // us) pull-merge-retry so a concurrent edit on the other device isn't lost.
  const pushNow = useCallback(async () => {
    const key = keyRef.current
    const token = tokenRef.current
    if (!key || !token) return
    // Don't push before the first pull has run (avoids a needless startup conflict).
    if (!initialPullDoneRef.current) {
      schedulePush(500)
      return
    }
    const url = getSyncUrl()
    if (!url) return
    const salt = getAccountSalt()
    if (!salt) {
      // We think we're unlocked but the account salt is gone — most likely another
      // tab called disconnect(). Surface it (dirtyRef stays true) rather than
      // silently dropping the edit; reconnecting restores the salt and retries.
      setError('Sincronização desconectada em outra aba. Reconecte.')
      setStatus('error')
      return
    }
    if (syncingRef.current) {
      schedulePush(400) // a pull/push is running; try again shortly
      return
    }
    syncingRef.current = true
    // Optimistic: clear now so writes that land DURING the push re-set dirtyRef
    // (via the Dexie hook) and get picked up by the finally re-schedule. The
    // snapshot below reads the live DB, so such a write is never lost.
    dirtyRef.current = false
    setStatus('syncing')
    setError(null)
    setPendingPush(true)
    try {
      for (let attempt = 0; ; attempt++) {
        try {
          const state = await snapshotLocal()
          // Settings included in THIS snapshot; only forget these on success so a
          // pref changed during the round-trip stays tracked for a later conflict.
          const pushedSettingKeys = getLocallyChangedSettingKeys()
          const blob = await encryptState(state, key)
          const res = await pushRemote(url, token, {
            baseVersion: getSyncVersion(),
            blob,
            salt,
          })
          markSynced(res.version)
          markSettingsPushed(pushedSettingKeys) // these settings are now in the cloud
          break
        } catch (e) {
          if (e instanceof SyncConflictError && attempt < MAX_PUSH_CONFLICT_RETRIES) {
            // Cloud moved ahead: pull it, merge into local atomically, retry.
            const remote = await fetchRemote(url, token)
            if (!remote.blob) {
              // Cloud was emptied/reset mid-conflict — don't silently overwrite.
              throw new Error('Conflito: a nuvem foi esvaziada durante o envio.')
            }
            const remoteState = assertKnownSchema(await decryptState(remote.blob, key))
            await mergeRemoteIntoLocal(remoteState, getLocallyChangedSettingKeys())
            setSyncVersion(remote.version) // base for the retry push
            continue
          }
          throw e
        }
      }
      setStatus('idle')
    } catch (e) {
      if (e instanceof SyncAuthError) {
        setError('Sessão inválida. Reconecte.')
        setStatus('error')
      } else if (e instanceof SyncSchemaError) {
        // Pushing now would strip tables this app doesn't know. Keep the edits
        // local (dirty) until the app is updated.
        setError(SCHEMA_ERROR_MSG)
        setStatus('error')
      } else {
        setStatus('offline')
      }
      dirtyRef.current = true // unpushed changes remain; retry later
    } finally {
      syncingRef.current = false
      setPendingPush(dirtyRef.current)
      if (dirtyRef.current) schedulePush(PUSH_DEBOUNCE_MS)
    }
  }, [markSynced, schedulePush])

  // A local write (DB row or synced setting) happened → schedule a push.
  const onDirty = useCallback(() => {
    if (!keyRef.current) return // not unlocked
    dirtyRef.current = true
    setPendingPush(true)
    schedulePush(PUSH_DEBOUNCE_MS)
  }, [schedulePush])

  // Keep the debounce timer pointed at the latest pushNow.
  useEffect(() => {
    pushNowRef.current = pushNow
  }, [pushNow])

  // Restore an unlocked session on load, then run the first pull.
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
        await syncNow()
        initialPullDoneRef.current = true
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

  // Capture local writes (DB + synced settings) and push them while unlocked.
  useEffect(() => {
    if (!unlocked) return
    setDirtyHandler(onDirty)
    const offSettings = onLocalSettingChanged(onDirty)
    return () => {
      setDirtyHandler(null)
      offSettings()
    }
  }, [unlocked, onDirty])

  // Poll while visible so an idle, open device refreshes without a focus event.
  useEffect(() => {
    if (!unlocked) return
    const id = setInterval(() => {
      if (document.visibilityState === 'visible') void syncNow()
    }, POLL_INTERVAL_MS)
    return () => clearInterval(id)
  }, [unlocked, syncNow])

  const finishUnlock = useCallback(
    async (key: CryptoKey, token: string, salt: string) => {
      await saveEncKey(key)
      setAuthToken(token)
      setAccountSalt(salt)
      keyRef.current = key
      tokenRef.current = token
      // We just adopted the cloud snapshot — drop any pre-connect local setting
      // edits so they don't override the adopted settings on a later conflict.
      clearLocallyChangedSettings()
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
        assertCryptoAvailable()
        const token = await deriveAuthToken(passphrase)
        const remote = await fetchRemote(cleanUrl, token) // 401 => SyncAuthError

        if (!remote.blob || !remote.salt) {
          // Don't persist the URL for an empty/incomplete account: another tab may
          // be unlocked against a different account whose credentials still apply.
          setStatus(getAuthToken() ? 'idle' : 'locked')
          return { ok: false, reason: 'empty' }
        }

        setSyncUrl(cleanUrl)
        setWorkerUrl(cleanUrl)

        const key = await deriveEncKey(passphrase, base64ToBytes(remote.salt))
        // wrong passphrase => decrypt throws; newer-app snapshot => schema error
        const state = assertKnownSchema(await decryptState(remote.blob, key))

        if (await hasUserData()) {
          pending.current = { key, token, salt: remote.salt, state, version: remote.version }
          setStatus('locked')
          return {
            needsConfirm: true,
            cloudCounts: countsOf(state),
            localCounts: await localCounts(),
          }
        }

        const applied = await applyRemoteState(state)
        await finishUnlock(key, token, remote.salt)
        markSynced(remote.version)
        initialPullDoneRef.current = true
        repairAfterPreserve(applied)
        return { ok: true }
      } catch (e) {
        if (e instanceof SyncAuthError) setError('Não autorizado — verifique a senha e a URL.')
        else if (e instanceof SyncSchemaError) setError(SCHEMA_ERROR_MSG)
        else setError(e instanceof Error ? e.message : 'Erro ao conectar.')
        setStatus(getAuthToken() ? 'idle' : 'locked')
        throw e
      }
    },
    [finishUnlock, markSynced, repairAfterPreserve]
  )

  const confirmAdopt = useCallback(async () => {
    const p = pending.current
    if (!p) return
    try {
      const applied = await applyRemoteState(p.state) // transactional — rolls back on failure
      await finishUnlock(p.key, p.token, p.salt)
      markSynced(p.version)
      initialPullDoneRef.current = true
      repairAfterPreserve(applied)
      pending.current = null
    } catch (e) {
      // e.g. saveEncKey failed: the device stays locked. Surface it; reload +
      // reconnect recovers (no data loss — the DB apply is atomic).
      setError(e instanceof Error ? e.message : 'Erro ao adotar dados da nuvem.')
      setStatus('locked')
    }
  }, [finishUnlock, markSynced, repairAfterPreserve])

  const cancelAdopt = useCallback(() => {
    pending.current = null
    setStatus('locked')
  }, [])

  const disconnect = useCallback(async () => {
    if (pushTimerRef.current) {
      clearTimeout(pushTimerRef.current)
      pushTimerRef.current = null
    }
    dirtyRef.current = false
    initialPullDoneRef.current = false
    setPendingPush(false)
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
    pendingPush,
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
