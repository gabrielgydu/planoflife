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
  await freshCtx.close()

  // --- publish bridge: career-publish.mjs → cloud → device pull → Now panel ---
  console.log('• publish bridge…')
  const publishInput = '/tmp/plife-e2e-publish-input.json'
  const publishMarker = '/tmp/.last-publish.json'
  rmSync(publishMarker, { force: true }) // a stale marker would make its check vacuous
  copyFileSync('scripts/fixtures/career-plan-fixture.json', publishInput)
  const publishEnv = { ...process.env, SYNC_URL: WORKER_URL, SYNC_PASSPHRASE: PASS }
  const runPublish = (extra = '') =>
    execSync(`node ${process.cwd()}/scripts/career-publish.mjs --input ${publishInput} ${extra}`, {
      cwd: '/tmp', env: publishEnv, encoding: 'utf8',
    })
  const out1 = runPublish()
  console.log(out1.trim().split('\n').map((l) => `  ${l}`).join('\n'))
  const afterPublish = await getCloud()
  check(
    'PUBLISH: career tables landed in cloud',
    afterPublish.state.data.careerPlan.length === 1 &&
      afterPublish.state.data.careerMoves.length === 2 &&
      afterPublish.state.data.careerDeadlines.length === 1 &&
      afterPublish.state.data.careerWins.length === 1 &&
      afterPublish.state.data.careerLog.length === 1 &&
      afterPublish.state.data.careerLadder.length === 2
  )
  // The habit seed legitimately adds 1 category + 2 practices; everything else
  // in the legacy tables must be untouched by a publish.
  const legacyAsExpected = (s) =>
    LEGACY_STORES.every((t) => {
      const n = s.data[t].length
      if (t === 'practices') return n === cloud.state.data.practices.length + 2
      if (t === 'categories') return n === cloud.state.data.categories.length + 1
      return n === cloud.state.data[t].length
    })
  check('PUBLISH: legacy tables untouched (except habit seed)', legacyAsExpected(afterPublish.state))
  const marker1 = existsSync(publishMarker) ? JSON.parse(readFileSync(publishMarker, 'utf8')) : null
  check(
    'PUBLISH: marker written with matching version + seeded ids',
    marker1?.cloudVersion === afterPublish.version &&
      Array.isArray(marker1?.seededHabitIds) &&
      marker1.seededHabitIds.includes('career-prac-winlog')
  )

  // Device pulls on reload → tab appears, Now panel renders the published plan.
  await page.goto(`${APP_ORIGIN}${BASE}`, { waitUntil: 'networkidle' })
  await waitFor(async () => (await careerNavLinks(page)) === 1, { tries: 20, label: 'Carreira tab after pull' })
  check('PUBLISH: Carreira tab appeared after pull', true)
  await page.goto(`${APP_ORIGIN}${BASE}career`, { waitUntil: 'networkidle' })
  check('PUBLISH: phase badge renders', await page.getByText('Phase 1 — Test').count() === 1)
  check('PUBLISH: next move renders', await page.getByText('Move Alpha').count() === 1)
  check('PUBLISH: deadline countdown renders', await page.getByText('Far deadline').count() === 1)

  // In-app move check-off pushes back to the cloud.
  console.log('• in-app move check-off…')
  const vBeforeCheck = (await getCloud()).version
  await page.getByRole('button', { name: 'Concluir Move Alpha' }).click()
  await waitFor(async () => (await getCloud()).version > vBeforeCheck, { tries: 15, label: 'move check push' })
  const afterCheck = await getCloud()
  check(
    'MOVE: done status reached cloud',
    afterCheck.state.data.careerMoves.find((m) => m.id === 'move-a')?.status === 'done'
  )

  // Re-publish with the same (pending) input: the app's done check-off must survive.
  const out2 = runPublish()
  console.log(out2.trim().split('\n').map((l) => `  ${l}`).join('\n'))
  const afterRepublish = await getCloud()
  check(
    'REPUBLISH: app done-status preserved over pending input',
    afterRepublish.state.data.careerMoves.find((m) => m.id === 'move-a')?.status === 'done'
  )
  check(
    'REPUBLISH: publishedAt bumped',
    afterRepublish.state.data.careerPlan[0].publishedAt > afterPublish.state.data.careerPlan[0].publishedAt
  )
  // No-churn: an unchanged row must keep its exact updatedAt across a republish,
  // or offline device edits would lose later LWW merges they should win.
  check(
    'REPUBLISH: unchanged deadline keeps its updatedAt',
    afterRepublish.state.data.careerDeadlines.find((d) => d.id === 'dl-a')?.updatedAt ===
      afterPublish.state.data.careerDeadlines.find((d) => d.id === 'dl-a')?.updatedAt
  )

  // Conflict: the device (not yet pulled past the re-publish) checks move-b →
  // its push 409s → per-record merge → both the publish and the edit survive.
  console.log('• publish-vs-edit conflict…')
  await page.getByRole('button', { name: 'Concluir Move Beta' }).click()
  await sleep(6000) // push → 409 → merge → re-push
  const final2 = await getCloud()
  check(
    'CONFLICT: app edit survived (move-b done)',
    final2.state.data.careerMoves.find((m) => m.id === 'move-b')?.status === 'done'
  )
  check(
    'CONFLICT: publish content survived (win + republished plan)',
    final2.state.data.careerWins.length === 1 &&
      final2.state.data.careerPlan[0].publishedAt === afterRepublish.state.data.careerPlan[0].publishedAt
  )
  check('CONFLICT: legacy data intact at the end', legacyAsExpected(final2.state))

  // --- Phase 2: seeded habits, chain, schedule-aware history ---
  console.log('• habit seed (publish) …')
  const careerPracs = (s) => s.data.practices.filter((p) => p.domain === 'career')
  check(
    'HABITS: seeded once with schedules',
    careerPracs(final2.state).length === 2 &&
      careerPracs(final2.state).every((p) => p.categoryId === 'career-cat' && p.domain === 'career') &&
      JSON.stringify(careerPracs(final2.state).find((p) => p.id === 'career-prac-ship')?.scheduleDays) === '[6]' &&
      final2.state.data.categories.some((c) => c.id === 'career-cat' && c.name === 'Carreira')
  )
  runPublish()
  const afterThird = await getCloud()
  check(
    'HABITS: re-publish is seed-only (no dupes)',
    careerPracs(afterThird.state).length === 2 &&
      afterThird.state.data.categories.filter((c) => c.id === 'career-cat').length === 1
  )

  // Device pulls → daily list shows the career category; History gets the
  // three-way toggle; checking a habit today starts the chain.
  await page.goto(`${APP_ORIGIN}${BASE}`, { waitUntil: 'networkidle' })
  await waitFor(
    async () => (await page.getByText('Carreira', { exact: true }).count()) >= 1,
    { tries: 20, label: 'career category in daily view' }
  )
  check('HABITS: career category in daily list', true)
  // Check off the habit scheduled TODAY (win log Mon–Fri, ship Sat) so the chain
  // counts it; on a Sunday nothing is scheduled and the chain must stay 0.
  const todayDow = new Date().getDay()
  const habitName = todayDow === 6 ? 'Saturday ship fixture' : 'Win log fixture'
  const expectChain = todayDow === 0 ? 0 : 1
  const habitBtn = page.getByRole('button', { name: habitName }).first()
  await habitBtn.waitFor({ timeout: 10000 })
  const vBeforeHabit = (await getCloud()).version
  await habitBtn.locator('xpath=preceding-sibling::button[1]').click()
  // Wait for the record to land in the cloud BEFORE navigating — navigating
  // immediately can abort the in-flight IndexedDB write, and this doubles as the
  // habit-record sync assertion.
  await waitFor(async () => (await getCloud()).version > vBeforeHabit, { tries: 15, label: 'habit check push' })
  const habitCloud = await getCloud()
  const habitPracId = habitName === 'Saturday ship fixture' ? 'career-prac-ship' : 'career-prac-winlog'
  check(
    'HABITS: dailyRecord synced for the checked habit',
    habitCloud.state.data.dailyRecords.some((r) => r.practiceId === habitPracId && r.isCompleted)
  )
  await page.goto(`${APP_ORIGIN}${BASE}career`, { waitUntil: 'networkidle' })
  await page.getByText('Cadeia').waitFor({ timeout: 10000 })
  const chainText = await page
    .locator('section', { has: page.getByText('Cadeia') })
    .first()
    .innerText()
  check(
    `CHAIN: shows ${expectChain} day(s) after first check`,
    chainText.includes(`${expectChain} dia`),
    chainText.split('\n').slice(0, 3).join(' | ')
  )
  await page.goto(`${APP_ORIGIN}${BASE}history`, { waitUntil: 'networkidle' })
  check(
    'HISTORY: three-way domain toggle',
    (await page.getByRole('button', { name: 'Carreira', exact: true }).count()) === 1 &&
      (await page.getByRole('button', { name: 'Espiritual', exact: true }).count()) === 1
  )

  // --- Phase 3: outreach + ladder trackers ---
  console.log('• outreach tracker…')
  await page.goto(`${APP_ORIGIN}${BASE}career`, { waitUntil: 'networkidle' })
  const vBeforeOutreach = (await getCloud()).version
  await page.getByRole('button', { name: 'Registrar' }).click()
  await page.getByPlaceholder('ex.: empresa — eng lead').fill('Acme Corp — CTO')
  await page.getByPlaceholder('ex.: $100/h').fill('$100/h')
  await page.getByRole('button', { name: 'Salvar' }).click()
  await waitFor(async () => (await getCloud()).version > vBeforeOutreach, { tries: 15, label: 'outreach push' })
  const afterOutreach = await getCloud()
  check(
    'OUTREACH: attempt synced to cloud',
    afterOutreach.state.data.careerOutreach.length === 1 &&
      afterOutreach.state.data.careerOutreach[0].target === 'Acme Corp — CTO' &&
      afterOutreach.state.data.careerOutreach[0].rateQuoted === '$100/h'
  )
  check('OUTREACH: row renders', (await page.getByText('Acme Corp — CTO').count()) === 1)
  check('OUTREACH: progress shows 1/20', (await page.getByText('1/20 tentativas').count()) === 1)

  console.log('• ladder tracker…')
  const vBeforeRung = (await getCloud()).version
  await page.getByRole('button', { name: 'Degrau 1: Rung One' }).click()
  await page.getByRole('button', { name: 'Feito', exact: true }).click()
  await page.getByRole('button', { name: 'Salvar' }).click()
  await waitFor(async () => (await getCloud()).version > vBeforeRung, { tries: 15, label: 'rung push' })
  const afterRung = await getCloud()
  check(
    'LADDER: rung-1 done in cloud',
    afterRung.state.data.careerLadder.find((r) => r.id === 'rung-1')?.status === 'done'
  )

  // A publish must never clobber app-owned tracker state.
  runPublish()
  const afterFourth = await getCloud()
  check(
    'TRACKERS: publish preserves outreach + rung status',
    afterFourth.state.data.careerOutreach.length === 1 &&
      afterFourth.state.data.careerLadder.find((r) => r.id === 'rung-1')?.status === 'done'
  )

  // --- Phase 4: roadmap + wins + log feed render ---
  console.log('• roadmap + feed…')
  await page.goto(`${APP_ORIGIN}${BASE}career`, { waitUntil: 'networkidle' })
  check(
    'FEED: roadmap timeline renders the phases',
    (await page.getByText('Roteiro').count()) === 1 &&
      (await page.getByText('first phase').count()) === 1 &&
      (await page.getByText('second phase').count()) === 1
  )
  check('FEED: wins feed renders', (await page.getByText('Test win').count()) === 1)
  check(
    'FEED: log timeline renders',
    (await page.getByText('Diário do plano').count()) === 1 &&
      (await page.getByText('Log A').count()) === 1
  )

  // --- old-client strip → no-launder publish → device preserve + repair push ---
  // Simulates a stale schema-1 PWA pushing a snapshot without career keys while
  // career data exists, then verifies the two mitigations: (a) a publish on that
  // cloud must NOT synthesize an authoritative empty careerOutreach, and (b) a
  // device that pulls the stripped/career-less-outreach snapshot preserves its
  // local rows AND pushes them back on its own.
  console.log('• old-client strip → preserve → repair…')
  await page.goto('about:blank') // park the device so it can't pull mid-setup
  const beforeStrip = await getCloud()
  const cloudSalt = (await api('GET')).json.salt
  const stripped = {
    schema: 1,
    data: Object.fromEntries(LEGACY_STORES.map((t) => [t, beforeStrip.state.data[t]])),
    settings: beforeStrip.state.settings ?? {},
  }
  const stripPut = await api('PUT', '/state', {
    baseVersion: beforeStrip.version,
    blob: await encryptState(stripped, encKey),
    salt: cloudSalt,
  })
  check('STRIP: simulated old-client push accepted', stripPut.status === 200)

  runPublish()
  const afterStripPublish = await getCloud()
  check(
    'LAUNDER: publish on a stripped cloud leaves app-state tables ABSENT (no opinion), not []',
    !('careerOutreach' in afterStripPublish.state.data) &&
      !('careerMoves' in afterStripPublish.state.data) &&
      !('careerLadder' in afterStripPublish.state.data) &&
      afterStripPublish.state.data.careerPlan.length === 1 &&
      afterStripPublish.state.data.careerWins.length === 1
  )

  await page.goto(`${APP_ORIGIN}${BASE}career`, { waitUntil: 'networkidle' })
  await waitFor(
    async () => {
      const c = await getCloud()
      return (c.state.data.careerOutreach ?? []).some((a) => a.target === 'Acme Corp — CTO')
    },
    { tries: 20, label: 'repair push restoring careerOutreach' }
  )
  const repaired = await getCloud()
  check('REPAIR: device preserved + pushed outreach back after pull', true)
  // The right baseline is the pre-strip cloud: every table must round-trip the
  // strip cycle unchanged (legacy counts AND app-owned career state).
  check(
    'REPAIR: nothing else lost through the strip cycle',
    LEGACY_STORES.every(
      (t) => repaired.state.data[t].length === beforeStrip.state.data[t].length
    ) &&
      repaired.state.data.careerLadder.find((r) => r.id === 'rung-1')?.status === 'done' &&
      repaired.state.data.careerMoves.find((m) => m.id === 'move-a')?.status === 'done'
  )

  // After the devices repaired the cloud, a republish reconciles full ownership:
  // input content lands, app-owned statuses survive.
  runPublish()
  const reconciled = await getCloud()
  check(
    'RECONCILE: republish after repair keeps app-owned statuses',
    reconciled.state.data.careerMoves.find((m) => m.id === 'move-a')?.status === 'done' &&
      reconciled.state.data.careerLadder.find((r) => r.id === 'rung-1')?.status === 'done' &&
      reconciled.state.data.careerOutreach.length === 1
  )

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
