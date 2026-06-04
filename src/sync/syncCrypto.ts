// Browser mirror of scripts/sync-core.mjs. The constants and wire formats MUST
// stay identical, or the CLI and the app won't be able to read each other's data.
import type { SyncState } from './types'

// --- canonical constants (identical to scripts/sync-core.mjs) ---
const AUTH_SALT = new TextEncoder().encode('planoflife-sync/auth/v1')
const AUTH_ITERATIONS = 310_000
const ENC_ITERATIONS = 600_000
const IV_BYTES = 12
// ----------------------------------------------------------------

export function bytesToBase64(bytes: Uint8Array): string {
  let bin = ''
  const CHUNK = 0x8000
  for (let i = 0; i < bytes.length; i += CHUNK) {
    bin += String.fromCharCode(...bytes.subarray(i, i + CHUNK))
  }
  return btoa(bin)
}

export function base64ToBytes(b64: string): Uint8Array {
  const bin = atob(b64)
  const out = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i)
  return out
}

function base64url(bytes: Uint8Array): string {
  return bytesToBase64(bytes).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

/** Web Crypto (crypto.subtle) exists only in a secure context (HTTPS / localhost). */
export function isCryptoAvailable(): boolean {
  return typeof crypto !== 'undefined' && !!crypto.subtle
}

export function assertCryptoAvailable(): void {
  if (!isCryptoAvailable()) {
    throw new Error(
      'Sincronização requer HTTPS. Abra o app por https:// (não http).'
    )
  }
}

/** Bearer token sent to the Worker. Derived from passphrase with a FIXED app salt. */
export async function deriveAuthToken(passphrase: string): Promise<string> {
  const km = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(passphrase),
    'PBKDF2',
    false,
    ['deriveBits']
  )
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt: AUTH_SALT, iterations: AUTH_ITERATIONS, hash: 'SHA-256' },
    km,
    256
  )
  return base64url(new Uint8Array(bits))
}

/** Encryption key. Derived from passphrase + the random per-account salt. Non-extractable. */
export async function deriveEncKey(passphrase: string, salt: Uint8Array): Promise<CryptoKey> {
  const km = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(passphrase),
    'PBKDF2',
    false,
    ['deriveKey']
  )
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt: salt as BufferSource, iterations: ENC_ITERATIONS, hash: 'SHA-256' },
    km,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  )
}

export async function encryptState(state: SyncState, key: CryptoKey): Promise<string> {
  const iv = crypto.getRandomValues(new Uint8Array(IV_BYTES))
  const plaintext = new TextEncoder().encode(JSON.stringify(state))
  const ct = new Uint8Array(
    await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, plaintext)
  )
  const out = new Uint8Array(IV_BYTES + ct.byteLength)
  out.set(iv, 0)
  out.set(ct, IV_BYTES)
  return bytesToBase64(out)
}

export async function decryptState(blobBase64: string, key: CryptoKey): Promise<SyncState> {
  const data = base64ToBytes(blobBase64)
  const iv = data.slice(0, IV_BYTES)
  const ct = data.slice(IV_BYTES)
  let pt: ArrayBuffer
  try {
    pt = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, ct)
  } catch {
    throw new Error('Senha incorreta — não foi possível descriptografar.')
  }
  return JSON.parse(new TextDecoder().decode(pt)) as SyncState
}
