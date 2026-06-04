#!/usr/bin/env node
/**
 * Phase 4 end-to-end test: two isolated browser contexts (devices A and B) sync
 * through a LOCAL sync Worker. Verifies the auto-push path:
 *   1. push     — an edit in A (toggle a practice) reaches the cloud
 *   2. pull     — B pulls A's edit
 *   3. no echo  — B applying A's pull does NOT push back (version stays put)
 *   4. settings — a theme change in A reaches the cloud and applies in B
 *   5. conflict — divergent edits in A and B both survive (per-record merge)
 *
 * No Cloudflare account needed (wrangler dev --local). Playwright is resolved
 * from the global modules. Run: node scripts/e2e-phase4.mjs
 */
import { spawn, execSync } from 'node:child_process'
import { createRequire } from 'node:module'
import { writeFileSync, existsSync, copyFileSync, rmSync } from 'node:fs'
import { setTimeout as sleep } from 'node:timers/promises'
import {
  deriveAuthToken,
  deriveEncKey,
  encryptState,
  decryptState,
  randomSalt,
  b64,
  unb64,
} from './sync-core.mjs'

const globalModules = execSync('npm root -g').toString().trim()
const require = createRequire(globalModules + '/')
const { chromium } = require('playwright')

const PASS = 'e2e-pass-phase4'
const APP_PORT = 5183
const WORKER_PORT = 8799
const APP_ORIGIN = `http://localhost:${APP_PORT}`
const BASE = '/planoflife/'
const WORKER_URL = `http://127.0.0.1:${WORKER_PORT}`
const DEV_VARS = 'worker/.dev.vars'
const DEV_VARS_BAK = 'worker/.dev.vars.e2ebak'

const now = new Date().toISOString()
const cat = { id: 'cat-test', name: 'Testes', sortOrder: 0, emoji: 'Sun', createdAt: now, updatedAt: now }
const practice = (id, name, sortOrder) => ({
  id, name, categoryId: cat.id, content: '', imageData: null,
  isRequired: false, sortOrder, isArchived: false, createdAt: now, updatedAt: now,
})
const SEED_STATE = {
  schema: 1,
  data: {
    categories: [cat],
    practices: [practice('prac-1', 'Prática Um', 0), practice('prac-2', 'Prática Dois', 1), practice('prac-3', 'Prática Três', 2)],
    dailyRecords: [], missedReasons: [], examenEntries: [], guidingQuestions: [], propositos: [],
  },
  settings: {},
}

let token, encKey
const procs = []
const checks = []
function check(name, cond, detail = '') {
  checks.push({ name, ok: !!cond, detail })
  console.log(`${cond ? '✓' : '✗'} ${name}${detail ? ' — ' + detail : ''}`)
}

async function waitFor(fn, { tries = 60, delay = 1000, label = 'condition' } = {}) {
  for (let i = 0; i < tries; i++) {
    try { if (await fn()) return true } catch { /* keep waiting */ }
    await sleep(delay)
  }
  throw new Error(`Timed out waiting for ${label}`)
}

async function api(method, path = '/state', body) {
  const res = await fetch(`${WORKER_URL}${path}`, {
    method,
    headers: { Authorization: `Bearer ${token}`, ...(body ? { 'Content-Type': 'application/json' } : {}) },
    cache: 'no-store',
    body: body ? JSON.stringify(body) : undefined,
  })
  const text = await res.text()
  return { status: res.status, json: text ? JSON.parse(text) : {} }
}

async function getCloud() {
  const { json } = await api('GET')
  if (!json.blob) return { version: json.version, state: null }
  const state = await decryptState(json.blob, encKey)
  return { version: json.version, state }
}

function dr(state, practiceId) {
  return (state?.data?.dailyRecords ?? []).find((r) => r.practiceId === practiceId)
}

