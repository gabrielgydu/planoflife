import { format, addDays, subDays, startOfDay, parseISO } from 'date-fns'
import { ptBR } from 'date-fns/locale'

export function formatDate(date: Date): string {
  return format(date, 'yyyy-MM-dd')
}

export function formatDateLong(date: Date): string {
  return format(date, "EEEE, d 'de' MMMM", { locale: ptBR })
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
