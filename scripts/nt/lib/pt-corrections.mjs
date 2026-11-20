// Corrections to the harvested Portuguese NT (Matos Soares 1956), applied by
// build-nt.mjs between the raw harvest (scripts/nt/.cache/pt/) and the committed
// store (src/data/nt/books/). BUILD-TIME ONLY.
//
// Why: the text on liriocatolico.com.br is an OCR digitization with OCR errors
// ("Ihes" for "lhes", "dã" for "dá", "voz digo" for "vos digo") and a mix of
// European and Brazilian spelling ("connosco" 21x next to "conosco" 5x).
// bibliacatolica.com.br carries the same digitization (~90% of verses are
// byte-identical), so it served as a second witness, not as a cleaner source.
//
// Policy (Gabriel, 2026-11-20):
//   - fix errors: OCR and typing errors, missing or wrong accents, broken punctuation;
//   - turn the European spellings into the Brazilian spelling the rest of the text
//     uses (acção → ação, demónio → demônio, há-de → há de, chegámos → chegamos);
//   - do NOT modernize the pre-1990 Brazilian spelling the text otherwise has
//     (crêem, vêem, cinqüenta, sòmente stay);
//   - never change the wording of the translation.
//
// VERSE_FIXES live in pt-verse-fixes.json (generated from the 2026-11-20
// proofreading pass: bibliacatolica diff + pt-BR spellcheck + a full read).
//
// Order: WORD_FIXES and the baptiz- rule first, then VERSE_FIXES, whose `from`
// strings were written against that word-fixed text (the proofreading pass read it).
// Every VERSE_FIXES pair must apply exactly once, or the build fails — so a
// re-harvest that changes a verse can't silently drop or misapply a fix.

import { readFileSync } from 'node:fs'

/** Whole-word replacements across the whole NT (letters only count as word characters). */
export const WORD_FIXES = {
  // --- European → Brazilian -------------------------------------------------
  'há-de': 'há de', 'hei-de': 'hei de', 'hão-de': 'hão de', 'hás-de': 'hás de', 'Hão-de': 'Hão de',
  connosco: 'conosco', Connosco: 'Conosco',
  facto: 'fato', factos: 'fatos',
  Egipto: 'Egito',
  acção: 'ação', acções: 'ações', actos: 'atos', acta: 'ata', actividade: 'atividade', actuavam: 'atuavam',
  objecto: 'objeto', objectos: 'objetos', projecto: 'projeto', projectos: 'projetos',
  Efectivamente: 'Efetivamente', efectivamente: 'efetivamente', afectos: 'afetos',
  directamente: 'diretamente', direcção: 'direção', exactidão: 'exatidão',
  rectamente: 'retamente', recto: 'reto', rectos: 'retos', tecto: 'teto',
  reflectiam: 'refletiam', espectáculo: 'espetáculo', olfacto: 'olfato', colecta: 'coleta',
  estupefacto: 'estupefato', estupefactos: 'estupefatos', estupefactas: 'estupefatas',
  excepto: 'exceto', 'exceptua-se': 'excetua-se', fracção: 'fração', carácter: 'caráter',
  óptimo: 'ótimo', adopção: 'adoção', ceptro: 'cetro',
  dilecto: 'dileto', dílecto: 'dileto', dilectíssimos: 'diletíssimos',
  humidade: 'umidade',
  terramoto: 'terremoto', omnipotente: 'onipotente', Omnipotente: 'Onipotente',
  demónio: 'demônio', demónios: 'demônios', Unigénito: 'Unigênito', primogénito: 'primogênito',
  género: 'gênero', prémio: 'prêmio', zénite: 'zênite', telónio: 'telônio', sardónica: 'sardônica',
  calcedónia: 'calcedônia', sicómoro: 'sicômoro', pitónico: 'pitônico', licaónica: 'licaônica',
  Sidónia: 'Sidônia', Macedónia: 'Macedônia', Mecedónia: 'Macedônia', Macedónios: 'Macedônios',
  macedónio: 'macedônio', Icónio: 'Icônio', Apolónia: 'Apolônia', Filémon: 'Filêmon', Ómega: 'Ômega',
  chegámos: 'chegamos', embarcámos: 'embarcamos', Embarcámos: 'Embarcamos', Tocámos: 'Tocamos',
  entoámos: 'entoamos', deixámos: 'deixamos', navegámos: 'navegamos', abandonámos: 'abandonamos',
  perdoámos: 'perdoamos', Encontrámos: 'Encontramos', ordenámos: 'ordenamos', aportámos: 'aportamos',
  separámos: 'separamos', cessámos: 'cessamos', levantámos: 'levantamos', ficámos: 'ficamos',
  abraçámos: 'abraçamos', 'encaminhámo-nos': 'encaminhamo-nos',
  baptízada: 'batizada',

  // --- OCR / typing errors that can only mean one thing --------------------
  Ihes: 'lhes', Ihe: 'lhe', Iha: 'lha', Iho: 'lho', Ios: 'los', Ievaram: 'levaram', lsto: 'Isto',
  Espirito: 'Espírito', principio: 'princípio',
  espectativa: 'expectativa', Imediamente: 'Imediatamente',
}

