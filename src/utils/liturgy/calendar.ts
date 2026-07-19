// Perpetual Roman-calendar (Novus Ordo, Brazilian national calendar) engine.
//
// Every rule encoded here that isn't textbook-standard computus was reverse-engineered from and
// validated against scripts/liturgy/.cache/api/*.json — 1244 harvested days of the Brazilian
// pt-BR daily-liturgy API, 2024-01-01..2027-05-31 (see scripts/liturgy/verify-calendar.mjs). Where
// a rule is genuinely untested by that window (St Joseph impeded by a Sunday of Lent never
// occurs 2024-2027) it's flagged UNVERIFIED below — implemented per the general universal norms,
// not oracle-confirmed.
//
// ---------------------------------------------------------------------------------------------
// KEY GRAMMAR
// ---------------------------------------------------------------------------------------------
// `key`         — stable liturgical identity of the day's WINNING celebration.
// `temporalKey` — the underlying temporal feria's identity, ALWAYS present (even when a sanctoral
//                 celebration wins the day). This is what P2 content lookup needs: on a memorial,
//                 the Mass readings still follow the temporal feria (and so vary with weekdayCycle
//                 for Ordinary Time), while the orations/name follow the sanctoral entry. Compose
//                 a day's content from (key for orations/name) + (temporalKey for readings, unless
//                 key===temporalKey in which case there's nothing to compose — the temporal
//                 celebration IS the content).
//
// Temporal keys (`T:...`), grouped by season:
//   T:OT-<1-34>-<Sun|Mon|Tue|Wed|Thu|Fri|Sat>        Ordinary Time (readings vary by weekdayCycle
//                                                     on weekdays, sundayCycle on Sundays)
//   T:Lent-0-<Wed|Thu|Fri|Sat>                        Ash Wednesday through the following Saturday
//   T:Lent-<1-5>-<Sun|Mon|Tue|Wed|Thu|Fri|Sat>         Lent weeks 1-5 (Sunday-anchored block)
//   T:HolyWeek-<Sun|Mon|Tue|Wed>                       Palm Sunday .. Wednesday of Holy Week
//   T:Triduum-<Thu|Fri|Sat>                            Holy Thursday evening .. Holy Saturday (day)
//   T:Easter-<1-6>-<Sun|Mon|Tue|Wed|Thu|Fri|Sat>       Easter Sunday .. 6th week of Easter
//   T:Easter-7-<Mon|Tue|Wed|Thu|Fri|Sat>               weekdays between Ascension and Pentecost
//                                                       (the 7th Sunday itself is always Ascension
//                                                       in this calendar — the oracle never shows a
//                                                       "7th Sunday of Easter", confirming it
//                                                       unconditionally replaces that Sunday here)
//   T:Advent-<1-4>-<Sun|Mon|Tue|Wed|Thu|Fri|Sat>       Advent (Sunday-anchored block; week 4 is
//                                                       truncated by Christmas most years)
//   T:Christmas-<MM>-<DD>                              fixed-date Christmas-season propers whose
//                                                       identity is the civil date itself: Dec25
//                                                       (Day), Dec26-31 (octave days incl. the
//                                                       named ones), Jan1, and the "weekday before/
//                                                       after Epiphany" ferias (matches the plan's
//                                                       example T:Christmas-01-07)
//   T:Epiphany, T:Baptism, T:Ascension, T:Pentecost,
//   T:Trinity, T:CorpusChristi, T:SacredHeart, T:ChristKing, T:HolyFamily
//                                                       moveable solemnities of the Lord that carry
//                                                       their own complete propers (readings +
//                                                       orations both follow the solemnity itself,
//                                                       never composed against a suppressed feria)
//
// Sanctoral keys (`S:...`):
//   S:<MM>-<DD>           fixed-date entries from src/data/liturgy/sanctoral.ts, and the four
//                         civil-fixed Solemnities (São José 03-19, Natividade de São João Batista
//                         06-24, N.Sra. Aparecida 10-12, Imaculada Conceição 12-08) plus the
//                         Brazil-transferred ones (Anunciação 03-25, Assunção 08-15, Todos os
//                         Santos 11-01, Pedro e Paulo 06-29) keyed by their UNTRANSFERRED date
//                         regardless of which civil date they actually land on that year — the key
//                         is the celebration's identity, not its date.
//   S:rel:Easter+<n>      moveable sanctoral entries from SANCTORAL_MOVEABLE (currently just the
//                         Immaculate Heart of Mary, Easter+69)
//
// When a sanctoral celebration wins, `key` is its `S:...` form and `temporalKey` is still the
// full `T:...` identity of the day it displaced (so P2 can pull that feria's readings).

