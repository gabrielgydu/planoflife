#!/usr/bin/env node
// Harvest the pt-BR daily-liturgy API (liturgia.up.railway.app) to disk.
// Plain Node ESM, zero deps, global fetch (node >= 18). See LITURGY_PLAN.md (P0).
//
// Usage:
//   node scripts/liturgy/harvest.mjs                          full pipeline: detect boundaries, harvest, summarize
//   node scripts/liturgy/harvest.mjs --detect-boundaries       only (re)detect + save boundaries, no fetching
//   node scripts/liturgy/harvest.mjs --start=2024-01-01 --end=2024-12-31   harvest a specific chunk (resumable)
//   node scripts/liturgy/harvest.mjs --summary-only            skip fetching, rebuild _summary.json from cache dir
//   node scripts/liturgy/harvest.mjs --force                   re-fetch dates even if already cached
//
// Flags: --concurrency=N (default 4), --spacing=MS (default 150)

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CACHE_DIR = path.join(__dirname, '.cache', 'api');
const BOUNDARIES_FILE = path.join(CACHE_DIR, '_boundaries.json');
const SUMMARY_FILE = path.join(CACHE_DIR, '_summary.json');
const BASE_URL = 'https://liturgia.up.railway.app/v2';

const KNOWN_TOP = new Set(['data', 'liturgia', 'cor', 'oracoes', 'leituras', 'antifonas']);
const KNOWN_ORACOES = new Set(['coleta', 'oferendas', 'comunhao', 'extras']);
const KNOWN_LEITURAS = new Set(['primeiraLeitura', 'salmo', 'segundaLeitura', 'evangelho', 'extras']);
const KNOWN_ANTIFONAS = new Set(['entrada', 'comunhao']);

// ---------- CLI args ----------

function parseArgs(argv) {
  const out = {};
  for (const a of argv) {
    if (!a.startsWith('--')) continue;
    const [k, v] = a.slice(2).split('=');
    out[k] = v === undefined ? true : v;
  }
  return out;
}

const args = parseArgs(process.argv.slice(2));
const CONCURRENCY = args.concurrency ? Number(args.concurrency) : 4;
const SPACING_MS = args.spacing ? Number(args.spacing) : 150;
const FORCE = !!args.force;

// ---------- date helpers (all UTC, date-only) ----------

function formatParts(date) {
  const d = String(date.getUTCDate()).padStart(2, '0');
  const m = String(date.getUTCMonth() + 1).padStart(2, '0');
  const y = String(date.getUTCFullYear());
  return { d, m, y };
}

function toISO(date) {
  const { d, m, y } = formatParts(date);
  return `${y}-${m}-${d}`;
}

function parseISO(s) {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

function addDays(date, n) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate() + n));
}

function diffDays(a, b) {
  return Math.round((b.getTime() - a.getTime()) / 86400000);
}

