#!/usr/bin/env node
/**
 * Career publish bridge: plan.publish.json (written by career Claude sessions
 * next to STATE.md) → the app's encrypted sync store.
 *
 * The script is deliberately dumb and deterministic — semantic extraction from
 * the markdown is the career session's job; this just moves structured rows.
 *
 * Flow (stateless — never touches .sync/state.json):
 *   1. GET + decrypt the cloud snapshot (refuses an empty cloud without
 *      --allow-empty-cloud, so a typo'd URL can't seed garbage).
 *   2. Replace the publisher-owned career tables from the input:
 *        careerPlan, careerDeadlines, careerWins, careerLog  — replaced wholesale
 *        careerMoves — replaced, but a row the app marked done stays done while
 *                      the input still says pending (the session reconciles by
 *                      dropping finished moves from the input)
 *        careerLadder — content (rung/title/description) comes from the input;
 *                      status + notes belong to the app and are preserved;
 *                      rows the input doesn't know are left alone
 *        habits (optional) — SEED-ONLY: inserts the career category + practices
 *                      (domain 'career') once by fixed id; after that the app
 *                      owns them (never updated or deleted by a publish)
 *      careerOutreach, dailyRecords, all other legacy tables and settings are
 *      never touched.
 *      Rows identical to the cloud keep their updatedAt (no merge churn).
 *   3. PUT back with the pulled baseVersion; on a 409 (a device pushed during
 *      the cycle) pull + retry once.
 *   4. Write .last-publish.json next to the input (read by the career project's
 *      SessionStart drift guard).
 *
 * Usage:
 *   node scripts/career-publish.mjs [--input <plan.publish.json>] [--dry-run]
 *                                   [--allow-empty-cloud]
 * Config: SYNC_URL + SYNC_PASSPHRASE from the environment or ./.env.local.
 * Default input: ~/notes/morningpages/career/plan.publish.json
 */