import { addDays, startOfDay } from 'date-fns'
import { adventStart, easterSunday } from '../liturgical.ts'
import { SANCTORAL_FIXED, SANCTORAL_MOVEABLE, type SanctoralRank } from '../../data/liturgy/sanctoral.ts'

export type LiturgicalColor = 'Branco' | 'Verde' | 'Vermelho' | 'Roxo' | 'Rosa'
export type LiturgicalSeason = 'Advent' | 'Christmas' | 'Lent' | 'Triduum' | 'Easter' | 'OrdinaryTime'
export type SundayCycle = 'A' | 'B' | 'C'
export type WeekdayCycle = 'I' | 'II'
export type LiturgicalRank = 'Triduum' | 'Solemnity' | 'Sunday' | 'Feast' | 'Memorial' | 'Feria'

export interface LiturgicalDay {
  date: Date
  season: LiturgicalSeason
  /** Week number within the season (OT 1-34, Lent 0-5, Easter 1-7, Advent 1-4). Null otherwise. */
  week: number | null
  /** 0=Sunday .. 6=Saturday (JS convention). */
  dayOfWeek: number
  sundayCycle: SundayCycle
  weekdayCycle: WeekdayCycle
  /** Display name reproducing the harvested API's pt-BR convention. */
  celebration: string
  rank: LiturgicalRank
  color: LiturgicalColor
  key: string
  temporalKey: string
}

const DOW = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const
type Dow = (typeof DOW)[number]

interface TemporalCandidate {
  season: LiturgicalSeason
  week: number | null
  key: string
  celebration: string
  rank: LiturgicalRank
  color: LiturgicalColor
  /** Can a sanctoral entry ever outrank this specific temporal slot, and at what floor rank? */
  impedable: 'none' | 'feastOrAbove' | 'memorialOrAbove'
}

interface Overlay {
  date: Date
  key: string
  celebration: string
  rank: LiturgicalRank
  color: LiturgicalColor
}

// ---------------------------------------------------------------------------------------------
// date arithmetic helpers
// ---------------------------------------------------------------------------------------------

function sameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate()
}

function dowOf(d: Date): Dow {
  return DOW[d.getDay()]
}

/** The Sunday on or before `d` (the Sunday-Saturday block containing `d`). */
function sundayOnOrBefore(d: Date): Date {
  return addDays(d, -d.getDay())
}

/** The next Sunday strictly after `d` (or `d` itself has no bearing — always moves forward). */
function nextSundayAfter(d: Date): Date {
  const dow = d.getDay()
  return addDays(d, dow === 0 ? 7 : 7 - dow)
}

/** The next Sunday on or after `d` (returns `d` unchanged if already Sunday). */
function nextSundayOnOrAfter(d: Date): Date {
  return d.getDay() === 0 ? d : addDays(d, 7 - d.getDay())
}

/** Nearest Sunday to `d` (bidirectional; ties never occur since a week has one Sunday). */
function nearestSunday(d: Date): Date {
  const dow = d.getDay()
  if (dow === 0) return d
  return dow <= 3 ? addDays(d, -dow) : addDays(d, 7 - dow)
}

/** Whole weeks between two Sundays (b - a, in units of 7 days). */
function sundayWeeksBetween(a: Date, b: Date): number {
  return Math.round((b.getTime() - a.getTime()) / (7 * 86400000))
}

// ---------------------------------------------------------------------------------------------
// moveable anchors
// ---------------------------------------------------------------------------------------------

