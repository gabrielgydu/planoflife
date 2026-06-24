/**
 * Canonical sync crypto + payload helpers (Node side).
 *
 * The browser mirror lives in src/sync/syncCrypto.ts and MUST use identical
 * constants and wire formats. Cross-compatibility is verified by round-tripping
 * a CLI-encrypted blob through the browser decrypt path.
 *
 * Wire formats:
 *   authToken = base64url( PBKDF2-SHA256(passphrase, AUTH_SALT, AUTH_ITERATIONS, 32B) )
 *   encKey    = PBKDF2-SHA256(passphrase, accountSalt(16B), ENC_ITERATIONS) -> AES-GCM-256
 *   blob      = base64( iv(12B) || AES-GCM(encKey, iv, utf8(JSON.stringify(SyncState))) )
 *   salt      = base64( accountSalt )            (stored separately in the Worker)
 */
import { webcrypto as crypto } from 'node:crypto'

// --- canonical constants (keep identical in src/sync/syncCrypto.ts) ---
const AUTH_SALT = new TextEncoder().encode('planoflife-sync/auth/v1')
const AUTH_ITERATIONS = 310_000
const ENC_ITERATIONS = 600_000
export const ENC_SALT_BYTES = 16
const IV_BYTES = 12
// ----------------------------------------------------------------------

// Tables present since sync schema 1. Every snapshot must carry all of these.
const LEGACY_TABLES = [
  'categories',
  'practices',
  'dailyRecords',
  'missedReasons',
  'examenEntries',
  'guidingQuestions',
  'propositos',
]

// Added in sync schema 2 (career section). Snapshots from schema-1 clients lack
// these keys entirely — normalizeSyncState() fills them in on pull.
export const CAREER_TABLES = [
  'careerPlan',
  'careerMoves',
  'careerDeadlines',
  'careerOutreach',
  'careerLadder',
  'careerWins',
  'careerLog',
]

// Added in sync schema 3 (Meditação daily point). Like the career tables,
// schema-≤2 snapshots lack this key entirely; validateSyncState allows it missing.
export const MEDITATION_TABLES = ['meditationDays']

export const TABLES = [...LEGACY_TABLES, ...CAREER_TABLES, ...MEDITATION_TABLES]

export const SYNC_SCHEMA = 3

export function b64(bytes) {
  return Buffer.from(bytes).toString('base64')
}
export function unb64(s) {
  return new Uint8Array(Buffer.from(s, 'base64'))
}
function b64url(bytes) {
  return Buffer.from(bytes).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

export async function deriveAuthToken(passphrase) {
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
  return b64url(bits)
}

export async function deriveEncKey(passphrase, saltBytes) {
  const km = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(passphrase),
    'PBKDF2',
    false,
    ['deriveKey']
  )
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt: saltBytes, iterations: ENC_ITERATIONS, hash: 'SHA-256' },
    km,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  )
}

export function randomSalt() {
  return crypto.getRandomValues(new Uint8Array(ENC_SALT_BYTES))
}

/** Encrypt a SyncState object -> base64(iv||ciphertext). */
export async function encryptState(state, key) {
  const iv = crypto.getRandomValues(new Uint8Array(IV_BYTES))
  const plaintext = new TextEncoder().encode(JSON.stringify(state))
  const ct = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, plaintext))
  const out = new Uint8Array(IV_BYTES + ct.byteLength)
  out.set(iv, 0)
  out.set(ct, IV_BYTES)
  return b64(out)
}

/** Decrypt base64(iv||ciphertext) -> SyncState object. Throws on wrong key. */
export async function decryptState(blobBase64, key) {
  const data = unb64(blobBase64)
  const iv = data.slice(0, IV_BYTES)
  const ct = data.slice(IV_BYTES)
  let pt
  try {
    pt = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, ct)
  } catch {
    throw new Error('Decryption failed — wrong passphrase?')
  }
  return JSON.parse(new TextDecoder().decode(pt))
}

/**
 * Minimal structural validation of a SyncState before pushing.
 *
 * Career tables are allowed to be MISSING (not just empty): a missing key means
 * "this snapshot's writer had no opinion about that table" and app clients then
 * PRESERVE their local rows instead of clearing them. Filling missing keys with
 * `[]` before a push would launder "no opinion" into "authoritatively empty"
 * and wipe every device's rows on their next pull — never do that.
 */
export function validateSyncState(state) {
  if (!state || typeof state !== 'object') throw new Error('state must be an object')
  if (!state.data || typeof state.data !== 'object') throw new Error('state.data missing')
  for (const t of LEGACY_TABLES) {
    if (!Array.isArray(state.data[t])) throw new Error(`state.data.${t} must be an array`)
  }
  for (const t of [...CAREER_TABLES, ...MEDITATION_TABLES]) {
    if (state.data[t] !== undefined && !Array.isArray(state.data[t])) {
      throw new Error(`state.data.${t} must be an array when present`)
    }
  }
  if (state.settings && typeof state.settings !== 'object') {
    throw new Error('state.settings must be an object')
  }
  return true
}

/**
 * Refuse snapshots NEWER than this code understands — pushing one back would
 * strip the tables this version doesn't know about. Returns the state as-is;
 * deliberately does NOT fill missing career keys (see validateSyncState).
 */
export function assertKnownSchema(state) {
  if (!state || typeof state !== 'object' || !state.data) {
    throw new Error('not a SyncState (missing .data)')
  }
  if (typeof state.schema === 'number' && state.schema > SYNC_SCHEMA) {
    throw new Error(
      `snapshot schema v${state.schema} is newer than this CLI (v${SYNC_SCHEMA}) — update the repo first`
    )
  }
  return state
}

/** Build a SyncState from an app BackupData file ({version, exportedAt, data}). */
export function syncStateFromBackup(backup) {
  if (!backup?.data) throw new Error('Not a Plano de Vida backup (missing .data)')
  return { schema: SYNC_SCHEMA, data: backup.data, settings: backup.settings ?? {} }
}

export function summarize(state) {
  return TABLES.map((t) => `${t}=${state.data?.[t]?.length ?? 0}`).join(' ')
}
