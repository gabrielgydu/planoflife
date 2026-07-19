// Content-key derivation for the liturgy propers store (LITURGY_PLAN.md §B/§D).
//
// THE ONE RULE, encoded here once and imported by both scripts/liturgy/build-propers.mjs
// (Node, builds the store) and ../liturgy.ts (the runtime loader) — never duplicated.
//
// Empirically derived from scripts/liturgy/.cache/api/*.json (1244 days, 2024-01-01..2027-05-31),
// restricted to days where a plain temporal candidate won outright (day.key === day.temporalKey,
// so the actual API payload is that candidate's own unmodified content — see the build report for
// the check script and counts):
//
//  - READINGS vary with sundayCycle (A/B/C) on every `*-Sun` temporal key, and with weekdayCycle
//    (I/II) on Ordinary Time weekdays (`T:OT-<n>-<Mon..Sat>`) — 89-100% agreement within a cycle
//    once trivial whitespace/verse-letter harvest-noise is normalized away. Lent/Advent/Easter/
//    Christmas WEEKDAYS are cycle-INVARIANT (a fixed one-year sequence) — matches the Roman
//    Lectionary's actual structure (only OT weekdays run a two-year cycle). The nine moveable
//    solemnities of the Lord that "carry their own complete propers" over whatever temporal feria
//    they displace (Epiphany, Baptism, Trinity, Corpus Christi, Sacred Heart, Christ the King,
//    Ascension, Pentecost, Holy Family) vary by sundayCycle too, keyed off their OWN `key`, not the
//    suppressed temporal feria's.
//  - ORAÇÕES (coleta/oferendas/comunhão) and ANTÍFONAS do NOT vary by cycle at all — confirmed for
//    Sundays (41/43 temporalKeys byte-identical across every harvested sundayCycle), sanctoral
//    memorials (100/103 S:-keys identical across every harvested year), and OT weekdays (~90%;
//    the residual ~10% is the source rotating through a handful of interchangeable generic ferial
//    collects for slots with no proper of their own — not a cycle correlation, confirmed by
//    same-cycle years still disagreeing). So propersKey never needs a cycle suffix or fallback.
//
// On a day a sanctoral celebration wins (`key !== temporalKey`), the Mass READINGS still follow
// the underlying temporal feria (hence keyed off `temporalKey`, cycle-suffixed per the above),
// while orações/antífonas follow the saint (`key`, no suffix) — see calendar.ts's own header
// comment, which this rule composes with.

import type { LiturgicalDay, SundayCycle, WeekdayCycle } from '../../utils/liturgy/calendar.ts'

/** Moveable solemnities of the Lord whose own readings vary by sundayCycle A/B/C, displacing
 * whatever temporal feria they land on rather than composing with it. Verified empirically
 * (scripts/liturgy build report): within a given sundayCycle these 9 keys' readings are
 * byte-identical across every harvested year, and differ from year to year in lockstep with
 * sundayCycle (T:Baptism confirmed only once its own Sunday-vs-transferred-Monday format quirk is
 * controlled for). */
const LORD_SOLEMNITY_ABC_KEYS = new Set([
  'T:Epiphany',
  'T:Baptism',
  'T:Trinity',
  'T:CorpusChristi',
  'T:SacredHeart',
  'T:ChristKing',
  'T:Ascension',
  'T:Pentecost',
  'T:HolyFamily',
])

/** The other calendar.ts `overlays` entries (the ones that "always win outright") whose readings
 * are ALSO their own fixed, complete propers rather than the displaced feria's — confirmed
 * empirically: e.g. S:03-19 (São José) shows byte-identical readings across four years that
 * displaced four DIFFERENT Lent ferias (T:Lent-5-Tue, T:Lent-2-Wed, T:Lent-4-Thu, T:Lent-5-Fri),
 * proving the content follows the solemnity, not the feria. Unlike the ABC set above these don't
 * vary by cycle either (single content version regardless of sundayCycle in every harvested case
 * except S:12-08, Immaculate Conception, whose 3 harvested years disagree for reasons the corpus
 * doesn't explain — dedup picks a canonical version and the disagreement is reported by
 * build-propers.mjs like any other). T:Christmas-12-24 (Christmas Eve Vigil Mass) is the one
 * non-`S:` member — also always-wins, also fixed. */
