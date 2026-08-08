import { format, addDays, subDays, startOfDay, parseISO, differenceInCalendarDays } from 'date-fns'
import { ptBR } from 'date-fns/locale'

export function formatDate(date: Date): string {
  return format(date, 'yyyy-MM-dd')
}

/**
 * Uppercase the first character only.
 *
 * Portuguese weekdays and months are lowercase ("sábado, 8 de agosto"), and a
 * heading wants a capital. CSS `capitalize` can't do it: it hits every word and
 * renders "Sábado, 8 De Agosto".
 */
function capitalizeFirst(str: string): string {
  return str.charAt(0).toLocaleUpperCase('pt-BR') + str.slice(1)
}

export function formatDateLong(date: Date): string {
  return capitalizeFirst(format(date, "EEEE, d 'de' MMMM", { locale: ptBR }))
}

/** "Agosto de 2026" — the month headings of the calendars, the PDF and its picker. */
export function formatMonthLong(date: Date): string {
  return capitalizeFirst(format(date, "MMMM 'de' yyyy", { locale: ptBR }))
}

export function formatDateShort(date: Date): string {
  return format(date, "d 'de' MMMM", { locale: ptBR })
}

export function parseDate(dateStr: string): Date {
  return parseISO(dateStr)
}

export function getToday(): Date {
  return startOfDay(new Date())
}

export function getTodayStr(): string {
  return formatDate(getToday())
}

export function addDay(date: Date, days: number): Date {
  return addDays(date, days)
}

export function subDay(date: Date, days: number): Date {
  return subDays(date, days)
}

export function isToday(date: Date): boolean {
  return formatDate(date) === getTodayStr()
}

export type RelativeDayLabel = 'Hoje' | 'Ontem' | 'Amanhã'

/**
 * 'Hoje' / 'Ontem' / 'Amanhã' for the three days around today, null further out.
 *
 * The day header shows it because checking a practice on the wrong day is silent
 * and easy to miss — and the whole point of walking forward a day (Saturday
 * evening's vigil Mass belongs to Sunday) is to mark a day that is not today.
 */
export function relativeDayLabel(date: Date): RelativeDayLabel | null {
  switch (differenceInCalendarDays(startOfDay(date), getToday())) {
    case 0:
      return 'Hoje'
    case -1:
      return 'Ontem'
    case 1:
      return 'Amanhã'
    default:
      return null
  }
}
