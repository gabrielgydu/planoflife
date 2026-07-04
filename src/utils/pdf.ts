import { jsPDF } from 'jspdf'
import { db } from '../db'
import {
  startOfMonth,
  endOfMonth,
  eachDayOfInterval,
  format,
  getDaysInMonth,
} from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { formatDate } from './dates'
import { isCareer } from './domain'
import { isInActiveWindow } from './season'
import { isScheduledOn, isWeekly } from './schedule'
import type { Practice } from '../types'

// A practice "applies" on a day when the day is inside its calendar window AND
// on its weekday schedule. Weekly practices never apply to a single day — they
// draw completed dots but stay out of every denominator.
function appliesOn(practice: Pick<Practice, 'activeWindow' | 'scheduleDays'>, day: Date): boolean {
  return isInActiveWindow(practice, day) && isScheduledOn(practice, day)
}

export async function generateMonthPdf(year: number, month: number): Promise<void> {
  const monthDate = new Date(year, month, 1)
  const monthStart = startOfMonth(monthDate)
  const monthEnd = endOfMonth(monthDate)
  const daysInMonth = getDaysInMonth(monthDate)
  const startDateStr = formatDate(monthStart)
  const endDateStr = formatDate(monthEnd)

  // Get data. Career habits are excluded: this export is the spiritual
  // plan-of-life report (the one shared with a director), not the career
  // tracker. Lifestyle habits keep their existing (included) behavior.
  const [practices, records] = await Promise.all([
    db.practices.filter((p) => !p.isArchived && !isCareer(p)).sortBy('sortOrder'),
    db.dailyRecords
      .where('date')
      .between(startDateStr, endDateStr, true, true)
      .toArray(),
  ])

  // Create completion map
  const completionMap = new Map<string, Set<string>>()
  for (const record of records) {
    if (record.isCompleted) {
      const dateSet = completionMap.get(record.date) ?? new Set()
      dateSet.add(record.practiceId)
      completionMap.set(record.date, dateSet)
    }
  }

  // Create PDF (landscape A4)
  const doc = new jsPDF({
    orientation: 'landscape',
    unit: 'mm',
    format: 'a4',
  })

  const pageWidth = 297
  const pageHeight = 210
  const margin = 10
  const headerHeight = 15
  const rowHeight = 6
  const colWidth = (pageWidth - margin * 2 - 80) / daysInMonth // 80mm for practice names

  // Title
  const monthLabel = format(monthDate, "MMMM 'de' yyyy", { locale: ptBR })
  doc.setFontSize(16)
  doc.setFont('helvetica', 'bold')
  doc.text(`Plano de Vida — ${monthLabel}`, margin, margin + 8)

  // Column headers (days)
  doc.setFontSize(7)
  doc.setFont('helvetica', 'normal')
  for (let day = 1; day <= daysInMonth; day++) {
    const x = margin + 80 + (day - 1) * colWidth
    doc.text(String(day), x + colWidth / 2, margin + headerHeight, { align: 'center' })
  }

  // Practices and completion dots
  let y = margin + headerHeight + 5
  const days = eachDayOfInterval({ start: monthStart, end: monthEnd })

  // Drop windowed practices (e.g. a novena) that never fall inside this month —
  // otherwise they'd add an all-blank row and skew the summary percentage.
  const visiblePractices = practices.filter((p) =>
    days.some((d) => appliesOn(p, d))
  )

  for (const practice of visiblePractices) {
    // Practice name (truncate if too long)
    doc.setFontSize(8)
    let name = practice.name
    if (name.length > 30) {
      name = name.substring(0, 27) + '...'
    }
    doc.text(name, margin, y + 4)

    // Draw completion dots
    for (let day = 1; day <= daysInMonth; day++) {
      const dateStr = formatDate(days[day - 1])
      const daySet = completionMap.get(dateStr)
      const isCompleted = daySet?.has(practice.id) ?? false

      // Days the practice doesn't apply to are left blank. A weekly practice
      // (e.g. Confissão) applies to no single day: only its completions show.
      if (isWeekly(practice)) {
        if (!isCompleted) continue
      } else if (!appliesOn(practice, days[day - 1])) {
        continue
      }

      const x = margin + 80 + (day - 1) * colWidth + colWidth / 2
      const dotY = y + 3

      if (isCompleted) {
        doc.setFillColor(34, 197, 94) // green-500
        doc.circle(x, dotY, 1.5, 'F')
      } else {
        doc.setDrawColor(200, 200, 200)
        doc.circle(x, dotY, 1.5, 'S')
      }
    }

    y += rowHeight

    // Check if we need a new page
    if (y > pageHeight - margin - 10) {
      doc.addPage()
      y = margin + 10
    }
  }

  // Summary
  y += 5
  doc.setFontSize(9)
  doc.setFont('helvetica', 'bold')
  doc.text('Resumo:', margin, y)
  y += 5

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8)

  // Scope numerator and denominator to the same applies-that-day practice set,
  // so a windowed or weekday-scheduled practice only counts on its dates
  // (guarantees completed ≤ total). Weekly practices are excluded entirely —
  // per-day percentages can't represent a per-week duty.
  let totalCompleted = 0
  let totalPossible = 0
  for (let day = 1; day <= daysInMonth; day++) {
    const dateStr = formatDate(days[day - 1])
    const daySet = completionMap.get(dateStr)
    const dayPractices = visiblePractices.filter((p) => !isWeekly(p) && appliesOn(p, days[day - 1]))
    totalPossible += dayPractices.length
    totalCompleted += dayPractices.filter((p) => daySet?.has(p.id)).length
  }

  const percentage = totalPossible > 0 ? Math.round((totalCompleted / totalPossible) * 100) : 0
  doc.text(`Total: ${totalCompleted}/${totalPossible} práticas (${percentage}%)`, margin, y)

  // Save
  const filename = `plano-de-vida-${year}-${String(month + 1).padStart(2, '0')}.pdf`
  doc.save(filename)
}
