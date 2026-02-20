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

export async function generateMonthPdf(year: number, month: number): Promise<void> {
  const monthDate = new Date(year, month, 1)
  const monthStart = startOfMonth(monthDate)
  const monthEnd = endOfMonth(monthDate)
  const daysInMonth = getDaysInMonth(monthDate)
  const startDateStr = formatDate(monthStart)
  const endDateStr = formatDate(monthEnd)

  // Get data
  const [practices, records] = await Promise.all([
    db.practices.filter((p) => !p.isArchived).sortBy('sortOrder'),
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

  for (const practice of practices) {
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

  let totalCompleted = 0
  let totalPossible = 0
  for (let day = 1; day <= daysInMonth; day++) {
    const dateStr = formatDate(days[day - 1])
    const daySet = completionMap.get(dateStr)
    totalCompleted += daySet?.size ?? 0
    totalPossible += practices.length
  }

  const percentage = totalPossible > 0 ? Math.round((totalCompleted / totalPossible) * 100) : 0
  doc.text(`Total: ${totalCompleted}/${totalPossible} práticas (${percentage}%)`, margin, y)

  // Save
  const filename = `plano-de-vida-${year}-${String(month + 1).padStart(2, '0')}.pdf`
  doc.save(filename)
}
