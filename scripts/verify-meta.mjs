#!/usr/bin/env node
/**
 * Verify the deployed Worker honors GET /state?meta=1 (cheap version probe:
 * { version, blob: null, salt }) vs a full GET (returns the blob). Prints only
 * sizes + the boolean contract checks — never any decrypted data.
 */
import { deriveAuthToken } from './sync-core.mjs'

try { process.loadEnvFile('.env.local') } catch { /* ambient env */ }
const SYNC_URL = process.env.SYNC_URL?.replace(/\/$/, '')
const PASS = process.env.SYNC_PASSPHRASE
if (!SYNC_URL || !PASS) { console.error('✗ need SYNC_URL + SYNC_PASSPHRASE in .env.local'); process.exit(1) }

const KB = (n) => `${(n / 1024).toFixed(1)} KB`
const token = await deriveAuthToken(PASS)
const headers = { Authorization: `Bearer ${token}` }

const metaRes = await fetch(`${SYNC_URL}/state?meta=1`, { headers })
const metaText = await metaRes.text()
const meta = JSON.parse(metaText)

const fullRes = await fetch(`${SYNC_URL}/state`, { headers })
const fullText = await fullRes.text()
const full = JSON.parse(fullText)

const checks = {
  'meta HTTP 200': metaRes.status === 200,
  'meta blob is null': meta.blob === null,
  'meta has version': typeof meta.version === 'number',
  'meta has salt': typeof meta.salt === 'string' && meta.salt.length > 0,
  'full GET returns blob': typeof full.blob === 'string' && full.blob.length > 1000,
  'versions match': meta.version === full.version,
}
console.log(`\nmeta response:  ${metaText.length} B  -> ${KB(metaText.length)}`)
console.log(`full response:  ${fullText.length} B  -> ${KB(fullText.length)}`)
const saved = fullText.length - metaText.length
console.log(`saved per idle poll: ${KB(saved)}  (${((saved / fullText.length) * 100).toFixed(1)}% smaller)\n`)
let ok = true
for (const [k, v] of Object.entries(checks)) { console.log(`  ${v ? '✓' : '✗'} ${k}`); ok = ok && v }
console.log(ok ? '\n✅ ?meta=1 is live and correct.\n' : '\n❌ contract check failed.\n')
process.exit(ok ? 0 : 1)