const OVERLAY_FIXED_KEYS = new Set([
  'S:03-19',
  'S:03-25',
  'S:06-24',
  'S:06-29',
  'S:08-15',
  'S:10-12',
  'S:11-01',
  'S:12-08',
  'T:Christmas-12-24',
])

/**
 * Ordinary sanctoral Memorials/Feasts (i.e. NOT the always-win overlays above — these still lose
 * to a Sunday/privileged feria per the normal precedence table) that nonetheless carry their OWN
 * proper Mass readings rather than inheriting the displaced feria's, e.g. evangelists/apostles
 * with a reading about their calling. This is a genuinely per-saint fact with no derivable pattern
 * from rank alone (both "FIXED" and "follows the feria" occur at every rank, Memorial through
 * Feast) — mined the same way sanctoral.ts's table was: for every `S:`/`S:rel:` key that displaced
 * two or more DIFFERENT temporal ferias across the harvest, checked whether the actual reading
 * content stayed constant (proper) or tracked each year's different feria (no proper). 29 keys
 * classified FIXED this way, 65 FOLLOWS-FERIA, 0 ambiguous; 5 single-harvested-occurrence keys
 * default to follows-feria (the statistically dominant behavior) for lack of repeat evidence. See
 * scripts/liturgy/build-propers.mjs's dedup report for the full readings pool this produced.
 */
const SANCTORAL_FIXED_READINGS_KEYS = new Set([
  'S:01-25',
  'S:01-26',
  'S:02-02',
  'S:02-22',
  'S:04-25',
  'S:05-03',
  'S:05-14',
  'S:05-31',
  'S:06-11',
  'S:07-03',
  'S:07-16',
  'S:07-22',
  'S:07-25',
  'S:07-26',
  'S:07-29',
  'S:08-10',
  'S:08-22',
  'S:08-23',
  'S:08-24',
  'S:08-29',
  'S:09-15',
  'S:09-21',
  'S:10-02',
  'S:10-18',
  'S:10-28',
  'S:11-21',
  'S:12-12',
  'S:rel:Easter+50',
  'S:rel:Easter+69',
])

const OT_WEEKDAY_RE = /^T:OT-\d+-(Mon|Tue|Wed|Thu|Fri|Sat)$/

const SUNDAY_CYCLES: readonly SundayCycle[] = ['A', 'B', 'C']
const WEEKDAY_CYCLES: readonly WeekdayCycle[] = ['I', 'II']

/** Epiphany: the Sunday falling between Jan 2 and Jan 8 inclusive — reproduces calendar.ts's own
 * `computeEpiphany` (not importable; that module exports only `liturgicalDay` and types). Needed
 * here only to re-derive the two civil-calendar-relative readings sequences below. */
function epiphanySunday(year: number): Date {
  for (let day = 2; day <= 8; day++) {
    const d = new Date(year, 0, day)
    if (d.getDay() === 0) return d
  }
  /* istanbul ignore next -- unreachable, same as calendar.ts's computeEpiphany */
  throw new Error('unreachable')
}

/**
 * `T:Christmas-MM-DD` (calendar.ts's key for the whole Christmas-tail winter stretch) is a plain
 * civil-date key, but Epiphany's OWN date is moveable (Jan 2-8) — so the same civil date, e.g.
 * Jan 4, is a genuinely different feria in a year where Epiphany already passed (an "after
 * Epiphany" weekday) than in a year where it hasn't (a "before Epiphany" weekday). Verified
 * empirically: BEFORE Epiphany, content tracks the plain civil date exactly as calendar.ts already
 * keys it (no fix needed — confirmed once the after-Epiphany years are pulled out); AFTER
 * Epiphany, content tracks the OFFSET FROM EPIPHANY, not the civil date (Epiphany+1 is
 * byte-identical every harvested year despite landing on a different civil date each time). This
 * derives that offset key for the after-Epiphany case only; returns null (meaning: use the plain
 * temporalKey, already correct) for everything else, including Epiphany itself (its own overlay
 * key, never reaches this function) and the Dec 25-31 octave (a separately-stable, genuinely
 * civil-date-fixed sequence — confirmed empirically, not touched here).
 */