/** Epiphany: the Sunday falling between Jan 2 and Jan 8 inclusive (Brazilian national calendar). */
function computeEpiphany(year: number): Date {
  for (let day = 2; day <= 8; day++) {
    const d = new Date(year, 0, day)
    if (d.getDay() === 0) return d
  }
  /* istanbul ignore next -- unreachable: a 7-day window always contains exactly one Sunday */
  throw new Error('unreachable')
}

/**
 * Baptism of the Lord: the Sunday after Epiphany, UNLESS Epiphany itself fell on Jan 7 or Jan 8
 * (i.e. as late as possible in its window), in which case Baptism moves to the following Monday
 * rather than waiting a further week. Oracle-confirmed for the Jan 7 case (2024); the Jan 8 case
 * doesn't occur 2024-2027 but follows the same documented universal-norms rule.
 */
function computeBaptism(epiphany: Date): Date {
  const day = epiphany.getDate()
  if (day === 7 || day === 8) return addDays(epiphany, 1)
  return addDays(epiphany, 7)
}

/** Holy Family: the Sunday within the Christmas octave (Dec 26-31), or Dec 30 if Christmas itself
 * is a Sunday. The Dec-25-is-Sunday branch doesn't occur 2024-2027 (UNVERIFIED by oracle) but is
 * the documented universal rule. */
function computeHolyFamily(year: number): Date {
  const christmas = new Date(year, 11, 25)
  if (christmas.getDay() === 0) return new Date(year, 11, 30)
  return nextSundayAfter(christmas)
}

/**
 * St Joseph (Mar 19): if it falls on a Sunday of Lent, transferred to the following Monday; if it
 * falls within Holy Week, anticipated to the Saturday before Palm Sunday. UNVERIFIED by the
 * oracle — Mar 19 never lands on a Sunday or within Holy Week in the 2024-2027 window — implemented
 * per the general universal norms for impeded solemnities.
 */
function stJosephDate(year: number, easter: Date): Date {
  const mar19 = new Date(year, 2, 19)
  const palmSunday = addDays(easter, -7)
  const holyThursday = addDays(easter, -3)
  if (mar19 >= palmSunday && mar19 < holyThursday) return addDays(palmSunday, -1)
  if (mar19.getDay() === 0) return addDays(mar19, 1)
  return mar19
}

/**
 * Annunciation (Mar 25): if impeded — falls on a Sunday of Lent, or anywhere from Palm Sunday
 * through the Saturday of the Easter octave — transferred to the Monday after the 2nd Sunday of
 * Easter (Divine Mercy Sunday). Oracle-confirmed both ways it can trigger: 2024 (fell in Holy Week
 * itself) and 2027 (fell on Holy Thursday) both land on that Monday.
 */
function annunciationDate(year: number, easter: Date): Date {
  const mar25 = new Date(year, 2, 25)
  const palmSunday = addDays(easter, -7)
  const octaveEnd = addDays(easter, 6)
  const ashWednesday = addDays(easter, -46)
  if (mar25 >= palmSunday && mar25 <= octaveEnd) return addDays(easter, 8)
  if (mar25 >= ashWednesday && mar25.getDay() === 0) return addDays(mar25, 1)
  return mar25
}

/** Assumption (Aug 15): if not already Sunday, transferred forward to the next Sunday. Confirmed
 * for Thu/Fri/Sat-of-Aug-15 across 2024-2026 (all three transfer forward, never backward — unlike
 * Sts Peter & Paul below, ruling out a "nearest Sunday" reading here). */
function assumptionDate(year: number): Date {
  return nextSundayOnOrAfter(new Date(year, 7, 15))
}

/**
 * All Saints (Nov 1): stays on its actual date if that's already Saturday or Sunday (forward
 * transfer would land on Nov 2, which is unconditionally All Souls — so no transfer happens);
 * otherwise transferred forward to the next Sunday. Confirmed: 2024 (Fri -> Nov 3), 2025
 * (Sat -> stays Nov 1), 2026 (Sun -> stays Nov 1).
 */
function allSaintsDate(year: number): Date {
  const nov1 = new Date(year, 10, 1)
  const dow = nov1.getDay()
  if (dow === 0 || dow === 6) return nov1
  return nextSundayOnOrAfter(nov1)
}