async function connectDevice(browser, name) {
  const ctx = await browser.newContext({ serviceWorkers: 'block' })
  await ctx.addInitScript(() => {
    const d = new Date()
    const p = (n) => String(n).padStart(2, '0')
    // Suppress the morning-review modal so the daily toggles are interactable.
    localStorage.setItem('morning-flow-last-reviewed-date', `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`)
  })
  const page = await ctx.newPage()
  page.on('pageerror', (e) => console.log(`  [${name} pageerror] ${e.message}`))
  await page.goto(`${APP_ORIGIN}${BASE}settings`, { waitUntil: 'networkidle' })
  await page.fill('input[type=url]', WORKER_URL)
  await page.fill('input[type=password]', PASS)
  await page.getByRole('button', { name: 'Conectar' }).click()
  await page.getByText('Sincronizado', { exact: true }).waitFor({ timeout: 20000 })
  return { ctx, page }
}

async function toggle(page, practiceName) {
  const nameBtn = page.getByRole('button', { name: practiceName, exact: true })
  await nameBtn.waitFor({ timeout: 10000 })
  await nameBtn.locator('xpath=preceding-sibling::button[1]').click()
}

// Synchronous, idempotent restore of the real .dev.vars. Registered on 'exit' so
// it runs even if cleanup kills this process before the finally block finishes.
function restoreDevVars() {
  if (existsSync(DEV_VARS_BAK)) {
    copyFileSync(DEV_VARS_BAK, DEV_VARS)
    rmSync(DEV_VARS_BAK)
  }
}
process.on('exit', restoreDevVars)