function christmasPostEpiphanyOverrideKey(tk: string, date: Date): string | null {
  if (!tk.startsWith('T:Christmas-01-') || tk === 'T:Christmas-01-01') return null
  const epiphany = epiphanySunday(date.getFullYear())
  if (date.getTime() <= epiphany.getTime()) return null
  const offset = Math.round((date.getTime() - epiphany.getTime()) / 86400000)
  return `T:Christmas-postEpiph-${offset}`
}

/**
 * The PROPERS-side counterpart: unlike readings (civil-date-keyed before Epiphany, offset-keyed
 * only after — see above), orações for this stretch are offset-from-Epiphany-keyed on BOTH sides,
 * confirmed empirically the same way (grouped by offset, every harvested oracoes.coleta agrees;
 * grouped by the plain civil-date key, years on opposite sides of a moveable Epiphany disagree).
 * Different key SCHEME from the readings override above, but that's fine — readings and propers
 * are separate pools with independent manifests, no collision risk.
 */
function christmasEpiphanyOffsetPropersKey(key: string, date: Date): string | null {
  if (!key.startsWith('T:Christmas-01-') || key === 'T:Christmas-01-01') return null
  const epiphany = epiphanySunday(date.getFullYear())
  const offset = Math.round((date.getTime() - epiphany.getTime()) / 86400000)
  if (offset === 0) return null // Epiphany itself: its own overlay key, never reaches here
  return offset < 0 ? `T:Christmas-preEpiph-${-offset}` : `T:Christmas-postEpiph-${offset}`
}

/**
 * The "O Antiphons" period, Dec 17-24: real Lectionary readings for these eight days are keyed to
 * the specific CIVIL DATE, independent of which numbered Advent week they happen to fall in that
 * year (Advent's start date itself moves, Nov 27-Dec 3, so "3rd week Thursday" lands on a
 * different Dec date every year while Dec 17's reading stays the same) — but calendar.ts's
 * `T:Advent-<week>-<weekday>` key conflates the two systems. Verified empirically: grouped by
 * civil date instead of by week/weekday, Dec 17-24 agree across every harvested year; grouped by
 * week/weekday they don't. Sundays are excluded — a Sunday of Advent (even the 4th, which can
 * itself land inside this window) always keeps its ordinary ABC Sunday readings, never the
 * date-specific weekday propers.
 */
function adventLateOverrideKey(tk: string, date: Date): string | null {
  if (!tk.startsWith('T:Advent-') || tk.endsWith('-Sun')) return null
  if (date.getMonth() !== 11) return null
  const dd = date.getDate()
  if (dd < 17 || dd > 24) return null
  return `T:Advent-late-${String(dd).padStart(2, '0')}`
}

/** The base identity (no cycle suffix) whose READINGS this day uses: the winning celebration's
 * own `key` when it's a Lord solemnity, an always-win overlay, or a saint with a proper reading of
 * their own; the civil-calendar-relative override for the two moveable-boundary stretches above;
 * otherwise the underlying temporal feria (covers plain temporal days AND ordinary memorials/
 * feasts that borrow the feria's readings). */
function readingsBaseKey(day: Pick<LiturgicalDay, 'key' | 'temporalKey' | 'date'>): string {
  if (LORD_SOLEMNITY_ABC_KEYS.has(day.key) || OVERLAY_FIXED_KEYS.has(day.key) || SANCTORAL_FIXED_READINGS_KEYS.has(day.key)) {
    return day.key
  }
  return (
    christmasPostEpiphanyOverrideKey(day.temporalKey, day.date) ?? adventLateOverrideKey(day.temporalKey, day.date) ?? day.temporalKey
  )
}