import { readFileSync, writeFileSync, existsSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { homedir } from 'node:os'
import {
  deriveAuthToken,
  deriveEncKey,
  encryptState,
  decryptState,
  normalizeSyncState,
  validateSyncState,
  randomSalt,
  b64,
  unb64,
} from './sync-core.mjs'

const DEFAULT_INPUT = join(homedir(), 'notes/morningpages/career/plan.publish.json')

try {
  process.loadEnvFile('.env.local')
} catch {
  /* no .env.local — rely on the ambient environment */
}
const SYNC_URL = process.env.SYNC_URL?.replace(/\/$/, '')
const SYNC_PASSPHRASE = process.env.SYNC_PASSPHRASE

const args = process.argv.slice(2)
const DRY_RUN = args.includes('--dry-run')
const ALLOW_EMPTY = args.includes('--allow-empty-cloud')
const inputIdx = args.indexOf('--input')
const INPUT_FILE = resolve(inputIdx !== -1 ? args[inputIdx + 1] : DEFAULT_INPUT)

function die(msg) {
  console.error(`✗ ${msg}`)
  process.exit(1)
}

// --- input validation (strict: this file is LLM-written) -----------------------

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/
const isStr = (v) => typeof v === 'string' && v.length > 0
const optStr = (v) => v === undefined || typeof v === 'string'

function fail(path, why) {
  die(`invalid ${INPUT_FILE}: ${path} ${why}`)
}

function checkIds(rows, path) {
  const seen = new Set()
  for (const r of rows) {
    if (!isStr(r.id)) fail(`${path}[].id`, 'must be a non-empty string')
    if (seen.has(r.id)) fail(`${path}`, `duplicate id "${r.id}"`)
    seen.add(r.id)
  }
}

function validateInput(input) {
  if (!input || typeof input !== 'object') fail('root', 'must be an object')
  const { plan, moves, deadlines, wins, log, ladder } = input

  if (!plan || typeof plan !== 'object') fail('plan', 'missing')
  if (!isStr(plan.currentPhase)) fail('plan.currentPhase', 'must be a non-empty string')
  if (!isStr(plan.focusLine)) fail('plan.focusLine', 'must be a non-empty string')
  if (!Array.isArray(plan.phases) || plan.phases.length === 0) fail('plan.phases', 'must be a non-empty array')
  for (const p of plan.phases) {
    if (!isStr(p.name) || !isStr(p.timeframe) || !isStr(p.summary)) fail('plan.phases[]', 'needs name/timeframe/summary')
    if (!['done', 'active', 'upcoming'].includes(p.status)) fail('plan.phases[].status', 'must be done|active|upcoming')
  }

  for (const [key, rows] of [['moves', moves], ['deadlines', deadlines], ['wins', wins], ['log', log], ['ladder', ladder]]) {
    if (!Array.isArray(rows)) fail(key, 'must be an array')
    checkIds(rows, key)
  }
  for (const m of moves) {
    if (!isStr(m.title)) fail('moves[].title', 'must be a non-empty string')
    if (typeof m.sortOrder !== 'number') fail('moves[].sortOrder', 'must be a number')
    if (!optStr(m.detail) || !optStr(m.gate)) fail('moves[]', 'detail/gate must be strings when present')
    if (m.status !== undefined && !['pending', 'done'].includes(m.status)) fail('moves[].status', 'must be pending|done')
  }
  for (const d of deadlines) {
    if (!DATE_RE.test(d.date ?? '')) fail('deadlines[].date', 'must be YYYY-MM-DD')
    if (!isStr(d.label)) fail('deadlines[].label', 'must be a non-empty string')
  }
  for (const w of wins) {
    if (!DATE_RE.test(w.date ?? '')) fail('wins[].date', 'must be YYYY-MM-DD')
    if (!isStr(w.text)) fail('wins[].text', 'must be a non-empty string')
  }
  for (const l of log) {
    if (!DATE_RE.test(l.date ?? '')) fail('log[].date', 'must be YYYY-MM-DD')
    if (!isStr(l.title) || !isStr(l.summary)) fail('log[]', 'needs title + summary')
  }
  for (const r of ladder) {
    if (!Number.isInteger(r.rung) || r.rung < 1 || r.rung > 5) fail('ladder[].rung', 'must be an integer 1–5')
    if (!isStr(r.title) || !isStr(r.description)) fail('ladder[]', 'needs title + description')
    if (r.status !== undefined && !['pending', 'in-progress', 'done'].includes(r.status)) {
      fail('ladder[].status', 'must be pending|in-progress|done')
    }
    if (!optStr(r.notes)) fail('ladder[].notes', 'must be a string when present')
  }

  if (input.habits !== undefined) {
    const h = input.habits
    if (!h || typeof h !== 'object') fail('habits', 'must be an object')
    if (!isStr(h.categoryName)) fail('habits.categoryName', 'must be a non-empty string')
    if (!Array.isArray(h.practices) || h.practices.length === 0) fail('habits.practices', 'must be a non-empty array')
    checkIds(h.practices, 'habits.practices')
    for (const p of h.practices) {
      if (!isStr(p.name)) fail('habits.practices[].name', 'must be a non-empty string')
      if (!optStr(p.content)) fail('habits.practices[].content', 'must be a string when present')
      if (
        p.scheduleDays !== undefined &&
        (!Array.isArray(p.scheduleDays) || p.scheduleDays.some((d) => !Number.isInteger(d) || d < 0 || d > 6))
      ) {
        fail('habits.practices[].scheduleDays', 'must be an array of weekdays 0–6')
      }
    }
  }
}

// --- transform ------------------------------------------------------------------

/** Stable content fingerprint (ignores updatedAt) so unchanged rows keep theirs. */
const fingerprint = (row) => {
  const { updatedAt: _drop, ...rest } = row
  return JSON.stringify(rest, Object.keys(rest).sort())
}

/** Take `next` but keep prev's updatedAt when nothing else changed. */
function stamped(next, prev, now) {
  if (prev && fingerprint({ ...prev }) === fingerprint(next)) return prev
  return { ...next, updatedAt: now }
}

function transform(state, input, now) {
  const prevById = (rows) => new Map(rows.map((r) => [r.id, r]))
  const data = { ...state.data }

  // publishedAt = "the bridge last ran", even when nothing changed — that is what
  // the in-app drift warning measures. Single-writer row, so always stamping is safe.
  data.careerPlan = [
    {
      id: 'career-plan',
      currentPhase: input.plan.currentPhase,
      focusLine: input.plan.focusLine,
      phases: input.plan.phases,
      publishedAt: now,
      updatedAt: now,
    },
  ]

  const prevMoves = prevById(data.careerMoves)
  data.careerMoves = input.moves.map((m) => {
    const prev = prevMoves.get(m.id)
    const status =
      prev?.status === 'done' && (m.status ?? 'pending') === 'pending'
        ? 'done' // the app checked it off; markdown hasn't caught up yet
        : (m.status ?? 'pending')
    return stamped(
      {
        id: m.id,
        title: m.title,
        detail: m.detail ?? '',
        gate: m.gate ?? '',
        sortOrder: m.sortOrder,
        status,
      },
      prev,
      now
    )
  })

  const prevDl = prevById(data.careerDeadlines)
  data.careerDeadlines = input.deadlines.map((d) =>
    stamped({ id: d.id, date: d.date, label: d.label }, prevDl.get(d.id), now)
  )

  const prevWins = prevById(data.careerWins)
  data.careerWins = input.wins.map((w) =>
    stamped({ id: w.id, date: w.date, text: w.text }, prevWins.get(w.id), now)
  )

  const prevLog = prevById(data.careerLog)
  data.careerLog = input.log.map((l) =>
    stamped({ id: l.id, date: l.date, title: l.title, summary: l.summary }, prevLog.get(l.id), now)
  )

  // Habits: SEED-ONLY into the regular categories/practices tables. A category /
  // practice is inserted once (by fixed id) with domain 'career'; after that the
  // app owns the rows — renames, schedule edits, archives are never overwritten,
  // and rows are never deleted by a publish. dailyRecords are untouched.
  if (input.habits) {
    const h = input.habits
    const CAT_ID = 'career-cat'
    if (!data.categories.some((c) => c.id === CAT_ID)) {
      const maxSort = Math.max(-1, ...data.categories.map((c) => c.sortOrder))
      data.categories = [
        ...data.categories,
        {
          id: CAT_ID,
          name: h.categoryName,
          sortOrder: maxSort + 1,
          emoji: h.categoryIcon ?? 'Briefcase',
          createdAt: now,
          updatedAt: now,
        },
      ]
    }
    const existingPracticeIds = new Set(data.practices.map((p) => p.id))
    let nextSort =
      Math.max(-1, ...data.practices.filter((p) => p.categoryId === CAT_ID).map((p) => p.sortOrder)) + 1
    const seeded = []
    for (const p of h.practices) {
      if (existingPracticeIds.has(p.id)) continue
      seeded.push({
        id: p.id,
        name: p.name,
        categoryId: CAT_ID,
        content: p.content ?? '',
        imageData: null,
        domain: 'career',
        ...(p.scheduleDays?.length ? { scheduleDays: [...p.scheduleDays].sort((a, b) => a - b) } : {}),
        isRequired: false,
        sortOrder: nextSort++,
        isArchived: false,
        createdAt: now,
        updatedAt: now,
      })
    }
    if (seeded.length) data.practices = [...data.practices, ...seeded]
  }

  // Ladder: input owns rung/title/description; the app owns status/notes.
  const ladderById = prevById(data.careerLadder)
  for (const r of input.ladder) {
    const prev = ladderById.get(r.id)
    ladderById.set(
      r.id,
      stamped(
        {
          id: r.id,
          rung: r.rung,
          title: r.title,
          description: r.description,
          status: prev?.status ?? r.status ?? 'pending',
          notes: prev?.notes ?? r.notes ?? '',
        },
        prev,
        now
      )
    )
  }
  data.careerLadder = [...ladderById.values()].sort((a, b) => a.rung - b.rung)

  return { ...state, data }
}

// --- sync I/O --------------------------------------------------------------------

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

const summarizeCareer = (state) =>
  ['careerPlan', 'careerMoves', 'careerDeadlines', 'careerOutreach', 'careerLadder', 'careerWins', 'careerLog']
    .map((t) => `${t.replace('career', '').toLowerCase()}=${state.data[t].length}`)
    .join(' ')

async function publishOnce(input, now) {
  const remote = (await api('GET')).json
  let state
  let salt = remote.salt
  if (!remote.blob) {
    if (!ALLOW_EMPTY) {
      die('Cloud is empty. Refusing to seed from a publish (use --allow-empty-cloud if intended).')
    }
    salt = salt ?? b64(randomSalt())
    state = normalizeSyncState({ schema: 2, data: {}, settings: {} })
    for (const k of ['categories', 'practices', 'dailyRecords', 'missedReasons', 'examenEntries', 'guidingQuestions', 'propositos']) {
      state.data[k] = []
    }
  } else {
    const key = await deriveEncKey(SYNC_PASSPHRASE, unb64(salt))
    state = normalizeSyncState(await decryptState(remote.blob, key))
  }

  const next = transform(state, input, now)
  validateSyncState(next)

  if (DRY_RUN) {
    console.log(`dry-run against cloud v${remote.version}:`)
    console.log(`  before: ${summarizeCareer(state)}`)
    console.log(`  after:  ${summarizeCareer(next)}`)
    return { done: true, version: remote.version }
  }

  const key = await deriveEncKey(SYNC_PASSPHRASE, unb64(salt))
  const blob = await encryptState(next, key)
  const { status, json } = await api('PUT', { baseVersion: remote.version, blob, salt })
  if (status === 409) return { done: false }
  if (status !== 200) die(`PUT /state failed (${status}): ${JSON.stringify(json)}`)
  console.log(`✓ published -> cloud v${json.version}`)
  console.log(`  ${summarizeCareer(next)}`)
  return { done: true, version: json.version }
}

async function main() {
  if (!SYNC_URL) die('SYNC_URL not set (env or .env.local)')
  if (!SYNC_PASSPHRASE) die('SYNC_PASSPHRASE not set (env or .env.local)')
  if (!existsSync(INPUT_FILE)) die(`input not found: ${INPUT_FILE}`)

  let input
  try {
    input = JSON.parse(readFileSync(INPUT_FILE, 'utf8'))
  } catch (e) {
    die(`input is not valid JSON: ${e.message}`)
  }
  validateInput(input)

  const now = new Date().toISOString()
  let result = await publishOnce(input, now)
  if (!result.done) {
    console.log('  conflict (a device pushed mid-publish) — pulling fresh and retrying once…')
    result = await publishOnce(input, now)
    if (!result.done) die('still conflicting after retry — try again in a minute.')
  }

  if (!DRY_RUN) {
    const marker = join(dirname(INPUT_FILE), '.last-publish.json')
    writeFileSync(marker, JSON.stringify({ publishedAt: now, cloudVersion: result.version, input: INPUT_FILE }, null, 2) + '\n')
    console.log(`  marker -> ${marker}`)
  }
}

main().catch((e) => die(e.stack || e.message))