/** Sts Peter & Paul (Jun 29): transferred to the NEAREST Sunday (bidirectional) when not already
 * Sunday. Confirmed both directions: 2024 (Sat -> forward to Jun 30), 2026 (Mon -> backward to
 * Jun 28). This is the one transfer of the four that is genuinely nearest-Sunday, not forward-only. */
function peterPaulDate(year: number): Date {
  return nearestSunday(new Date(year, 5, 29))
}

// ---------------------------------------------------------------------------------------------
// sanctoral lookup
// ---------------------------------------------------------------------------------------------

interface SanctoralHit {
  name: string
  rank: SanctoralRank
  color: LiturgicalColor
  outranksSunday: boolean
  key: string
}

function lookupSanctoral(d: Date, easter: Date): SanctoralHit | null {
  // Moveable entries are checked first: on the rare year a moveable memorial's date coincides
  // with a fixed one (e.g. the Immaculate Heart of Mary landing on Jun 28, Santo Irineu's fixed
  // date, in 2025), the oracle shows the moveable entry winning.
  const dayOffset = Math.round((startOfDay(d).getTime() - easter.getTime()) / 86400000)
  const moveable = SANCTORAL_MOVEABLE.find((e) => e.offsetFromEaster === dayOffset)
  if (moveable) {
    return {
      name: moveable.name,
      rank: moveable.rank,
      color: moveable.color,
      outranksSunday: false,
      key: `S:rel:Easter+${moveable.offsetFromEaster}`,
    }
  }
  const month = d.getMonth() + 1
  const day = d.getDate()
  const fixed = SANCTORAL_FIXED.find((e) => e.month === month && e.day === day)
  if (fixed) {
    return {
      name: fixed.name,
      rank: fixed.rank,
      color: fixed.color,
      outranksSunday: fixed.outranksSunday ?? false,
      key: `S:${String(fixed.month).padStart(2, '0')}-${String(fixed.day).padStart(2, '0')}`,
    }
  }
  return null
}

/** Resolve a non-overlay day: does a sanctoral hit outrank the plain temporal candidate? */
function resolvePrecedence(
  temporal: TemporalCandidate,
  hit: SanctoralHit | null,
): { key: string; celebration: string; rank: LiturgicalRank; color: LiturgicalColor } {
  const temporalResult = { key: temporal.key, celebration: temporal.celebration, rank: temporal.rank, color: temporal.color }
  if (!hit || temporal.impedable === 'none') return temporalResult

  if (temporal.impedable === 'feastOrAbove') {
    if (hit.rank === 'Feast' || hit.rank === 'Solemnity') {
      return { key: hit.key, celebration: hit.name, rank: hit.rank, color: hit.color }
    }
    return temporalResult
  }

  // memorialOrAbove: any sanctoral entry wins over an ordinary feria...
  if (temporal.rank !== 'Sunday') {
    return { key: hit.key, celebration: hit.name, rank: hit.rank, color: hit.color }
  }
  // ...but against a Sunday of Ordinary Time/Christmas, only a Solemnity or an explicit
  // outranksSunday Feast (Feasts of the Lord; the All Souls commemoration) wins — an ordinary
  // Feast or Memorial is simply omitted that year.
  if (hit.rank === 'Solemnity' || hit.outranksSunday) {
    return { key: hit.key, celebration: hit.name, rank: hit.rank, color: hit.color }
  }
  return temporalResult
}

// ---------------------------------------------------------------------------------------------
// cycles
// ---------------------------------------------------------------------------------------------

const SUNDAY_CYCLES: readonly SundayCycle[] = ['A', 'B', 'C']

function sundayCycleOf(adventStartYear: number): SundayCycle {
  return SUNDAY_CYCLES[((adventStartYear % 3) + 3) % 3]
}

function weekdayCycleOf(adventStartYear: number): WeekdayCycle {
  return adventStartYear % 2 === 0 ? 'I' : 'II'
}

// ---------------------------------------------------------------------------------------------
// Portuguese display-name templates (reproducing the harvested API's own convention)
// ---------------------------------------------------------------------------------------------

