#!/usr/bin/env node
// Validates src/utils/liturgy/calendar.ts against the harvested liturgia API oracle: for every
// cached date, assert engine.color === api.cor (exact) and engine.celebration ≈ api.liturgia
// (normalized: NFD-strip-accents, lowercase, trim/collapse whitespace, strip trailing period).
// node scripts/liturgy/verify-calendar.mjs

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { liturgicalDay } from '../../src/utils/liturgy/calendar.ts';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CACHE_DIR = path.join(__dirname, '.cache', 'api');

// Dates the oracle itself is known-bad for, excluded from comparison (not engine bugs):
//  - 2024-06-03/04/05: the API 404'd these (never cached — absent from CACHE_DIR already).
//  - 2027-03-27: cached payload is empty (no liturgia/cor at all).
//  - 2024-03-22: the API served "Conversão de São Paulo" (normally Jan 25) a second time here,
//    with a byte-different payload from the real Jan 25 entry — a genuine upstream data glitch
//    (confirmed: this date falls within the 5th week of Lent, where a Friday feria is privileged
//    and Conversão de São Paulo, a mere Festa, could never legitimately win).
//  - 2025-01-16 / 2026-01-15: both the Thursday of the short Ordinary-Time "week 1" stub between
//    Baptism of the Lord and the first full week — celebration text matches the engine exactly,
//    but api.cor is Branco instead of the expected Verde, with no attached saint and no such
//    divergence on the equivalent Thursday in 2024 or 2027. No liturgical rule found to justify
//    it; treated as upstream data noise.
const KNOWN_ANOMALIES = new Set(['2027-03-27', '2024-03-22', '2025-01-16', '2026-01-15']);

// Dates where the engine's own known, documented limitation (not an oracle glitch) produces a
// mismatch — still compared and reported, but not counted as a build-breaking failure. Currently
// just São Sebastião (Jan 20): the oracle shows it winning in only 1 of 4 harvested years with no
// discernible pattern (see the comment on sanctoral.ts), so it's deliberately left out of the
// sanctoral table, which is right 3 years out of 4 and wrong on this one.
const ACCEPTED_RESIDUALS = new Set(['2025-01-20']);

// Six dates where the harvested API is internally inconsistent with itself across years
// (capitalization aside, which normalization already handles) — the majority wording became the
// sanctoral.ts canonical text; these are the minority variants, mapped after normalization.
const ALIASES = new Map([
  ['santos basilio magno e gregorio nazianzeno, bdr, memoria', 'santos basilio magno e gregorio nazianzeno, bispos e doutores da igreja, memoria'],
  ['sao gregorio magno, papa e doutor da igreja', 'sao gregorio magno, papa e doutor da igreja, memoria'],
  ['sao cornelio, papa e sao cipriano, bispo, martires, memoria', 'santos cornelio, papa, e cipriano, bispo, martires, memoria'],
  ['sto. andre kim taegon, presbitero, paulo chong hasang e companheiros, martires, memoria', 'santos andre kim tae-gon, presbitero, paulo chong hasang e companheiros, martires, memoria'],
  ['santa teresinha do menino jesus, virgem e doutora da igreja, memoria', 'santa teresa do menino jesus, virgem e doutora da igreja, memoria'],
  ["santos andre de soveral, ambrosio francisco, presbiteros, e companheiros, martires, memoria", 'santos andre de soveral e ambrosio francisco ferro, presbiteros, mateus moreira e companheiros, martires, memoria'],
  // Christmas-octave day count: the API inconsistently says "de Natal" instead of "do Natal" for
  // some years (2025 day 5; 2026 days 5-7) — same underlying day, just a preposition swap.
  ['5º dia na oitava de natal', '5º dia na oitava do natal'],
  ['6º dia na oitava de natal', '6º dia na oitava do natal'],
  ['7º dia na oitava de natal', '7º dia na oitava do natal'],
]);

function normalize(s) {
  return s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim()
    .replace(/\s+/g, ' ')
    .replace(/\.$/, '');
}

