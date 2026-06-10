#!/usr/bin/env node
/**
 * Career Phase 0 e2e: Dexie v6 → v7 migration on a COPY OF REAL DATA, plus the
 * career-tab gate.
 *
 *   1. Builds the OLD app (git master) in a temp worktree and the NEW app here.
 *   2. Seeds a local Worker with .sync/state.json (real pulled data, schema 1).
 *   3. A browser device connects on the OLD build → real data lands in Dexie v6.
 *   4. The preview swaps to the NEW build on the same origin → reload upgrades
 *      the SAME IndexedDB to v7. Asserts: all legacy rows intact, 7 empty career
 *      stores, no Carreira tab, and a reload is idempotent.
 *   5. An edit pushes a schema-2 snapshot whose career arrays exist and legacy
 *      counts are unchanged (no data loss through the new sync shape).
 *   6. Injecting/removing a careerPlan row toggles the Carreira tab.
 *   7. A fresh profile (fresh install) never shows the tab.
 *
 * Run: node scripts/e2e-career-migration.mjs  (needs global playwright + wrangler,
 * and a .sync/state.json from `npm run sync:pull`)
 */
import { spawn, execSync } from 'node:child_process'
import { createRequire } from 'node:module'
import { writeFileSync, readFileSync, existsSync, copyFileSync, rmSync } from 'node:fs'
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

const PASS = 'e2e-pass-career-mig'
const APP_PORT = 5184
const WORKER_PORT = 8798
const APP_ORIGIN = `http://localhost:${APP_PORT}`
const BASE = '/planoflife/'
const WORKER_URL = `http://127.0.0.1:${WORKER_PORT}`
const DEV_VARS = 'worker/.dev.vars'
const DEV_VARS_BAK = 'worker/.dev.vars.e2ecareerbak'
const OLD_TREE = '/tmp/plife-e2e-master'
const STATE_FILE = '.sync/state.json'

const CAREER_STORES = [
  'careerPlan', 'careerMoves', 'careerDeadlines', 'careerOutreach',
  'careerLadder', 'careerWins', 'careerLog',
]
const LEGACY_STORES = [
  'categories', 'practices', 'dailyRecords', 'missedReasons',
  'examenEntries', 'guidingQuestions', 'propositos',
]

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

/** Raw-IndexedDB inspection inside the page — independent of app code. */
function pageIdbInfo(page) {
  return page.evaluate(() => new Promise((resolve, reject) => {
    const req = indexedDB.open('PlanOfLifeDB')
    req.onerror = () => reject(req.error)
    req.onsuccess = () => {
      const db = req.result
      const names = [...db.objectStoreNames].sort()
      const out = { version: db.version, names, counts: {} }
      const tx = db.transaction(names, 'readonly')
      let pending = names.length
      for (const n of names) {
        const c = tx.objectStore(n).count()
        c.onsuccess = () => {
          out.counts[n] = c.result
          if (--pending === 0) { db.close(); resolve(out) }
        }
        c.onerror = () => { db.close(); reject(c.error) }
      }
    }
  }))
}

function pagePutCareerPlan(page) {
  return page.evaluate(() => new Promise((resolve, reject) => {
    const req = indexedDB.open('PlanOfLifeDB')
    req.onerror = () => reject(req.error)
    req.onsuccess = () => {
      const db = req.result
      const now = new Date().toISOString()
      const tx = db.transaction('careerPlan', 'readwrite')
      tx.objectStore('careerPlan').put({
        id: 'career-plan', currentPhase: 'Fase 1 — teste', focusLine: 'e2e',
        phases: [], publishedAt: now, updatedAt: now,
      })
      tx.oncomplete = () => { db.close(); resolve(true) }
      tx.onerror = () => { db.close(); reject(tx.error) }
    }
  }))
}