const PT_WEEKDAY: Record<Dow, string> = {
  Sun: 'Domingo',
  Mon: '2ª feira',
  Tue: '3ª feira',
  Wed: '4ª feira',
  Thu: '5ª feira',
  Fri: '6ª feira',
  Sat: 'Sábado',
}

/** "{weekday} da {week}ª Semana {seasonNoun}", e.g. "4ª feira da 16ª Semana do Tempo Comum". */
function feriaName(dow: Dow, week: number, seasonNoun: string): string {
  return `${PT_WEEKDAY[dow]} da ${week}ª Semana ${seasonNoun}`
}

// ---------------------------------------------------------------------------------------------
// temporal candidate builders (one per season stretch)
// ---------------------------------------------------------------------------------------------

function otCandidate(week: number, d: Date): TemporalCandidate {
  const dow = dowOf(d)
  const isSunday = dow === 'Sun'
  return {
    season: 'OrdinaryTime',
    week,
    key: `T:OT-${week}-${dow}`,
    celebration: isSunday ? `${week}º Domingo do Tempo Comum` : feriaName(dow, week, 'do Tempo Comum'),
    rank: isSunday ? 'Sunday' : 'Feria',
    color: 'Verde',
    impedable: 'memorialOrAbove',
  }
}

function winterStretch(d: Date, y: number, epiphany: Date, baptism: Date): TemporalCandidate {
  // Jan 1 .. day before Ash Wednesday: Christmas tail (through Baptism) then OT part 1.
  if (sameDay(d, new Date(y, 0, 1))) {
    return {
      season: 'Christmas',
      week: null,
      key: 'T:Christmas-01-01',
      celebration: 'Santa Maria, Mãe de Deus, Solenidade',
      rank: 'Solemnity',
      color: 'Branco',
      impedable: 'none',
    }
  }
  if (d <= baptism) {
    const mm = String(d.getMonth() + 1).padStart(2, '0')
    const dd = String(d.getDate()).padStart(2, '0')
    const dow = dowOf(d)
    const side = d < epiphany ? 'antes' : 'depois'
    return {
      season: 'Christmas',
      week: null,
      key: `T:Christmas-${mm}-${dd}`,
      celebration: `${PT_WEEKDAY[dow]} do Tempo do Natal ${side} da Epifania`,
      rank: 'Feria',
      color: 'Branco',
      impedable: 'memorialOrAbove',
    }
  }
  // Ordinary Time part 1: week 2 starts the first Sunday after Baptism.
  const firstSunday = nextSundayAfter(baptism)
  const blockSunday = sundayOnOrBefore(d)
  const week = d < firstSunday ? 1 : 2 + sundayWeeksBetween(firstSunday, blockSunday)
  return otCandidate(week, d)
}

function lentCandidate(d: Date, easter: Date): TemporalCandidate {
  const ash = addDays(easter, -46)
  if (d < nextSundayAfter(ash)) {
    const dow = dowOf(d)
    return {
      season: 'Lent',
      week: 0,
      key: `T:Lent-0-${dow}`,
      celebration: sameDay(d, ash) ? 'Quarta-feira de Cinzas' : `${PT_WEEKDAY[dow]} depois das Cinzas`,
      rank: 'Feria',
      color: 'Roxo',
      impedable: 'none',
    }
  }
  const blockSunday = sundayOnOrBefore(d)
  const week1Sunday = addDays(easter, -42)
  const week = 1 + sundayWeeksBetween(week1Sunday, blockSunday)
  const dow = dowOf(d)
  const isSunday = dow === 'Sun'
  return {
    season: 'Lent',
    week,
    key: `T:Lent-${week}-${dow}`,
    celebration: isSunday ? `${week}º Domingo da Quaresma` : feriaName(dow, week, 'da Quaresma'),
    rank: isSunday ? 'Sunday' : 'Feria',
    // 4th Sunday of Lent ("Laetare") permits rose vestments.
    color: isSunday && week === 4 ? 'Rosa' : 'Roxo',
    impedable: isSunday ? 'none' : 'feastOrAbove',
  }
}