/**
 * Every readings-pool key this day could resolve to, most-specific first: the exact
 * cycle-suffixed key for today's actual cycle, then the sibling cycle variant(s) (fallback for a
 * liturgical identity the finite harvest never hit in that exact cycle — see coverage-report.mjs),
 * then the bare base key with no suffix at all (defensive; only matters for a base that turns out
 * to carry no cycle dependence). Bare `readingsKeyFor` is always variants[0].
 */
export function readingsKeyVariants(day: Pick<LiturgicalDay, 'key' | 'temporalKey' | 'sundayCycle' | 'weekdayCycle' | 'date'>): string[] {
  const base = readingsBaseKey(day)
  if (base.endsWith('-Sun') || LORD_SOLEMNITY_ABC_KEYS.has(base)) {
    const ordered = [day.sundayCycle, ...SUNDAY_CYCLES.filter((c) => c !== day.sundayCycle)]
    return [...ordered.map((c) => `${base}|${c}`), base]
  }
  if (OT_WEEKDAY_RE.test(base)) {
    const ordered = [day.weekdayCycle, ...WEEKDAY_CYCLES.filter((c) => c !== day.weekdayCycle)]
    return [...ordered.map((c) => `${base}|${c}`), base]
  }
  return [base]
}

/** The single readings-pool key this day resolves to exactly (no fallback). */
export function readingsKeyFor(day: Pick<LiturgicalDay, 'key' | 'temporalKey' | 'sundayCycle' | 'weekdayCycle' | 'date'>): string {
  return readingsKeyVariants(day)[0]
}

/**
 * The propers-pool key (orações + antífonas): the winning celebration's own identity, `key` —
 * never cycle-suffixed, never needs a cycle fallback variant (see header comment) — EXCEPT the
 * same two civil-calendar-relative stretches readingsKeyFor overrides, which also destabilize
 * orações when keyed by the plain civil-date `key` calendar.ts produces (confirmed empirically:
 * oracoes.coleta agrees 100% grouped by offset-from-Epiphany or by Dec 17-24 civil date, not
 * grouped by the plain T:Christmas-01-DD/T:Advent-<week>-<weekday> key). Only fires when the
 * WINNING celebration is itself that plain temporal identity — a sanctoral memorial's `key` is
 * already the saint's own stable identity and is left untouched.
 */
export function propersKeyFor(day: Pick<LiturgicalDay, 'key' | 'date'>): string {
  return christmasEpiphanyOffsetPropersKey(day.key, day.date) ?? adventLateOverrideKey(day.key, day.date) ?? day.key
}

const SEASON_PREFIXES: Array<[string, string]> = [
  ['T:OT-', 'ot'],
  ['T:Lent-', 'lent'],
  ['T:Advent-', 'advent'],
  ['T:Easter-', 'easter'],
  ['T:HolyWeek-', 'holyweek'],
  ['T:Triduum-', 'holyweek'],
  ['T:Christmas-', 'christmas'],
]

const SEASON_EXACT: Record<string, string> = {
  'T:Epiphany': 'christmas',
  'T:Baptism': 'christmas',
  'T:HolyFamily': 'christmas',
  'T:Trinity': 'ot',
  'T:CorpusChristi': 'ot',
  'T:SacredHeart': 'ot',
  'T:ChristKing': 'ot',
  'T:Ascension': 'easter',
  'T:Pentecost': 'easter',
}

/**
 * Which generated chunk a (possibly cycle-suffixed) content key lives in. Sanctoral propers
 * (`S:MM-DD`, `S:rel:Easter+n`) get their own chunk since they're looked up independently of the
 * season a memorial's readings fall in.
 */
export function chunkIdForKey(key: string): string {
  const base = key.split('|')[0]
  if (base.startsWith('S:')) return 'sanctoral'
  if (SEASON_EXACT[base]) return SEASON_EXACT[base]
  for (const [prefix, chunk] of SEASON_PREFIXES) {
    if (base.startsWith(prefix)) return chunk
  }
  return 'other'
}