function pageDeleteCareerPlan(page) {
  return page.evaluate(() => new Promise((resolve, reject) => {
    const req = indexedDB.open('PlanOfLifeDB')
    req.onerror = () => reject(req.error)
    req.onsuccess = () => {
      const db = req.result
      const tx = db.transaction('careerPlan', 'readwrite')
      tx.objectStore('careerPlan').delete('career-plan')
      tx.oncomplete = () => { db.close(); resolve(true) }
      tx.onerror = () => { db.close(); reject(tx.error) }
    }
  }))
}

const careerNavLinks = (page) => page.locator(`nav a[href="${BASE}career"]`).count()
const navLinks = (page) => page.locator('nav a').count()

function restoreDevVars() {
  if (existsSync(DEV_VARS_BAK)) {
    copyFileSync(DEV_VARS_BAK, DEV_VARS)
    rmSync(DEV_VARS_BAK)
  }
}
process.on('exit', restoreDevVars)

function startPreview(cwd) {
  const p = spawn('npx', ['vite', 'preview', '--port', String(APP_PORT), '--strictPort'], {
    cwd, stdio: ['ignore', 'pipe', 'pipe'], detached: true,
  })
  procs.push(p)
  return waitFor(async () => (await fetch(`${APP_ORIGIN}${BASE}`)).ok, { label: `preview (${cwd})` }).then(() => p)
}

function stop(proc) {
  try { process.kill(-proc.pid, 'SIGTERM') } catch { /* already gone */ }
  return sleep(800)
}