function holyWeekEarly(d: Date): TemporalCandidate {
  const dow = dowOf(d)
  return {
    season: 'Lent',
    week: null,
    key: `T:HolyWeek-${dow}`,
    celebration: dow === 'Sun' ? 'Domingo de Ramos da Paixão do Senhor' : `${PT_WEEKDAY[dow]} da Semana Santa`,
    rank: dow === 'Sun' ? 'Sunday' : 'Feria',
    color: dow === 'Sun' ? 'Vermelho' : 'Roxo',
    impedable: 'none',
  }
}

const TRIDUUM_NAMES: Record<string, string> = {
  Thu: '5ª feira da Semana Santa - Missa Vespertina da Ceia do Senhor',
  Fri: '6ª feira da Paixão do Senhor',
  Sat: 'Sábado Santo - Vigília Pascal',
}

function triduum(d: Date): TemporalCandidate {
  const dow = dowOf(d)
  return {
    season: 'Triduum',
    week: null,
    key: `T:Triduum-${dow}`,
    celebration: TRIDUUM_NAMES[dow] ?? dow,
    rank: 'Triduum',
    color: dow === 'Fri' ? 'Vermelho' : 'Branco',
    impedable: 'none',
  }
}

function easterCandidate(d: Date, easter: Date, ascensionSunday: Date, pentecost: Date): TemporalCandidate {
  const dow = dowOf(d)
  if (sameDay(d, pentecost)) {
    return {
      season: 'Easter',
      week: null,
      key: 'T:Pentecost',
      celebration: 'Domingo de Pentecostes, Solenidade',
      rank: 'Solemnity',
      color: 'Vermelho',
      impedable: 'none',
    }
  }
  if (sameDay(d, ascensionSunday)) {
    return {
      season: 'Easter',
      week: 7,
      key: 'T:Ascension',
      celebration: 'Ascensão do Senhor, Solenidade',
      rank: 'Solemnity',
      color: 'Branco',
      impedable: 'none',
    }
  }
  const blockSunday = sundayOnOrBefore(d)
  const week = 1 + sundayWeeksBetween(easter, blockSunday)
  const isSunday = dow === 'Sun'
  let celebration: string
  if (isSunday) {
    if (week === 1) celebration = 'Domingo da Páscoa na Ressurreição do Senhor'
    else if (week === 2) celebration = '2º Domingo da Páscoa ou Domingo da Divina Misericórdia'
    else celebration = `${week}º Domingo da Páscoa`
  } else if (week === 1) {
    celebration = `${PT_WEEKDAY[dow]} na Oitava da Páscoa`
  } else {
    celebration = feriaName(dow, week, 'da Páscoa')
  }
  return {
    season: 'Easter',
    week,
    key: `T:Easter-${week}-${dow}`,
    celebration,
    rank: isSunday ? 'Sunday' : 'Feria',
    color: 'Branco',
    // The Easter octave (week 1) is fully privileged, like Holy Week — nothing sanctoral can
    // impede it. Ordinary Easter-season weekdays after the octave (weeks 2-6) are lower privilege.
    impedable: isSunday || week === 1 ? 'none' : 'memorialOrAbove',
  }
}

function otPart2Candidate(d: Date, christKing: Date): TemporalCandidate {
  const blockSunday = sundayOnOrBefore(d)
  // 34 (Christ the King's own block) minus the whole-week gap to it — sundayWeeksBetween counts
  // the gap BETWEEN Sundays, not an inclusive day-count, so the constant here is 34 not 35.
  const week = 34 - sundayWeeksBetween(blockSunday, christKing)
  return otCandidate(week, d)
}

function adventCandidate(d: Date, adventStartY: Date): TemporalCandidate {
  const blockSunday = sundayOnOrBefore(d)
  const week = 1 + sundayWeeksBetween(adventStartY, blockSunday)
  const dow = dowOf(d)
  const isSunday = dow === 'Sun'
  const privileged = d.getDate() >= 17 && d.getMonth() === 11
  return {
    season: 'Advent',
    week,
    key: `T:Advent-${week}-${dow}`,
    celebration: isSunday ? `${week}º Domingo do Advento` : feriaName(dow, week, 'do Advento'),
    rank: isSunday ? 'Sunday' : 'Feria',
    // 3rd Sunday of Advent ("Gaudete") permits rose vestments.
    color: isSunday && week === 3 ? 'Rosa' : 'Roxo',
    impedable: isSunday ? 'none' : privileged ? 'feastOrAbove' : 'memorialOrAbove',
  }
}

