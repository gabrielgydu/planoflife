// Worker URL + persisted sync metadata. The URL is not secret; it can come from a
// build-time env var (VITE_SYNC_URL) or be entered/overridden in the Sync settings.

const LS_URL = 'sync-worker-url'
const LS_TOKEN = 'sync-auth-token'
const LS_SALT = 'sync-account-salt'
const LS_VERSION = 'sync-version'
const LS_LAST_SYNCED = 'sync-last-synced-at'

function trimSlash(u: string): string {
  return u.replace(/\/+$/, '')
}

export function getSyncUrl(): string | null {
  const stored = localStorage.getItem(LS_URL)
  if (stored) return trimSlash(stored)
  const env = (import.meta.env.VITE_SYNC_URL as string | undefined) ?? null
  return env ? trimSlash(env) : null
}

export function setSyncUrl(url: string): void {
  localStorage.setItem(LS_URL, trimSlash(url))
}

export function getAuthToken(): string | null {
  return localStorage.getItem(LS_TOKEN)
}
export function setAuthToken(token: string): void {
  localStorage.setItem(LS_TOKEN, token)
}

export function getAccountSalt(): string | null {
  return localStorage.getItem(LS_SALT)
}
export function setAccountSalt(salt: string): void {
  localStorage.setItem(LS_SALT, salt)
}

export function getSyncVersion(): number {
  return Number(localStorage.getItem(LS_VERSION) ?? '0')
}
export function setSyncVersion(v: number): void {
  localStorage.setItem(LS_VERSION, String(v))
}

export function getLastSyncedAt(): string | null {
  return localStorage.getItem(LS_LAST_SYNCED)
}
export function setLastSyncedAt(iso: string): void {
  localStorage.setItem(LS_LAST_SYNCED, iso)
}

/** Forget device-local sync credentials (keeps the worker URL). */
export function clearSyncCredentials(): void {
  localStorage.removeItem(LS_TOKEN)
  localStorage.removeItem(LS_SALT)
  localStorage.removeItem(LS_VERSION)
  localStorage.removeItem(LS_LAST_SYNCED)
}