async function main() {
  if (!existsSync(STATE_FILE)) throw new Error(`${STATE_FILE} missing — run \`npm run sync:pull\` first`)
  const realState = JSON.parse(readFileSync(STATE_FILE, 'utf8'))
  // Seed the worker with the schema-1 shape (what the real cloud held pre-career):
  // strip career keys in case state.json was pulled by the new CLI.
  const seedState = {
    schema: 1,
    data: Object.fromEntries(LEGACY_STORES.map((t) => [t, realState.data[t] ?? []])),
    settings: realState.settings ?? {},
  }
  const expected = Object.fromEntries(LEGACY_STORES.map((t) => [t, seedState.data[t].length]))
  console.log('• real-data seed:', JSON.stringify(expected))

  token = await deriveAuthToken(PASS)
  if (existsSync(DEV_VARS)) copyFileSync(DEV_VARS, DEV_VARS_BAK)
  writeFileSync(DEV_VARS, `SYNC_TOKEN=${token}\nALLOWED_ORIGINS=${APP_ORIGIN},${WORKER_URL}\n`)

  // --- build OLD (master) in a worktree + NEW (working tree) here ---
  console.log('• building OLD app (git master)…')
  if (existsSync(OLD_TREE)) execSync(`git worktree remove --force ${OLD_TREE}`, { stdio: 'ignore' })
  execSync(`git worktree add ${OLD_TREE} master`, { stdio: 'inherit' })
  execSync(`ln -sfn ${process.cwd()}/node_modules ${OLD_TREE}/node_modules`)
  execSync('npm run build', { cwd: OLD_TREE, stdio: 'inherit' })
  console.log('• building NEW app (working tree)…')
  execSync('npm run build', { stdio: 'inherit' })

  // --- worker + seed ---
  console.log('• starting worker…')
  const worker = spawn('npx', ['wrangler', 'dev', '--ip', '127.0.0.1', '--port', String(WORKER_PORT), '--local'], {
    cwd: 'worker', stdio: ['ignore', 'pipe', 'pipe'], detached: true,
  })
  procs.push(worker)
  await waitFor(async () => (await fetch(`${WORKER_URL}/health`)).ok, { label: 'worker /health' })
  await api('DELETE')
  const salt = b64(randomSalt())
  encKey = await deriveEncKey(PASS, unb64(salt))
  const put = await api('PUT', '/state', { baseVersion: 0, blob: await encryptState(seedState, encKey), salt })
  check('seed PUT returns v1', put.json.version === 1, `got v${put.json.version}`)

  // --- OLD build: connect, real data lands in Dexie v6 ---
  console.log('• OLD build: connecting device…')
  let preview = await startPreview(OLD_TREE)
  const browser = await chromium.launch({ headless: true })
  procs.push({ pid: null, kill: () => browser.close().catch(() => {}) })
  const ctx = await browser.newContext({ serviceWorkers: 'block' })
  await ctx.addInitScript(() => {
    const d = new Date()
    const p = (n) => String(n).padStart(2, '0')
    localStorage.setItem('morning-flow-last-reviewed-date', `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`)
  })
  const page = await ctx.newPage()
  page.on('pageerror', (e) => console.log(`  [pageerror] ${e.message}`))
  await page.goto(`${APP_ORIGIN}${BASE}settings`, { waitUntil: 'networkidle' })
  await page.fill('input[type=url]', WORKER_URL)
  await page.fill('input[type=password]', PASS)
  await page.getByRole('button', { name: 'Conectar' }).click()
  await page.getByText('Sincronizado', { exact: true }).waitFor({ timeout: 20000 })

  const oldInfo = await pageIdbInfo(page)
  check('OLD: Dexie v6 schema', oldInfo.version === 60, `idb version ${oldInfo.version}`)
  check('OLD: 7 stores', oldInfo.names.length === 7, oldInfo.names.join(','))
  check(
    'OLD: real data adopted',
    LEGACY_STORES.every((t) => oldInfo.counts[t] === expected[t]),
    JSON.stringify(oldInfo.counts)
  )

  // --- swap preview to NEW build on the same origin; reload runs v6→v7 ---
  console.log('• swapping to NEW build (v7 migration on real data)…')
  await stop(preview)
  preview = await startPreview('.')
  await page.goto(`${APP_ORIGIN}${BASE}`, { waitUntil: 'networkidle' })
  await sleep(1500) // let Dexie open + any first queries settle

  const newInfo = await pageIdbInfo(page)
  check('NEW: Dexie v7 schema', newInfo.version === 70, `idb version ${newInfo.version}`)
  check('NEW: 14 stores', newInfo.names.length === 14, newInfo.names.join(','))
  check(
    'NEW: legacy data intact after migration',
    LEGACY_STORES.every((t) => newInfo.counts[t] === expected[t]),
    JSON.stringify(newInfo.counts)
  )
  check('NEW: career stores empty', CAREER_STORES.every((t) => newInfo.counts[t] === 0))
  check('NEW: no Carreira tab without career data', (await careerNavLinks(page)) === 0,
    `${await navLinks(page)} nav links`)

  // --- idempotency: a second reload must change nothing ---
  await page.reload({ waitUntil: 'networkidle' })
  await sleep(1000)
  const again = await pageIdbInfo(page)
  check(
    'NEW: reload idempotent',
    again.version === 70 && LEGACY_STORES.every((t) => again.counts[t] === expected[t]),
    JSON.stringify(again.counts)
  )

  // --- push roundtrip: an edit produces a schema-2 snapshot, nothing lost ---
  console.log('• push roundtrip (schema 2)…')
  const versionBefore = (await getCloud()).version
  // Toggle a real practice: first active one of the first category (same
  // check-button structure the phase-4 harness clicks).
  const firstCat = [...seedState.data.categories].sort((a, b) => a.sortOrder - b.sortOrder)[0]
  const target = [...seedState.data.practices]
    .filter((p) => p.categoryId === firstCat.id && !p.isArchived)
    .sort((a, b) => a.sortOrder - b.sortOrder)[0]
  console.log(`  toggling "${target.name}"…`)
  await page.goto(`${APP_ORIGIN}${BASE}`, { waitUntil: 'networkidle' })
  const nameBtn = page.getByRole('button', { name: target.name }).first()
  try {
    await nameBtn.waitFor({ timeout: 10000 })
  } catch (e) {
    const btns = await page.locator('button').allTextContents()
    console.log('  [debug] visible buttons:', JSON.stringify(btns.slice(0, 40)))
    console.log('  [debug] url:', page.url())
    await page.screenshot({ path: '/tmp/e2e-career-push-debug.png', fullPage: true })
    throw e
  }
  await nameBtn.locator('xpath=preceding-sibling::button[1]').click()
  await waitFor(async () => (await getCloud()).version > versionBefore, { tries: 15, label: 'push to land' })
  const cloud = await getCloud()
  check('PUSH: snapshot is schema 2', cloud.state.schema === 2, `schema ${cloud.state.schema}`)
  check('PUSH: career arrays present + empty', CAREER_STORES.every((t) => Array.isArray(cloud.state.data[t]) && cloud.state.data[t].length === 0))
  check(
    'PUSH: legacy counts preserved (± the toggled record)',
    LEGACY_STORES.every((t) => {
      const n = cloud.state.data[t].length
      return t === 'dailyRecords' ? n === expected[t] || n === expected[t] + 1 : n === expected[t]
    }),
    JSON.stringify(Object.fromEntries(LEGACY_STORES.map((t) => [t, cloud.state.data[t].length])))
  )

  // --- gate: a careerPlan row makes the tab appear; removing it hides it ---
  console.log('• career-tab gate…')
  await pagePutCareerPlan(page)
  await page.reload({ waitUntil: 'networkidle' })
  check('GATE: Carreira tab appears with career data', (await careerNavLinks(page)) === 1,
    `${await navLinks(page)} nav links`)
  await page.goto(`${APP_ORIGIN}${BASE}career`, { waitUntil: 'networkidle' })
  check('GATE: career view renders', await page.getByRole('heading', { name: 'Carreira' }).count() === 1)
  await pageDeleteCareerPlan(page)
  await page.reload({ waitUntil: 'networkidle' })
  check('GATE: Carreira tab hidden again', (await careerNavLinks(page)) === 0)

  // --- fresh install: brand-new profile, never any career data ---
  console.log('• fresh-install check…')
  const freshCtx = await browser.newContext({ serviceWorkers: 'block' })
  await freshCtx.addInitScript(() => {
    const d = new Date()
    const p = (n) => String(n).padStart(2, '0')
    localStorage.setItem('morning-flow-last-reviewed-date', `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`)
  })
  const fresh = await freshCtx.newPage()
  await fresh.goto(`${APP_ORIGIN}${BASE}`, { waitUntil: 'networkidle' })
  await sleep(1500) // seed runs
  check('FRESH: 4 nav tabs, no Carreira', (await navLinks(fresh)) === 4 && (await careerNavLinks(fresh)) === 0,
    `${await navLinks(fresh)} links`)
  await fresh.goto(`${APP_ORIGIN}${BASE}career`, { waitUntil: 'networkidle' })
  check('FRESH: direct /career shows empty state', await fresh.getByText('Nenhum dado de carreira').count() === 1)

  await browser.close()
}

main()
  .catch((e) => { console.error('\nFATAL:', e.stack || e.message); check('harness ran to completion', false, e.message) })
  .finally(async () => {
    restoreDevVars()
    for (const p of procs) {
      try {
        if (typeof p.pid === 'number') process.kill(-p.pid, 'SIGTERM')
        else p.kill?.()
      } catch { /* ignore */ }
    }
    try { execSync(`git worktree remove --force ${OLD_TREE}`, { stdio: 'ignore' }) } catch { /* ignore */ }
    const failed = checks.filter((c) => !c.ok)
    console.log(`\n${'='.repeat(48)}\n${checks.length - failed.length}/${checks.length} checks passed`)
    if (failed.length) { console.log('FAILED:'); failed.forEach((c) => console.log(`  ✗ ${c.name} ${c.detail}`)) }
    process.exit(failed.length ? 1 : 0)
  })