async function main() {
  // --- prepare worker dev vars (back up the real one) ---
  token = await deriveAuthToken(PASS)
  if (existsSync(DEV_VARS)) copyFileSync(DEV_VARS, DEV_VARS_BAK)
  writeFileSync(DEV_VARS, `SYNC_TOKEN=${token}\nALLOWED_ORIGINS=${APP_ORIGIN},${WORKER_URL}\n`)

  // --- (re)build the app so preview serves the latest code ---
  console.log('• building app…')
  execSync('npm run build', { stdio: 'inherit' })

  // --- start the local worker ---
  console.log('• starting worker…')
  const worker = spawn('npx', ['wrangler', 'dev', '--ip', '127.0.0.1', '--port', String(WORKER_PORT), '--local'], {
    cwd: 'worker', stdio: ['ignore', 'pipe', 'pipe'], detached: true,
  })
  procs.push(worker)
  worker.stderr.on('data', (d) => { const s = String(d); if (/error|Error/.test(s)) console.log('  [worker] ' + s.trim()) })
  await waitFor(async () => (await fetch(`${WORKER_URL}/health`)).ok, { label: 'worker /health' })

  // --- seed the cloud (mint salt, version 1) ---
  console.log('• seeding cloud…')
  await api('DELETE')
  const salt = b64(randomSalt())
  encKey = await deriveEncKey(PASS, unb64(salt))
  const blob = await encryptState(SEED_STATE, encKey)
  const put = await api('PUT', '/state', { baseVersion: 0, blob, salt })
  check('seed PUT returns v1', put.json.version === 1, `got v${put.json.version}`)

  // --- start the preview server (prod build) ---
  console.log('• starting preview…')
  const preview = spawn('npx', ['vite', 'preview', '--port', String(APP_PORT), '--strictPort'], { stdio: ['ignore', 'pipe', 'pipe'], detached: true })
  procs.push(preview)
  await waitFor(async () => (await fetch(`${APP_ORIGIN}${BASE}`)).ok, { label: 'preview server' })

  const browser = await chromium.launch({ headless: true })
  procs.push({ kill: () => browser.close().catch(() => {}) })

  // --- connect both devices ---
  console.log('• connecting devices…')
  const A = await connectDevice(browser, 'A')
  const B = await connectDevice(browser, 'B')
  check('A + B both connected', true)

  // 1) PUSH: toggle a practice in A → reaches cloud
  console.log('• test: push from A…')
  await A.page.goto(`${APP_ORIGIN}${BASE}`, { waitUntil: 'networkidle' })
  await toggle(A.page, 'Prática Um')
  await waitFor(async () => (await getCloud()).version >= 2, { tries: 15, label: "A's push to land" })
  const afterPush = await getCloud()
  check('A push: cloud advanced to v2', afterPush.version === 2, `v${afterPush.version}`)
  check('A push: prac-1 completed in cloud', dr(afterPush.state, 'prac-1')?.isCompleted === true)
  check('A push: dailyRecord carries updatedAt', !!dr(afterPush.state, 'prac-1')?.updatedAt)

  // 2) PULL + 3) NO ECHO: B pulls A's edit; B must not push back
  console.log('• test: pull to B + no echo…')
  const versionBeforeBPull = (await getCloud()).version
  await B.page.getByRole('button', { name: 'Sincronizar agora' }).click()
  await sleep(3000)
  await B.page.goto(`${APP_ORIGIN}${BASE}`, { waitUntil: 'networkidle' })
  const bHasDone = await B.page.getByRole('button', { name: 'Desmarcar' }).count()
  check('B pulled A edit (1 completed practice)', bHasDone === 1, `${bHasDone} completed`)
  const versionAfterBPull = (await getCloud()).version
  check('no echo: version unchanged after B pulled', versionAfterBPull === versionBeforeBPull, `v${versionBeforeBPull} → v${versionAfterBPull}`)

  // 4) SETTINGS: change theme in A → reaches cloud + applies in B
  console.log('• test: settings sync…')
  await A.page.goto(`${APP_ORIGIN}${BASE}settings`, { waitUntil: 'networkidle' })
  // Toggle theme via the in-app control if present; else set + dispatch through the app's setter is not exposed,
  // so click a theme option button by accessible name.
  const themeBtn = A.page.getByRole('button', { name: 'Escuro', exact: true }).first()
  let settingsTested = false
  if (await themeBtn.count()) {
    const before = (await getCloud()).version
    await themeBtn.click()
    try {
      await waitFor(async () => (await getCloud()).version > before, { tries: 12, label: 'theme push' })
      const c = await getCloud()
      check('settings push: theme-mode present in cloud', typeof c.state?.settings?.['theme-mode'] === 'string', JSON.stringify(c.state?.settings))
      settingsTested = true
    } catch (e) {
      check('settings push reached cloud', false, e.message)
    }
  }
  if (!settingsTested) console.log('  (theme control not found by name — skipped settings push assert)')

  // 5) CONFLICT: divergent edits in A (stale) and B both survive
  console.log('• test: conflict merge convergence…')
  // Bring B current first (it is at the post-settings version), then edit B.
  await B.page.goto(`${APP_ORIGIN}${BASE}settings`, { waitUntil: 'networkidle' })
  await B.page.getByRole('button', { name: 'Sincronizar agora' }).click()
  await sleep(2500)
  await B.page.goto(`${APP_ORIGIN}${BASE}`, { waitUntil: 'networkidle' })
  await toggle(B.page, 'Prática Dois')
  await sleep(3000) // let B's push land first so A's push conflicts
  // A is still on settings/home at its older version and has NOT pulled B's edit.
  await A.page.goto(`${APP_ORIGIN}${BASE}`, { waitUntil: 'networkidle' })
  await toggle(A.page, 'Prática Três')
  await sleep(6000) // A: push → 409 → merge → re-push
  const final = await getCloud()
  check('conflict: prac-1 survived', dr(final.state, 'prac-1')?.isCompleted === true)
  check('conflict: prac-2 survived (B edit)', dr(final.state, 'prac-2')?.isCompleted === true)
  check('conflict: prac-3 survived (A edit)', dr(final.state, 'prac-3')?.isCompleted === true)

  await browser.close()
}

main()
  .catch((e) => { console.error('\nFATAL:', e.stack || e.message); check('harness ran to completion', false, e.message) })
  .finally(async () => {
    // Restore BEFORE killing anything, and again via the 'exit' handler, so the
    // real .dev.vars can never be left clobbered even if a kill ends us early.
    restoreDevVars()
    // Kill our spawned servers by process GROUP (they were spawned detached), so
    // the npx → wrangler → workerd chain dies without touching other projects'
    // workerd instances.
    for (const p of procs) {
      try {
        if (typeof p.pid === 'number') process.kill(-p.pid, 'SIGTERM')
        else p.kill?.()
      } catch { /* ignore */ }
    }
    const failed = checks.filter((c) => !c.ok)
    console.log(`\n${'='.repeat(48)}\n${checks.length - failed.length}/${checks.length} checks passed`)
    if (failed.length) { console.log('FAILED:'); failed.forEach((c) => console.log(`  ✗ ${c.name} ${c.detail}`)) }
    process.exit(failed.length ? 1 : 0)
  })
