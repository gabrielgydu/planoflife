#!/usr/bin/env node
/**
 * Plano de Vida — sync blob size measurement (read-only, privacy-safe).
 *
 * Pulls the cloud state and reports ONLY byte sizes and counts — never prints
 * any field values, personal content, or the passphrase. Use it to decide
 * whether the image-blob split is worth doing.
 *
 * Config (from .env.local at repo root, or the environment):
 *   SYNC_URL=https://planoflife-sync.<you>.workers.dev
 *   SYNC_PASSPHRASE=your-passphrase
 *
 * Run: node scripts/measure-blob.mjs
 */
import {
  deriveAuthToken,
  deriveEncKey,
  decryptState,
  unb64,
  TABLES,
} from './sync-core.mjs'

try {
  process.loadEnvFile('.env.local')
} catch {
  /* rely on ambient env */
}

const SYNC_URL = process.env.SYNC_URL?.replace(/\/$/, '')
const SYNC_PASSPHRASE = process.env.SYNC_PASSPHRASE

function die(msg) {
  console.error(`✗ ${msg}`)
  process.exit(1)
}
if (!SYNC_URL) die('SYNC_URL not set (put it in .env.local)')
if (!SYNC_PASSPHRASE) die('SYNC_PASSPHRASE not set (add it to .env.local — it never leaves this machine)')

const KB = (n) => `${(n / 1024).toFixed(1)} KB`
const bytes = (s) => Buffer.byteLength(s, 'utf8')

async function main() {
  const token = await deriveAuthToken(SYNC_PASSPHRASE)
  const res = await fetch(`${SYNC_URL}/state`, {
    headers: { Authorization: `Bearer ${token}` },
  })
  if (res.status === 401) die('Unauthorized — passphrase does not match the Worker secret.')
  if (res.status !== 200) die(`GET /state failed (${res.status})`)
  const remote = await res.json() // { version, blob, salt }
  if (!remote.blob) die('Cloud is empty — nothing to measure.')
  if (!remote.salt) die('Cloud has data but no salt — inconsistent.')

  // ---- what's actually transferred over the wire each non-meta poll ----
  const fullResponseBytes = bytes(JSON.stringify(remote))
  const blobBytes = bytes(remote.blob) // base64 string = the bulk of the transfer
  const ciphertextBytes = unb64(remote.blob).byteLength // decoded (iv + ct + tag)

  // ---- decrypt and measure the plaintext snapshot ----
  const key = await deriveEncKey(SYNC_PASSPHRASE, unb64(remote.salt))
  const state = await decryptState(remote.blob, key)
  const plaintextBytes = bytes(JSON.stringify(state))

  // per-table sizes + per-field aggregation (sizes only, no values)
  const perTable = []
  const fieldAgg = new Map() // `${table}.${field}` -> { total, max, nonEmpty, count }
  let imageDataTotal = 0
  let imageDataMax = 0
  let imageDataCount = 0

  for (const t of TABLES) {
    const rows = Array.isArray(state.data?.[t]) ? state.data[t] : []
    const tBytes = bytes(JSON.stringify(rows))
    perTable.push({ table: t, rows: rows.length, bytes: tBytes })
    for (const row of rows) {
      if (!row || typeof row !== 'object') continue
      for (const [k, v] of Object.entries(row)) {
        if (v == null) continue
        const vb = bytes(typeof v === 'string' ? v : JSON.stringify(v))
        const fk = `${t}.${k}`
        const agg = fieldAgg.get(fk) ?? { total: 0, max: 0, nonEmpty: 0 }
        agg.total += vb
        agg.max = Math.max(agg.max, vb)
        agg.nonEmpty += vb > 0 ? 1 : 0
        fieldAgg.set(fk, agg)
        if (k === 'imageData' && typeof v === 'string' && v.length) {
          imageDataTotal += vb
          imageDataMax = Math.max(imageDataMax, vb)
          imageDataCount += 1
        }
      }
    }
  }
  const settingsBytes = bytes(JSON.stringify(state.settings ?? {}))

  // ---- report ----
  console.log(`\ncloud version: ${remote.version}`)
  console.log(`\n== WIRE (what each non-meta poll downloads) ==`)
  console.log(`  full GET /state response: ${KB(fullResponseBytes)} (${fullResponseBytes} B)`)
  console.log(`  encrypted blob (base64):  ${KB(blobBytes)} (${blobBytes} B)  <- the part ?meta=1 avoids`)
  console.log(`  ciphertext (decoded):     ${KB(ciphertextBytes)}`)

  console.log(`\n== PLAINTEXT SNAPSHOT (decrypted, in memory only) ==`)
  console.log(`  total JSON: ${KB(plaintextBytes)} (${plaintextBytes} B)`)
  console.log(`  settings:   ${KB(settingsBytes)}`)
  console.log(`  per table:`)
  for (const r of perTable.sort((a, b) => b.bytes - a.bytes)) {
    const pct = ((r.bytes / plaintextBytes) * 100).toFixed(1)
    console.log(`    ${r.table.padEnd(16)} ${String(r.rows).padStart(5)} rows  ${KB(r.bytes).padStart(10)}  ${pct.padStart(5)}%`)
  }

  console.log(`\n== IMAGES (practice.imageData) ==`)
  if (imageDataCount === 0) {
    console.log(`  none stored — image-blob split would save nothing.`)
  } else {
    const pct = ((imageDataTotal / plaintextBytes) * 100).toFixed(1)
    console.log(`  practices with an image: ${imageDataCount}`)
    console.log(`  total image bytes:       ${KB(imageDataTotal)} (${pct}% of the whole snapshot)`)
    console.log(`  largest single image:    ${KB(imageDataMax)}`)
    console.log(`  blob WITHOUT images would be ~${KB(plaintextBytes - imageDataTotal)} plaintext.`)
  }

  console.log(`\n== TOP 12 FIELDS BY TOTAL SIZE (keys + sizes only, no values) ==`)
  const top = [...fieldAgg.entries()].sort((a, b) => b[1].total - a[1].total).slice(0, 12)
  for (const [fk, agg] of top) {
    const pct = ((agg.total / plaintextBytes) * 100).toFixed(1)
    console.log(`  ${fk.padEnd(28)} total ${KB(agg.total).padStart(10)} (${pct.padStart(5)}%)  max ${KB(agg.max).padStart(9)}  n=${agg.nonEmpty}`)
  }

  console.log(`\n== POLL BANDWIDTH (rough) ==`)
  const perPoll = blobBytes
  console.log(`  At 60s polling while the app is open/visible: ${KB(perPoll)} per idle poll.`)
  console.log(`  1h of an open idle tab = ${KB(perPoll * 60)}; ?meta=1 cuts each idle poll to a few hundred bytes.`)
  console.log('')
}

main().catch((e) => die(e.message))