const CHRISTMAS_OCTAVE_NAMES: Record<number, { name: string; color: LiturgicalColor; rank: LiturgicalRank }> = {
  25: { name: 'Natal de Nosso Senhor Jesus Cristo, Solenidade', color: 'Branco', rank: 'Solemnity' },
  26: { name: 'Santo Estêvão, Protomártir, Festa', color: 'Vermelho', rank: 'Feast' },
  27: { name: 'São João, Apóstolo e Evangelista, Festa', color: 'Branco', rank: 'Feast' },
  28: { name: 'Os Santos Inocentes, Mártires, Festa', color: 'Vermelho', rank: 'Feast' },
  29: { name: '5º Dia na Oitava do Natal', color: 'Branco', rank: 'Feria' },
  30: { name: '6º Dia na Oitava do Natal', color: 'Branco', rank: 'Feria' },
  31: { name: '7º Dia na Oitava do Natal', color: 'Branco', rank: 'Feria' },
}

function christmasOctave(d: Date, holyFamily: Date): TemporalCandidate {
  if (sameDay(d, holyFamily)) {
    return {
      season: 'Christmas',
      week: null,
      key: 'T:HolyFamily',
      celebration: 'Sagrada Família de Jesus, Maria e José, Festa',
      rank: 'Feast',
      color: 'Branco',
      impedable: 'none',
    }
  }
  const day = d.getDate()
  const entry = CHRISTMAS_OCTAVE_NAMES[day]
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(day).padStart(2, '0')
  return {
    season: 'Christmas',
    week: null,
    key: `T:Christmas-${mm}-${dd}`,
    celebration: entry.name,
    rank: entry.rank,
    color: entry.color,
    impedable: 'none',
  }
}

// ---------------------------------------------------------------------------------------------
// main entry point
// ---------------------------------------------------------------------------------------------

