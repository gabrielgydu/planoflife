import engineRaw from './rosary_engine.json'
import { holyTriduumDay } from '../utils/liturgical'
import type { SetKey } from './rosary'

// The bead-by-bead structure of the rosary as prayed in Opus Dei, driving
// RosaryPrayerView. Step TEXTS come from rosary_engine.json (verbatim slices of
// the Devocionário's "santo-rosario" entry, built by
// scripts/extract-rosary-engine.mjs); mystery titles/quotes/images come from
// rosary_contemplation.json + rosary_images.json, index-aligned per set.
//
// Haptic design language: ONLY the Ave taps tick (the visually-hidden iOS
// switch — see HapticTapArea). Pai Nosso, Glória, Fátima and the announcements
// are deliberately silent, so the silence itself marks the decade boundary,
// like the big bead on a physical rosary.

export type Lang = 'pt' | 'la'

interface EngineTexts {
  abertura: { pt: string; la: string }
  fatima: { pt: string }
  avesFinais: { pt: string[] }
  ladainha: { pt: string; la: string }
  finais: { pt: string; la: string }
  intencoes: { pt: string; la: string }
  triduo: Record<'quinta' | 'sexta' | 'sabado', { pt: string; la: string }>
  mysteryTitlesLa: Record<SetKey, string[]>
}

export const ROSARY_TEXTS = engineRaw as unknown as EngineTexts

export type RosaryStepKind =
  | 'abertura'
  | 'anuncio'
  | 'painosso'
  | 'ave'
  | 'gloria'
  | 'fatima'
  | 'ave-final'
  | 'ladainha'
  | 'finais'
  | 'intencoes'

export interface RosaryStep {
  kind: RosaryStepKind
  // True = the tap surface is the hidden iOS switch and produces a native tick.
  haptic: boolean
  // Long-text steps scroll and advance via a button instead of a full-area tap.
  scroll: boolean
  // 0-based mystery within the day's set, for every step inside a decade.
  mysteryIndex?: number
  // 0-based position: 0..9 for 'ave', 0..2 for 'ave-final'.
  aveIndex?: number
}

// The fixed 77-step sequence. It never depends on set or date — the set only
// changes the displayed titles/quotes/images, and the Triduum only swaps the
// Glória TEXT (see gloriaText below), not the structure.
function buildSteps(): RosaryStep[] {
  const steps: RosaryStep[] = []
  steps.push({ kind: 'abertura', haptic: false, scroll: true })
  for (let m = 0; m < 5; m++) {
    steps.push({ kind: 'anuncio', haptic: false, scroll: false, mysteryIndex: m })
    steps.push({ kind: 'painosso', haptic: false, scroll: false, mysteryIndex: m })
    for (let a = 0; a < 10; a++) {
      steps.push({ kind: 'ave', haptic: true, scroll: false, mysteryIndex: m, aveIndex: a })
    }
    steps.push({ kind: 'gloria', haptic: false, scroll: false, mysteryIndex: m })
    steps.push({ kind: 'fatima', haptic: false, scroll: false, mysteryIndex: m })
  }
  for (let a = 0; a < 3; a++) {
    steps.push({ kind: 'ave-final', haptic: true, scroll: false, aveIndex: a })
  }
  steps.push({ kind: 'ladainha', haptic: false, scroll: true })
  steps.push({ kind: 'finais', haptic: false, scroll: true })
  steps.push({ kind: 'intencoes', haptic: false, scroll: true })
  return steps
}

export const ROSARY_STEPS: RosaryStep[] = buildSteps()

// Display names for the by-heart beads (labels are ours, not corpus text).
export const ROSARY_STEP_LABELS: Record<Exclude<RosaryStepKind, 'anuncio'>, Record<Lang, string>> = {
  abertura: { pt: 'Abertura', la: 'Abertura' },
  painosso: { pt: 'Pai Nosso', la: 'Pater noster' },
  ave: { pt: 'Ave Maria', la: 'Ave Maria' },
  gloria: { pt: 'Glória ao Pai', la: 'Glória Patri' },
  fatima: { pt: 'Ó meu Jesus', la: 'Ó meu Jesus' },
  'ave-final': { pt: 'Ave Maria', la: 'Ave Maria' },
  ladainha: { pt: 'Ladainha', la: 'Litániæ' },
  finais: { pt: 'Orações finais', la: 'Orações finais' },
  intencoes: { pt: 'Intenções', la: 'Intenções' },
}

/**
 * Text for a Glória step: normally nothing (prayed by heart), but on the Sacred
 * Triduum the Devocionário replaces it with the graded "Christus factus est".
 */
export function gloriaText(date: Date, lang: Lang): string | null {
  const day = holyTriduumDay(date)
  if (!day) return null
  return ROSARY_TEXTS.triduo[day][lang]
}

/** Markdown for the long-text steps; steps missing in Latin fall back to pt. */
export function stepText(kind: RosaryStepKind, lang: Lang): string | null {
  switch (kind) {
    case 'abertura':
      return ROSARY_TEXTS.abertura[lang]
    case 'fatima':
      return ROSARY_TEXTS.fatima.pt
    case 'ladainha':
      return ROSARY_TEXTS.ladainha[lang]
    case 'finais':
      return ROSARY_TEXTS.finais[lang]
    case 'intencoes':
      return ROSARY_TEXTS.intencoes[lang]
    default:
      return null
  }
}
