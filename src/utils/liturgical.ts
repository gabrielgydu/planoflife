import { addDays, startOfDay } from 'date-fns'

// Movable-feast math for the liturgical content swaps (Ângelus ↔ Regina Coeli,
// seasonal Marian antiphon). Pure functions of the date passed in — callers
// always hand over the *viewed* date, never "now".

/** Easter Sunday (Gregorian) for a year — Butcher's computus. */
export function easterSunday(year: number): Date {
  const a = year % 19
  const b = Math.floor(year / 100)
  const c = year % 100
  const d = Math.floor(b / 4)
  const e = b % 4
  const f = Math.floor((b + 8) / 25)
  const g = Math.floor((b - f + 1) / 3)
  const h = (19 * a + b - d - g + 15) % 30
  const i = Math.floor(c / 4)
  const k = c % 4
  const l = (32 + 2 * e + 2 * i - h - k) % 7
  const m = Math.floor((a + 11 * h + 22 * l) / 451)
  const month = Math.floor((h + l - 7 * m + 114) / 31) // 3=March, 4=April
  const day = ((h + l - 7 * m + 114) % 31) + 1
  return new Date(year, month - 1, day)
}

export function pentecostSunday(year: number): Date {
  return addDays(easterSunday(year), 49)
}

/** Eastertide for the Regina Coeli swap: Easter Sunday … Pentecost, inclusive. */
export function isEastertide(date: Date): boolean {
  const d = startOfDay(date).getTime()
  const year = date.getFullYear()
  return d >= easterSunday(year).getTime() && d <= pentecostSunday(year).getTime()
}

/** First Sunday of Advent: the 4th Sunday before Christmas (Nov 27 – Dec 3). */
export function adventStart(year: number): Date {
  const christmasWeekday = new Date(year, 11, 25).getDay()
  const offset = christmasWeekday === 0 ? 28 : christmasWeekday + 21
  return addDays(new Date(year, 11, 25), -offset)
}

export type AntiphonId =
  | 'alma_redemptoris_mater'
  | 'ave_regina_caelorum'
  | 'regina_coeli'
  | 'salve_regina'

/**
 * Traditional Marian antiphon for the season:
 *  - Alma Redemptoris Mater: first Sunday of Advent through Feb 1 (the January
 *    stretch belongs to the *previous* year's Advent season, so it needs no
 *    cross-year lookup)
 *  - Ave Regina Caelorum: Feb 2 (Candlemas) through Holy Saturday (simplified —
 *    the Triduum nuance is ignored)
 *  - Regina Caeli: Eastertide (Easter Sunday … Pentecost)
 *  - Salve Regina: the rest of the year (after Pentecost until Advent)
 */
export function seasonalAntiphonId(date: Date): AntiphonId {
  if (isEastertide(date)) return 'regina_coeli'
  const d = startOfDay(date).getTime()
  const year = date.getFullYear()
  if (d >= adventStart(year).getTime() || d <= new Date(year, 1, 1).getTime()) {
    return 'alma_redemptoris_mater'
  }
  if (d < easterSunday(year).getTime()) {
    return 'ave_regina_caelorum'
  }
  return 'salve_regina'
}