/** baptismo, baptizar, Baptista and every other form → batismo, batizar, Batista. */
const BAPT = /(?<!\p{L})([Bb])apti/gu

function wordRegex(from) {
  const escaped = from.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  return new RegExp(`(?<!\\p{L})${escaped}(?!\\p{L})`, 'gu')
}
const WORD_REGEXES = Object.entries(WORD_FIXES).map(([from, to]) => [wordRegex(from), to, from])

/**
 * Verse-specific fixes, keyed "<BookKey> <chapter>:<verse>": a list of
 * { from, to, why } objects, each `from` an exact substring occurring once in the
 * word-fixed verse.
 */
export const VERSE_FIXES = JSON.parse(readFileSync(new URL('./pt-verse-fixes.json', import.meta.url), 'utf8'))

/** WORD_FIXES and the baptiz- rule, on any text (also used to compare the oracle). */
export function applyWordFixes(text, stats) {
  let out = text
  for (const [re, to, from] of WORD_REGEXES) {
    out = out.replace(re, () => {
      stats?.words.set(from, (stats.words.get(from) ?? 0) + 1)
      return to
    })
  }
  return out.replace(BAPT, (_, b) => {
    stats?.words.set('bapti-', (stats.words.get('bapti-') ?? 0) + 1)
    return `${b}ati`
  })
}

/**
 * Applies every correction to one verse.
 * `stats` collects counts: { verse: Set of applied verse-fix ids, words: Map from → n }.
 */
export function correctVerse(bookKey, chapter, verse, text, stats) {
  const ref = `${bookKey} ${chapter}:${verse}`
  let out = applyWordFixes(text, stats)
  for (const [i, { from, to }] of (VERSE_FIXES[ref] ?? []).entries()) {
    const at = out.indexOf(from)
    if (at === -1 || out.indexOf(from, at + 1) !== -1) {
      throw new Error(`[pt-corrections] ${ref}: "${from}" must occur exactly once in: ${out}`)
    }
    out = out.slice(0, at) + to + out.slice(at + from.length)
    stats.verse.add(`${ref}#${i}`)
  }
  return out
}

/** Throws unless every VERSE_FIXES pair was applied. */
export function assertAllVerseFixesApplied(stats) {
  const missing = []
  for (const [ref, pairs] of Object.entries(VERSE_FIXES)) {
    pairs.forEach((_, i) => {
      if (!stats.verse.has(`${ref}#${i}`)) missing.push(`${ref}#${i}`)
    })
  }
  if (missing.length) throw new Error(`[pt-corrections] never applied (no such verse?): ${missing.join(', ')}`)
}
