#!/usr/bin/env node
/**
 * Plano de Vida — sync CLI.
 *
 * Lets you (and Claude Code) pull the cloud state to an editable local JSON,
 * edit it, and push it back. End-to-end encrypted: the passphrase never leaves
 * this machine and the Worker only ever receives ciphertext.
 *
 * Config (from .env.local at repo root, or the environment):
 *   SYNC_URL=https://planoflife-sync.<you>.workers.dev
 *   SYNC_PASSPHRASE=your-passphrase
 *
 * Commands:
 *   node scripts/sync.mjs status                 show cloud + local version
 *   node scripts/sync.mjs pull                   cloud -> .sync/state.json
 *   node scripts/sync.mjs push [--force]         .sync/state.json -> cloud
 *   node scripts/sync.mjs push --from <file>     push a specific file
 *   node scripts/sync.mjs seed-from-backup <f>   push an app backup (.json) as cloud state
 */
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs'
import { dirname } from 'node:path'
import {
  deriveAuthToken,
  deriveEncKey,
  encryptState,
  decryptState,
  validateSyncState,
  normalizeSyncState,
  syncStateFromBackup,
  randomSalt,
  b64,
  unb64,
  summarize,
  SYNC_SCHEMA,
} from './sync-core.mjs'

const STATE_FILE = '.sync/state.json'
const META_FILE = '.sync/.meta.json'

try {
  process.loadEnvFile('.env.local')
} catch {
  /* no .env.local — rely on the ambient environment */
}

const SYNC_URL = process.env.SYNC_URL?.replace(/\/$/, '')
const SYNC_PASSPHRASE = process.env.SYNC_PASSPHRASE

function die(msg) {
  console.error(`✗ ${msg}`)
  process.exit(1)
}

function requireConfig() {
  if (!SYNC_URL) die('SYNC_URL not set (put it in .env.local)')
  if (!SYNC_PASSPHRASE) die('SYNC_PASSPHRASE not set (put it in .env.local)')
}

function readJson(path, fallback) {
  if (!existsSync(path)) return fallback
  return JSON.parse(readFileSync(path, 'utf8'))
}

function writeJson(path, obj) {
  mkdirSync(dirname(path), { recursive: true })
  writeFileSync(path, JSON.stringify(obj, null, 2) + '\n')
}

async function api(method, body) {
  const token = await deriveAuthToken(SYNC_PASSPHRASE)
  const res = await fetch(`${SYNC_URL}/state`, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      ...(body ? { 'Content-Type': 'application/json' } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  })
  const text = await res.text()
  let json
  try {
    json = text ? JSON.parse(text) : {}
  } catch {
    json = { raw: text }
  }
  if (res.status === 401) die('Unauthorized — passphrase does not match the Worker secret.')
  return { status: res.status, json }
}

async function getState() {
  const { status, json } = await api('GET')
  if (status !== 200) die(`GET /state failed (${status}): ${JSON.stringify(json)}`)
  return json // { version, blob, salt }
}

async function cmdStatus() {
  requireConfig()
  const remote = await getState()
  const meta = readJson(META_FILE, null)
  console.log(`cloud:  version=${remote.version} ${remote.blob ? 'has-data' : 'EMPTY'} salt=${remote.salt ? 'set' : 'none'}`)
  console.log(`local:  ${meta ? `pulled-version=${meta.version}` : 'no local pull yet'}`)
  if (remote.blob && SYNC_PASSPHRASE && remote.salt) {
    try {
      const key = await deriveEncKey(SYNC_PASSPHRASE, unb64(remote.salt))
      const state = await decryptState(remote.blob, key)
      console.log(`decrypt: OK (${summarize(state)})`)
    } catch (e) {
      console.log(`decrypt: FAILED (${e.message})`)
    }
  }
}

async function cmdPull() {
  requireConfig()
  const remote = await getState()
  if (!remote.blob) {
    console.log('Cloud is empty — nothing to pull. (Push or seed-from-backup first.)')
    return
  }
  if (!remote.salt) die('Cloud has data but no salt — inconsistent state.')
  const key = await deriveEncKey(SYNC_PASSPHRASE, unb64(remote.salt))
  // Normalize: a snapshot pushed by a pre-career app lacks the career tables;
  // fill them as empty so state.json always has the full current shape.
  const state = normalizeSyncState(await decryptState(remote.blob, key))
  validateSyncState(state)
  writeJson(STATE_FILE, state)
  writeJson(META_FILE, { version: remote.version, salt: remote.salt })
  console.log(`✓ pulled v${remote.version} -> ${STATE_FILE}`)
  console.log(`  ${summarize(state)}`)
}

async function cmdPush(args) {
  requireConfig()
  const force = args.includes('--force')
  const fromIdx = args.indexOf('--from')
  const fromFile = fromIdx !== -1 ? args[fromIdx + 1] : null
  const sourceFile = fromFile ?? STATE_FILE

  if (!existsSync(sourceFile)) die(`No file to push at ${sourceFile} (run \`pull\` first).`)
  const state = normalizeSyncState(readJson(sourceFile))
  validateSyncState(state)

  const remote = await getState()
  const meta = readJson(META_FILE, null)

  // Account salt: reuse the server's once set; otherwise the local meta's; else mint one.
  const saltB64 = remote.salt ?? meta?.salt ?? b64(randomSalt())
  const baseVersion = force ? remote.version : (meta?.version ?? 0)

  const key = await deriveEncKey(SYNC_PASSPHRASE, unb64(saltB64))
  const blob = await encryptState(state, key)

  const { status, json } = await api('PUT', { baseVersion, blob, salt: saltB64 })
  if (status === 409) {
    die(
      `Conflict: cloud is at v${json.version}, you based on v${baseVersion}. ` +
        `Run \`pull\` and reapply, or \`push --force\` to overwrite.`
    )
  }
  if (status !== 200) die(`PUT /state failed (${status}): ${JSON.stringify(json)}`)

  writeJson(META_FILE, { version: json.version, salt: saltB64 })
  if (fromFile) writeJson(STATE_FILE, state)
  console.log(`✓ pushed -> cloud v${json.version}`)
  console.log(`  ${summarize(state)}`)
}

async function cmdSeed(args) {
  const file = args[0]
  if (!file) die('Usage: seed-from-backup <backup.json>')
  if (!existsSync(file)) die(`Backup not found: ${file}`)
  const backup = readJson(file)
  const state = { schema: SYNC_SCHEMA, ...syncStateFromBackup(backup) }
  writeJson(STATE_FILE, state)
  console.log(`Prepared ${STATE_FILE} from ${file} (${summarize(state)}). Pushing…`)
  await cmdPush([])
}

const [cmd, ...rest] = process.argv.slice(2)
const commands = {
  status: cmdStatus,
  pull: cmdPull,
  push: () => cmdPush(rest),
  'seed-from-backup': () => cmdSeed(rest),
}
const run = commands[cmd]
if (!run) {
  console.error('Usage: node scripts/sync.mjs <status|pull|push|seed-from-backup> [options]')
  process.exit(1)
}
run().catch((e) => die(e.message))