export function liturgicalDay(date: Date): LiturgicalDay {
  const d = startOfDay(date)
  const y = d.getFullYear()
  const t = d.getTime()

  const easter = easterSunday(y)
  const ash = addDays(easter, -46)
  const palmSunday = addDays(easter, -7)
  const holyThursday = addDays(easter, -3)
  const holySaturday = addDays(easter, -1)
  const ascensionSunday = addDays(easter, 42)
  const pentecost = addDays(easter, 49)
  const trinitySunday = addDays(easter, 56)
  const corpusChristi = addDays(easter, 60)
  const sacredHeart = addDays(easter, 68)
  const adventStartY = adventStart(y)
  const christKing = addDays(adventStartY, -7)

  const epiphany = computeEpiphany(y)
  const baptism = computeBaptism(epiphany)
  const holyFamily = computeHolyFamily(y)

  // -- overlays: celebrations that always win outright once their (possibly transferred) date is
  //    fixed for the year. Checked before any season/sanctoral logic. --
  const stJoseph = SANCTORAL_FIXED.find((e) => e.month === 3 && e.day === 19)!
  const nativityJohnBaptist = SANCTORAL_FIXED.find((e) => e.month === 6 && e.day === 24)!
  const aparecida = SANCTORAL_FIXED.find((e) => e.month === 10 && e.day === 12)!
  const immaculateConception = SANCTORAL_FIXED.find((e) => e.month === 12 && e.day === 8)!

  const overlays: Overlay[] = [
    { date: stJosephDate(y, easter), key: 'S:03-19', celebration: stJoseph.name, rank: 'Solemnity', color: stJoseph.color },
    { date: annunciationDate(y, easter), key: 'S:03-25', celebration: 'Anunciação do Senhor, Solenidade', rank: 'Solemnity', color: 'Branco' },
    { date: new Date(y, 5, 24), key: 'S:06-24', celebration: nativityJohnBaptist.name, rank: 'Solemnity', color: nativityJohnBaptist.color },
    { date: peterPaulDate(y), key: 'S:06-29', celebration: 'Santos Pedro e Paulo Apóstolos, Solenidade', rank: 'Solemnity', color: 'Vermelho' },
    { date: assumptionDate(y), key: 'S:08-15', celebration: 'Assunção da Bem-aventurada Virgem Maria, Solenidade', rank: 'Solemnity', color: 'Branco' },
    { date: new Date(y, 9, 12), key: 'S:10-12', celebration: aparecida.name, rank: 'Solemnity', color: aparecida.color },
    { date: allSaintsDate(y), key: 'S:11-01', celebration: 'Todos os Santos, Solenidade', rank: 'Solemnity', color: 'Branco' },
    { date: new Date(y, 11, 8), key: 'S:12-08', celebration: immaculateConception.name, rank: 'Solemnity', color: immaculateConception.color },
    { date: epiphany, key: 'T:Epiphany', celebration: 'Epifania do Senhor, Solenidade', rank: 'Solemnity', color: 'Branco' },
    { date: baptism, key: 'T:Baptism', celebration: 'Batismo do Senhor, Festa', rank: 'Feast', color: 'Branco' },
    { date: trinitySunday, key: 'T:Trinity', celebration: 'Santíssima Trindade, Solenidade', rank: 'Solemnity', color: 'Branco' },
    { date: corpusChristi, key: 'T:CorpusChristi', celebration: 'Santíssimo Corpo e Sangue de Cristo, Solenidade', rank: 'Solemnity', color: 'Branco' },
    { date: sacredHeart, key: 'T:SacredHeart', celebration: 'Sagrado Coração de Jesus, Solenidade', rank: 'Solemnity', color: 'Branco' },
    { date: christKing, key: 'T:ChristKing', celebration: 'Nosso Senhor Jesus Cristo, Rei do Universo, Solenidade', rank: 'Solemnity', color: 'Branco' },
    // Christmas Eve: the Vigil Mass content unconditionally replaces whatever Advent-4 feria
    // would otherwise fall on Dec 24, regardless of weekday.
    { date: new Date(y, 11, 24), key: 'T:Christmas-12-24', celebration: 'Natal do Senhor (Missa da Noite)', rank: 'Solemnity', color: 'Branco' },
  ]

  const overlay = overlays.find((o) => sameDay(o.date, d))

  // The underlying temporal feria is ALWAYS computed, even under an overlay/sanctoral winner —
  // downstream content lookup needs it (see header comment).
  let temporal: TemporalCandidate
  if (t < ash.getTime()) {
    temporal = winterStretch(d, y, epiphany, baptism)
  } else if (t < palmSunday.getTime()) {
    temporal = lentCandidate(d, easter)
  } else if (t < holyThursday.getTime()) {
    temporal = holyWeekEarly(d)
  } else if (t <= holySaturday.getTime()) {
    temporal = triduum(d)
  } else if (t <= pentecost.getTime()) {
    temporal = easterCandidate(d, easter, ascensionSunday, pentecost)
  } else if (t < adventStartY.getTime()) {
    temporal = otPart2Candidate(d, christKing)
  } else if (t <= new Date(y, 11, 24).getTime()) {
    temporal = adventCandidate(d, adventStartY)
  } else {
    temporal = christmasOctave(d, holyFamily)
  }

  const adventStartYear = t >= adventStartY.getTime() ? y : y - 1
  const sundayCycle = sundayCycleOf(adventStartYear)
  const weekdayCycle = weekdayCycleOf(adventStartYear)

  if (overlay) {
    return {
      date: d,
      season: temporal.season,
      week: temporal.week,
      dayOfWeek: d.getDay(),
      sundayCycle,
      weekdayCycle,
      celebration: overlay.celebration,
      rank: overlay.rank,
      color: overlay.color,
      key: overlay.key,
      temporalKey: temporal.key,
    }
  }

  const hit = lookupSanctoral(d, easter)
  const winner = resolvePrecedence(temporal, hit)

  return {
    date: d,
    season: temporal.season,
    week: temporal.week,
    dayOfWeek: d.getDay(),
    sundayCycle,
    weekdayCycle,
    celebration: winner.celebration,
    rank: winner.rank,
    color: winner.color,
    key: winner.key,
    temporalKey: temporal.key,
  }
}