function todayUTC() {
  const n = new Date();
  return new Date(Date.UTC(n.getUTCFullYear(), n.getUTCMonth(), n.getUTCDate()));
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function backoffDelay(attempt) {
  return Math.min(500 * 2 ** (attempt - 1), 8000) + Math.floor(Math.random() * 200);
}

// ---------- fetch with retry ----------

// state.delayMs is shared/mutated across all callers to implement a global slowdown on 429.
async function fetchDate(dateObj, state) {
  const { d, m, y } = formatParts(dateObj);
  const url = `${BASE_URL}/${d}-${m}-${y}`;
  let attempt = 0;
  while (true) {
    attempt++;
    try {
      const controller = new AbortController();
      const t = setTimeout(() => controller.abort(), 20000);
      let res;
      try {
        res = await fetch(url, { signal: controller.signal });
      } finally {
        clearTimeout(t);
      }
      if (res.status === 404) {
        return { status: 404, ok: false, body: await res.text().catch(() => null) };
      }
      if (res.status === 429) {
        state.delayMs = Math.min(state.delayMs * 2, 5000);
        process.stderr.write(`[429] slowing down globally to ${state.delayMs}ms\n`);
        if (attempt <= 3) {
          await sleep(backoffDelay(attempt) + state.delayMs);
          continue;
        }
        return { status: 429, ok: false, body: null, error: 'rate-limited-retries-exhausted' };
      }
      if (res.status >= 500) {
        if (attempt <= 3) {
          await sleep(backoffDelay(attempt));
          continue;
        }
        return { status: res.status, ok: false, body: null, error: 'server-error-retries-exhausted' };
      }
      if (!res.ok) {
        return { status: res.status, ok: false, body: await res.text().catch(() => null) };
      }
      const text = await res.text();
      return { status: 200, ok: true, body: text };
    } catch (err) {
      if (attempt <= 3) {
        await sleep(backoffDelay(attempt));
        continue;
      }
      return { status: 0, ok: false, body: null, error: String(err && err.message ? err.message : err) };
    }
  }
}

async function probe(dateObj, state) {
  const res = await fetchDate(dateObj, state);
  if (res.status !== 200 || !res.body) return false;
  try {
    const json = JSON.parse(res.body);
    return !!(json && typeof json.liturgia === 'string' && json.liturgia.trim().length > 0);
  } catch {
    return false;
  }
}

// ---------- boundary detection ----------

async function findEarliestBoundary(state) {
  const today = todayUTC();
  let low = args.lowAnchor ? parseISO(args.lowAnchor) : parseISO('1900-01-01');
  const high = today;

  process.stderr.write(`[boundary] confirming anchors: low=${toISO(low)} high=${toISO(high)}\n`);
  if (!(await probe(high, state))) {
    throw new Error(`sanity check failed: today (${toISO(high)}) does not serve liturgy`);
  }
  // Extend the low anchor further back if it unexpectedly works (shouldn't happen, but be safe).
  while (await probe(low, state)) {
    process.stderr.write(`[boundary] low anchor ${toISO(low)} unexpectedly works, extending back\n`);
    low = addDays(low, -3650);
  }

  let lo = low;
  let hi = high;
  while (diffDays(lo, hi) > 1) {
    const mid = addDays(lo, Math.floor(diffDays(lo, hi) / 2));
    const works = await probe(mid, state);
    process.stderr.write(`[boundary/earliest] probe ${toISO(mid)} -> ${works}\n`);
    if (works) hi = mid;
    else lo = mid;
  }
  return hi;
}

async function findLatestBoundary(state) {
  const today = todayUTC();
  let high = args.highAnchor ? parseISO(args.highAnchor) : addDays(today, 3650);
  const low = today;

  process.stderr.write(`[boundary] confirming anchors: low=${toISO(low)} high=${toISO(high)}\n`);
  if (!(await probe(low, state))) {
    throw new Error(`sanity check failed: today (${toISO(low)}) does not serve liturgy`);
  }
  while (await probe(high, state)) {
    process.stderr.write(`[boundary] high anchor ${toISO(high)} unexpectedly works, extending forward\n`);
    high = addDays(high, 3650);
  }

  let lo = low;
  let hi = high;
  while (diffDays(lo, hi) > 1) {
    const mid = addDays(lo, Math.floor(diffDays(lo, hi) / 2));
    const works = await probe(mid, state);
    process.stderr.write(`[boundary/latest] probe ${toISO(mid)} -> ${works}\n`);
    if (works) lo = mid;
    else hi = mid;
  }
  return lo;
}

// Confirm a boundary is a clean edge (not a hole) by checking a few adjacent days each side.
// Returns { ok, notes }.
async function confirmBoundary(boundaryDate, direction, state) {
  const notes = [];
  const insideOffsets = [0, 1, 2, 3, 4];
  const outsideOffsets = [-1, -2, -3, -4, -5];
  const inside = direction === 'earliest' ? insideOffsets : insideOffsets.map((n) => -n);
  const outside = direction === 'earliest' ? outsideOffsets : outsideOffsets.map((n) => -n);

  let ok = true;
  for (const off of inside) {
    const d = addDays(boundaryDate, off);
    const works = await probe(d, state);
    if (!works) {
      ok = false;
      notes.push(`inside probe ${toISO(d)} (offset ${off}) unexpectedly FAILED`);
    }
  }
  for (const off of outside) {
    const d = addDays(boundaryDate, off);
    const works = await probe(d, state);
    if (works) {
      ok = false;
      notes.push(`outside probe ${toISO(d)} (offset ${off}) unexpectedly WORKED (hole/non-monotonic boundary)`);
    }
  }
  return { ok, notes };
}

async function detectBoundaries() {
  const state = { delayMs: SPACING_MS };
  const earliest = await findEarliestBoundary(state);
  const earliestConfirm = await confirmBoundary(earliest, 'earliest', state);
  const latest = await findLatestBoundary(state);
  const latestConfirm = await confirmBoundary(latest, 'latest', state);

  const boundaries = {
    earliest: toISO(earliest),
    latest: toISO(latest),
    detectedAt: new Date().toISOString(),
    earliestConfirm,
    latestConfirm,
  };
  fs.mkdirSync(CACHE_DIR, { recursive: true });
  fs.writeFileSync(BOUNDARIES_FILE, JSON.stringify(boundaries, null, 2));
  process.stderr.write(
    `[boundary] earliest=${boundaries.earliest} (clean=${earliestConfirm.ok}) latest=${boundaries.latest} (clean=${latestConfirm.ok})\n`
  );
  if (!earliestConfirm.ok) process.stderr.write(`[boundary] earliest notes: ${earliestConfirm.notes.join('; ')}\n`);
  if (!latestConfirm.ok) process.stderr.write(`[boundary] latest notes: ${latestConfirm.notes.join('; ')}\n`);
  return boundaries;
}

// ---------- payload validation ----------

function validatePayload(json) {
  const anomalies = [];
  if (!json || typeof json !== 'object') return { anomalies: ['not-object'], coreValid: false };

  const liturgia = typeof json.liturgia === 'string' ? json.liturgia.trim() : '';
  const cor = typeof json.cor === 'string' ? json.cor.trim() : '';
  const leituras = json.leituras || {};
  const evangelho = Array.isArray(leituras.evangelho) ? leituras.evangelho : [];

  const coreValid = liturgia.length > 0 && cor.length > 0 && evangelho.length > 0;
  if (!liturgia) anomalies.push('missing-liturgia');
  if (!cor) anomalies.push('missing-cor');
  if (evangelho.length === 0) anomalies.push('empty-evangelho');

  if (!Array.isArray(leituras.salmo) || leituras.salmo.length === 0) anomalies.push('missing-salmo');
  if (!Array.isArray(leituras.primeiraLeitura) || leituras.primeiraLeitura.length === 0)
    anomalies.push('missing-primeira-leitura');

  const oracoes = json.oracoes || {};
  for (const f of ['coleta', 'oferendas', 'comunhao']) {
    if (!oracoes[f] || typeof oracoes[f] !== 'string' || !oracoes[f].trim()) {
      anomalies.push(`missing-oracoes-${f}`);
    }
  }

  const antifonas = json.antifonas || {};
  if (!antifonas.entrada) anomalies.push('missing-antifona-entrada');
  if (!antifonas.comunhao) anomalies.push('missing-antifona-comunhao');

  for (const k of Object.keys(json)) if (!KNOWN_TOP.has(k)) anomalies.push(`unexpected-top-key:${k}`);
  for (const k of Object.keys(oracoes)) if (!KNOWN_ORACOES.has(k)) anomalies.push(`unexpected-oracoes-key:${k}`);
  for (const k of Object.keys(leituras)) if (!KNOWN_LEITURAS.has(k)) anomalies.push(`unexpected-leituras-key:${k}`);
  for (const k of Object.keys(antifonas)) if (!KNOWN_ANTIFONAS.has(k)) anomalies.push(`unexpected-antifonas-key:${k}`);

  return { anomalies, coreValid };
}

// ---------- harvest loop ----------

function loadJsonSafe(file, fallback) {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch {
    return fallback;
  }
}

async function harvestRange(startDate, endDate) {
  fs.mkdirSync(CACHE_DIR, { recursive: true });
  const state = { delayMs: SPACING_MS };

  const dates = [];
  for (let d = startDate; diffDays(d, endDate) >= 0; d = addDays(d, 1)) dates.push(d);

  const total = dates.length;
  let idx = 0;
  let fetchedCount = 0;
  let skippedCount = 0;
  const missingDates = [];
  const anomalies = [];

  async function worker() {
    while (idx < dates.length) {
      const myIdx = idx++;
      const date = dates[myIdx];
      const iso = toISO(date);
      const filePath = path.join(CACHE_DIR, `${iso}.json`);
      if (!FORCE && fs.existsSync(filePath)) {
        skippedCount++;
        continue;
      }
      await sleep(state.delayMs);
      const res = await fetchDate(date, state);
      if (res.status === 404) {
        missingDates.push(iso);
      } else if (res.ok) {
        let json = null;
        try {
          json = JSON.parse(res.body);
        } catch {
          anomalies.push({ date: iso, type: 'invalid-json' });
        }
        if (json) {
          const { anomalies: fieldAnomalies, coreValid } = validatePayload(json);
          for (const a of fieldAnomalies) anomalies.push({ date: iso, type: a });
          if (!coreValid) anomalies.push({ date: iso, type: 'invalid-core-payload' });
          fs.writeFileSync(filePath, res.body);
          fetchedCount++;
        }
      } else {
        anomalies.push({ date: iso, type: `fetch-failed-status-${res.status}`, error: res.error });
      }
      if ((myIdx + 1) % 100 === 0 || myIdx + 1 === total) {
        process.stderr.write(`[harvest] ${myIdx + 1}/${total} (fetched=${fetchedCount} skipped=${skippedCount} missing=${missingDates.length} anomalies=${anomalies.length})\n`);
      }
    }
  }

  await Promise.all(Array.from({ length: CONCURRENCY }, () => worker()));
  return { fetchedCount, skippedCount, missingDates, anomalies, total };
}

// ---------- summary ----------

function buildSummary() {
  const boundaries = loadJsonSafe(BOUNDARIES_FILE, null);
  const files = fs
    .readdirSync(CACHE_DIR)
    .filter((f) => /^\d{4}-\d{2}-\d{2}\.json$/.test(f))
    .sort();

  let earliestISO = boundaries?.earliest;
  let latestISO = boundaries?.latest;
  if (!earliestISO || !latestISO) {
    if (files.length === 0) throw new Error('no cached files and no boundaries file; run harvest first');
    earliestISO = files[0].replace('.json', '');
    latestISO = files[files.length - 1].replace('.json', '');
  }

  const earliest = parseISO(earliestISO);
  const latest = parseISO(latestISO);
  const cachedSet = new Set(files.map((f) => f.replace('.json', '')));

  const missingDates = [];
  const anomalies = [];
  const colorValues = new Set();
  const liturgiaSamples = [];
  let totalFetched = 0;

  const allDates = [];
  for (let d = earliest; diffDays(d, latest) >= 0; d = addDays(d, 1)) allDates.push(toISO(d));

  const sampleStep = Math.max(1, Math.floor(allDates.length / 10));

  for (let i = 0; i < allDates.length; i++) {
    const iso = allDates[i];
    if (!cachedSet.has(iso)) {
      missingDates.push(iso);
      continue;
    }
    totalFetched++;
    const filePath = path.join(CACHE_DIR, `${iso}.json`);
    let json;
    try {
      json = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    } catch {
      anomalies.push({ date: iso, type: 'invalid-json' });
      continue;
    }
    const { anomalies: fieldAnomalies, coreValid } = validatePayload(json);
    for (const a of fieldAnomalies) anomalies.push({ date: iso, type: a });
    if (!coreValid) anomalies.push({ date: iso, type: 'invalid-core-payload' });
    if (json.cor) colorValues.add(json.cor);
    if (json.liturgia && i % sampleStep === 0 && liturgiaSamples.length < 10) {
      liturgiaSamples.push(json.liturgia);
    }
  }

  const summary = {
    firstServed: earliestISO,
    lastServed: latestISO,
    totalFetched,
    missingDates,
    anomalies,
    colorValues: Array.from(colorValues).sort(),
    liturgiaSamples,
  };
  fs.writeFileSync(SUMMARY_FILE, JSON.stringify(summary, null, 2));
  return summary;
}

// ---------- main ----------

async function main() {
  if (args['summary-only']) {
    const summary = buildSummary();
    process.stderr.write(`[summary] wrote ${SUMMARY_FILE}\n`);
    process.stderr.write(JSON.stringify({ ...summary, missingDates: `[${summary.missingDates.length} items]`, anomalies: `[${summary.anomalies.length} items]` }, null, 2) + '\n');
    return;
  }

  let boundaries;
  if (args.start && args.end) {
    boundaries = loadJsonSafe(BOUNDARIES_FILE, null);
  } else {
    boundaries = await detectBoundaries();
  }

  if (args['detect-boundaries']) return;

  const startDate = args.start ? parseISO(args.start) : parseISO(boundaries.earliest);
  const endDate = args.end ? parseISO(args.end) : parseISO(boundaries.latest);

  process.stderr.write(`[harvest] range ${toISO(startDate)} .. ${toISO(endDate)} (concurrency=${CONCURRENCY}, spacing=${SPACING_MS}ms)\n`);
  const result = await harvestRange(startDate, endDate);
  process.stderr.write(`[harvest] done. fetched=${result.fetchedCount} skipped=${result.skippedCount} missing=${result.missingDates.length} anomalies=${result.anomalies.length}\n`);

  const summary = buildSummary();
  process.stderr.write(`[summary] wrote ${SUMMARY_FILE}: firstServed=${summary.firstServed} lastServed=${summary.lastServed} totalFetched=${summary.totalFetched} missingDates=${summary.missingDates.length} anomalies=${summary.anomalies.length}\n`);
}

main().catch((err) => {
  process.stderr.write(`[fatal] ${err.stack || err}\n`);
  process.exitCode = 1;
});
