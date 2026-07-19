#!/usr/bin/env node
// Quick schema census over the harvested liturgia cache. Read-only, prints to stdout.
// node scripts/liturgy/census.mjs

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CACHE_DIR = path.join(__dirname, '.cache', 'api');

const files = fs
  .readdirSync(CACHE_DIR)
  .filter((f) => /^\d{4}-\d{2}-\d{2}\.json$/.test(f))
  .sort();

const colorValues = new Map(); // cor -> count
let segundaLeituraPresent = 0;
let segundaLeituraAbsent = 0;
const segundaByWeekday = new Map(); // 0=Sun..6=Sat -> {present, absent}
const leiturasExtrasTipos = new Map(); // tipo -> count (titulo-only entries counted under '(sem tipo)')
const oracoesExtrasTitulos = new Map();
let leiturasExtrasDates = 0;
let oracoesExtrasDates = 0;
const maxLen = { primeiraLeitura: 0, salmo: 0, segundaLeitura: 0, evangelho: 0 };
const maxLenDate = { primeiraLeitura: '', salmo: '', segundaLeitura: '', evangelho: '' };
let antifonaEntradaMissing = 0;
let antifonaComunhaoMissing = 0;
let evangelhoKeyMissing = 0;
const evangelhoKeyMissingDates = [];

for (const f of files) {
  const iso = f.replace('.json', '');
  const json = JSON.parse(fs.readFileSync(path.join(CACHE_DIR, f), 'utf8'));
  colorValues.set(json.cor, (colorValues.get(json.cor) || 0) + 1);

  const weekday = new Date(iso + 'T00:00:00Z').getUTCDay();
  const seg = json.leituras?.segundaLeitura;
  const segPresent = Array.isArray(seg) && seg.length > 0;
  if (segPresent) segundaLeituraPresent++;
  else segundaLeituraAbsent++;
  const wkStats = segundaByWeekday.get(weekday) || { present: 0, absent: 0 };
  if (segPresent) wkStats.present++;
  else wkStats.absent++;
  segundaByWeekday.set(weekday, wkStats);

  const lExtras = json.leituras?.extras;
  if (Array.isArray(lExtras) && lExtras.length > 0) {
    leiturasExtrasDates++;
    for (const e of lExtras) {
      const key = e.tipo || '(sem tipo)';
      leiturasExtrasTipos.set(key, (leiturasExtrasTipos.get(key) || 0) + 1);
    }
  }
  const oExtras = json.oracoes?.extras;
  if (Array.isArray(oExtras) && oExtras.length > 0) {
    oracoesExtrasDates++;
    for (const e of oExtras) {
      const key = e.titulo || '(sem titulo)';
      oracoesExtrasTitulos.set(key, (oracoesExtrasTitulos.get(key) || 0) + 1);
    }
  }

  for (const field of ['primeiraLeitura', 'salmo', 'segundaLeitura']) {
    const arr = json.leituras?.[field];
    const len = Array.isArray(arr) ? arr.length : 0;
    if (len > maxLen[field]) {
      maxLen[field] = len;
      maxLenDate[field] = iso;
    }
  }
  if (!('evangelho' in (json.leituras || {}))) {
    evangelhoKeyMissing++;
    evangelhoKeyMissingDates.push(iso);
  } else {
    const len = json.leituras.evangelho.length;
    if (len > maxLen.evangelho) {
      maxLen.evangelho = len;
      maxLenDate.evangelho = iso;
    }
  }

  if (!json.antifonas?.entrada) antifonaEntradaMissing++;
  if (!json.antifonas?.comunhao) antifonaComunhaoMissing++;
}

const WEEKDAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

console.log('=== Census over', files.length, 'cached dates ===\n');

console.log('-- cor distribution --');
for (const [k, v] of [...colorValues.entries()].sort((a, b) => b[1] - a[1])) {
  console.log(`  ${k}: ${v}`);
}

console.log('\n-- segundaLeitura presence --');
console.log(`  present: ${segundaLeituraPresent} (${((100 * segundaLeituraPresent) / files.length).toFixed(1)}%)`);
console.log(`  absent:  ${segundaLeituraAbsent} (${((100 * segundaLeituraAbsent) / files.length).toFixed(1)}%)`);
console.log('  by weekday (present/total):');
for (let d = 0; d < 7; d++) {
  const s = segundaByWeekday.get(d) || { present: 0, absent: 0 };
  const total = s.present + s.absent;
  console.log(`    ${WEEKDAY_NAMES[d]}: ${s.present}/${total} (${total ? ((100 * s.present) / total).toFixed(1) : '0.0'}%)`);
}

console.log(`\n-- leituras.extras: present on ${leiturasExtrasDates} dates --`);
for (const [k, v] of [...leiturasExtrasTipos.entries()].sort((a, b) => b[1] - a[1])) {
  console.log(`  ${k}: ${v}`);
}

console.log(`\n-- oracoes.extras: present on ${oracoesExtrasDates} dates --`);
for (const [k, v] of [...oracoesExtrasTitulos.entries()].sort((a, b) => b[1] - a[1]).slice(0, 20)) {
  console.log(`  ${k}: ${v}`);
}
if (oracoesExtrasTitulos.size > 20) console.log(`  ... and ${oracoesExtrasTitulos.size - 20} more distinct titles`);

console.log('\n-- max array lengths (alternates) --');
for (const field of Object.keys(maxLen)) {
  console.log(`  ${field}: max ${maxLen[field]} on ${maxLenDate[field]}`);
}

console.log('\n-- evangelho key entirely missing (not just empty) --');
console.log(`  ${evangelhoKeyMissing} dates:`, evangelhoKeyMissingDates.join(', '));

console.log('\n-- antifonas missing --');
console.log(`  entrada missing: ${antifonaEntradaMissing}`);
console.log(`  comunhao missing: ${antifonaComunhaoMissing}`);
