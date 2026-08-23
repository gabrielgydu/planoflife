#!/usr/bin/env node
// Builds src/data/rosary_engine.json — the structured step texts for the rosary
// praying engine (RosaryPrayerView) — by slicing the already-fetched Devocionário
// corpus (src/data/devocionario.json, prayer id "santo-rosario"). BUILD-TIME
// ONLY: the app imports the committed JSON, never this script.
//
//   node scripts/extract-rosary-engine.mjs
//
// Sourcing rules (see the project memory "opus-dei-text-sourcing"): every emitted
// string is a VERBATIM substring of the opusdei.org-derived corpus — this script
// only slices, it never rewrites. Source quirks (the Fátima prayer's double
// period, rubrics running into text) are reproduced, never "fixed". Every output
// string is verified with indexOf against the source blob before writing; a
// marker that stops matching (e.g. after a corpus re-fetch) fails the build
// instead of silently emitting a wrong slice.
//
// The Latin blob deliberately LACKS the Fátima prayer and the three closing Ave
// Marias — the pt-BR prayer book prints them only in Portuguese. The engine
// falls back to pt for those steps; this is source fidelity, not an omission.
import { readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const corpusPath = path.join(root, 'src', 'data', 'devocionario.json')
const outPath = path.join(root, 'src', 'data', 'rosary_engine.json')

const corpus = JSON.parse(await readFile(corpusPath, 'utf8'))
const rosario = corpus.prayers.find((p) => p.id === 'santo-rosario')
if (!rosario) throw new Error('devocionario.json has no prayer "santo-rosario"')
const pt = rosario.texts.pt
const la = rosario.texts.la

/** The text strictly between two unique markers, trimmed. `to: null` = end. */
function between(blob, label, from, to) {
  const i = blob.indexOf(from)
  if (i === -1) throw new Error(`${label}: start marker not found: ${from}`)
  if (blob.indexOf(from, i + 1) !== -1) throw new Error(`${label}: start marker not unique: ${from}`)
  const start = i + from.length
  if (to === null) return blob.slice(start).trim()
  const j = blob.indexOf(to, start)
  if (j === -1) throw new Error(`${label}: end marker not found: ${to}`)
  return blob.slice(start, j).trim()
}

/** Same, but the start marker is kept as part of the slice (it is a heading/line the reader should see). */
function fromMarker(blob, label, from, to) {
  const i = blob.indexOf(from)
  if (i === -1) throw new Error(`${label}: start marker not found: ${from}`)
  if (to === null) return blob.slice(i).trim()
  const j = blob.indexOf(to, i)
  if (j === -1) throw new Error(`${label}: end marker not found: ${to}`)
  return blob.slice(i, j).trim()
}

// ---------------------------------------------------------------- Portuguese
const aberturaPt = between(pt, 'abertura pt', '**Santo Rosário**', 'MISTÉRIOS GOZOSOS')
const fatimaPt = between(pt, 'fátima pt', '*Depois de cada mistério*', '*Ao terminar os cinco mistérios*')
const avesFinaisBlockPt = between(pt, 'aves finais pt', '*Ao terminar os cinco mistérios*', '**Ladainha a Nossa Senhora**')
const avesFinaisPt = avesFinaisBlockPt.split('\n\n').map((s) => s.trim()).filter(Boolean)
if (avesFinaisPt.length !== 3 || avesFinaisPt.some((s) => !s.startsWith('– Ave Maria')))
  throw new Error(`aves finais pt: expected 3 "– Ave Maria" lines, got ${JSON.stringify(avesFinaisPt)}`)
const ladainhaPt = fromMarker(pt, 'ladainha pt', '**Ladainha a Nossa Senhora**', 'À vossa proteção')
const finaisPt = fromMarker(pt, 'finais pt', 'À vossa proteção', '– Pelas necessidades')
const intencoesPt = fromMarker(pt, 'intenções pt', '– Pelas necessidades', '<em>________________</em>')
const triduoQuintaPt = between(pt, 'tríduo quinta pt', '*Na Quinta-feira Santa, em vez do Glória, pode-se rezar:*', '*E na Sexta-feira Santa:*')
const triduoSextaPt = between(pt, 'tríduo sexta pt', '*E na Sexta-feira Santa:*', '*E no Sábado Santo:*')
const triduoSabadoPt = between(pt, 'tríduo sábado pt', '*E no Sábado Santo:*', null)

// --------------------------------------------------------------------- Latin
const aberturaLa = between(la, 'abertura la', '**Sanctum Rosárium**', 'GAUDII MYSTERIA')
const ladainhaLa = fromMarker(la, 'ladainha la', '**Litaniarum Lauretanarum**', 'Sub tuum')
const finaisLa = fromMarker(la, 'finais la', 'Sub tuum', '– Pro necessitatibus')
const intencoesLa = fromMarker(la, 'intenções la', '– Pro necessitatibus', '<em>________________</em>')
const triduoQuintaLa = between(la, 'tríduo quinta la', '*Feria V in Passione Domini, loco Gloria, potest recitari:*', '*Et Feria VI:*')
const triduoSextaLa = between(la, 'tríduo sexta la', '*Et Feria VI:*', '*Et Sabbato Sancto:*')
const triduoSabadoLa = between(la, 'tríduo sábado la', '*Et Sabbato Sancto:*', null)

// Latin mystery titles, per set, in the app's SetKey naming. Lines look like
// "1.° Annuntiatione Domini" (Gaudii/Doloris/Gloriæ use "°", Lucis "º"); the
// weekday rubric lines are italic and skipped. Trailing periods stay verbatim.
function titlesLa(label, from, to) {
  const block = between(la, label, from, to)
  const titles = block
    .split('\n')
    .map((l) => l.trim())
    .map((l) => l.match(/^\d\.[°º]\s*(.+)$/)?.[1])
    .filter((t) => t !== undefined)
  if (titles.length !== 5) throw new Error(`${label}: expected 5 titles, got ${titles.length}`)
  return titles
}
const mysteryTitlesLa = {
  gozosos: titlesLa('títulos gozosos la', 'GAUDII MYSTERIA', 'DOLORIS MYSTERIA'),
  dolorosos: titlesLa('títulos dolorosos la', 'DOLORIS MYSTERIA', 'GLORIAE MYSTERIA'),
  gloriosos: titlesLa('títulos gloriosos la', 'GLORIAE MYSTERIA', 'LUCIS MYSTERIA'),
  luminosos: titlesLa('títulos luminosos la', 'LUCIS MYSTERIA', '**Litaniarum Lauretanarum**'),
}

// -------------------------------------------------------------- Verification
// Every string the app will render must be a verbatim substring of its source
// blob — the one guarantee that no slicing bug rewrote the Work's wording.
function assertVerbatim(label, blob, s) {
  if (!blob.includes(s)) throw new Error(`${label}: emitted string is not verbatim in the source`)
}
const checks = [
  ['abertura pt', pt, aberturaPt], ['fátima pt', pt, fatimaPt],
  ['ladainha pt', pt, ladainhaPt], ['finais pt', pt, finaisPt], ['intenções pt', pt, intencoesPt],
  ['tríduo quinta pt', pt, triduoQuintaPt], ['tríduo sexta pt', pt, triduoSextaPt], ['tríduo sábado pt', pt, triduoSabadoPt],
  ['abertura la', la, aberturaLa], ['ladainha la', la, ladainhaLa], ['finais la', la, finaisLa], ['intenções la', la, intencoesLa],
  ['tríduo quinta la', la, triduoQuintaLa], ['tríduo sexta la', la, triduoSextaLa], ['tríduo sábado la', la, triduoSabadoLa],
  ...avesFinaisPt.map((s, i) => [`ave final ${i + 1} pt`, pt, s]),
  ...Object.entries(mysteryTitlesLa).flatMap(([set, ts]) => ts.map((t, i) => [`título la ${set} ${i + 1}`, la, t])),
]
for (const [label, blob, s] of checks) assertVerbatim(label, blob, s)

const out = {
  source: 'src/data/devocionario.json → prayer "santo-rosario" (opusdei.org pt-BR Livro de Orações)',
  generatedBy: 'scripts/extract-rosary-engine.mjs',
  abertura: { pt: aberturaPt, la: aberturaLa },
  // pt-only in the source; the engine falls back to pt in Latin mode.
  fatima: { pt: fatimaPt },
  avesFinais: { pt: avesFinaisPt },
  ladainha: { pt: ladainhaPt, la: ladainhaLa },
  finais: { pt: finaisPt, la: finaisLa },
  intencoes: { pt: intencoesPt, la: intencoesLa },
  triduo: {
    quinta: { pt: triduoQuintaPt, la: triduoQuintaLa },
    sexta: { pt: triduoSextaPt, la: triduoSextaLa },
    sabado: { pt: triduoSabadoPt, la: triduoSabadoLa },
  },
  mysteryTitlesLa,
}

await writeFile(outPath, JSON.stringify(out, null, 2) + '\n', 'utf8')
console.log(`wrote ${path.relative(root, outPath)}`)
console.log(`  abertura pt/la, fátima pt, ${avesFinaisPt.length} aves finais pt, ladainha pt/la, finais pt/la, intenções pt/la, tríduo ×3 pt/la, títulos la 4×5`)
console.log('  all strings verified verbatim against the corpus')