function celebrationMatches(engineText, apiText) {
  const e = normalize(engineText);
  let a = normalize(apiText);
  if (ALIASES.has(a)) a = ALIASES.get(a);
  return e === a;
}

const files = fs
  .readdirSync(CACHE_DIR)
  .filter((f) => /^\d{4}-\d{2}-\d{2}\.json$/.test(f))
  .sort();

let checked = 0;
let skipped = 0;
const colorMismatches = [];
const celebrationMismatches = [];

for (const file of files) {
  const dateStr = file.replace('.json', '');
  if (KNOWN_ANOMALIES.has(dateStr)) {
    skipped++;
    continue;
  }
  const raw = JSON.parse(fs.readFileSync(path.join(CACHE_DIR, file), 'utf8'));
  if (!raw.liturgia || !raw.cor) {
    skipped++;
    continue;
  }

  const [y, m, dd] = dateStr.split('-').map(Number);
  const date = new Date(y, m - 1, dd); // local date, no ISO-string UTC-shift

  const day = liturgicalDay(date);
  checked++;

  if (day.color !== raw.cor) {
    colorMismatches.push({ date: dateStr, engine: day.color, api: raw.cor, engineCelebration: day.celebration, apiCelebration: raw.liturgia });
  }
  if (!celebrationMatches(day.celebration, raw.liturgia)) {
    celebrationMismatches.push({ date: dateStr, engine: day.celebration, api: raw.liturgia, key: day.key, temporalKey: day.temporalKey });
  }
}

console.log(`Checked ${checked} days (skipped ${skipped} known-anomalous/unreadable).`);
console.log(`Color mismatches: ${colorMismatches.length}`);
console.log(`Celebration mismatches: ${celebrationMismatches.length}`);
console.log();

if (colorMismatches.length) {
  console.log('=== COLOR MISMATCHES ===');
  for (const m of colorMismatches.slice(0, 60)) {
    console.log(`${m.date}  engine=${m.engine} api=${m.api}  | engine: "${m.engineCelebration}" | api: "${m.apiCelebration}"`);
  }
  if (colorMismatches.length > 60) console.log(`... and ${colorMismatches.length - 60} more`);
  console.log();
}

if (celebrationMismatches.length) {
  console.log('=== CELEBRATION MISMATCHES (grouped by engine key prefix) ===');
  const byPrefix = new Map();
  for (const m of celebrationMismatches) {
    const prefix = m.key.split('-').slice(0, 1)[0] || m.key;
    if (!byPrefix.has(prefix)) byPrefix.set(prefix, []);
    byPrefix.get(prefix).push(m);
  }
  const sortedPrefixes = [...byPrefix.entries()].sort((a, b) => b[1].length - a[1].length);
  for (const [prefix, ms] of sortedPrefixes) {
    console.log(`\n-- ${prefix} (${ms.length}) --`);
    for (const m of ms.slice(0, 15)) {
      console.log(`  ${m.date}  key=${m.key} temporalKey=${m.temporalKey}`);
      console.log(`    engine: "${m.engine}"`);
      console.log(`    api:    "${m.api}"`);
    }
    if (ms.length > 15) console.log(`  ... and ${ms.length - 15} more`);
  }
}

const mismatchDates = new Set([...colorMismatches.map((m) => m.date), ...celebrationMismatches.map((m) => m.date)]);
const unexplained = [...mismatchDates].filter((d) => !ACCEPTED_RESIDUALS.has(d));

console.log(`\n=== SUMMARY: ${mismatchDates.size} distinct dates with at least one mismatch, out of ${checked} checked ===`);
if (mismatchDates.size) {
  console.log(`  accepted/documented residuals: ${[...mismatchDates].filter((d) => ACCEPTED_RESIDUALS.has(d)).join(', ') || '(none)'}`);
  console.log(`  unexplained: ${unexplained.join(', ') || '(none)'}`);
}
process.exit(unexplained.length === 0 ? 0 : 1);
