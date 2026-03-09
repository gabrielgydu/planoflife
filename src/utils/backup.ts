import { db } from '../db'
import type {
  Category,
  Practice,
  DailyRecord,
  MissedReason,
  ExamenEntry,
  GuidingQuestion,
  Proposito,
} from '../types'
import { encryptData, decryptData } from './crypto'
import { generateId } from './id'

export interface BackupData {
  version: number
  exportedAt: string
  data: {
    categories: Category[]
    practices: Practice[]
    dailyRecords: DailyRecord[]
    missedReasons: MissedReason[]
    examenEntries: ExamenEntry[]
    guidingQuestions: GuidingQuestion[]
    propositos: Proposito[]
  }
}

export async function exportBackup(): Promise<BackupData> {
  const [
    categories,
    practices,
    dailyRecords,
    missedReasons,
    examenEntries,
    guidingQuestions,
    propositos,
  ] = await Promise.all([
    db.categories.toArray(),
    db.practices.toArray(),
    db.dailyRecords.toArray(),
    db.missedReasons.toArray(),
    db.examenEntries.toArray(),
    db.guidingQuestions.toArray(),
    db.propositos.toArray(),
  ])

  return {
    version: 1,
    exportedAt: new Date().toISOString(),
    data: {
      categories,
      practices,
      dailyRecords,
      missedReasons,
      examenEntries,
      guidingQuestions,
      propositos,
    },
  }
}

export async function importBackup(backup: BackupData): Promise<void> {
  if (backup.version !== 1) {
    throw new Error('Versão de backup incompatível')
  }

  await db.transaction(
    'rw',
    [
      db.categories,
      db.practices,
      db.dailyRecords,
      db.missedReasons,
      db.examenEntries,
      db.guidingQuestions,
      db.propositos,
    ],
    async () => {
      // Clear all existing data
      await Promise.all([
        db.categories.clear(),
        db.practices.clear(),
        db.dailyRecords.clear(),
        db.missedReasons.clear(),
        db.examenEntries.clear(),
        db.guidingQuestions.clear(),
        db.propositos.clear(),
      ])

      // Import new data
      await Promise.all([
        db.categories.bulkAdd(backup.data.categories),
        db.practices.bulkAdd(backup.data.practices),
        db.dailyRecords.bulkAdd(backup.data.dailyRecords),
        db.missedReasons.bulkAdd(backup.data.missedReasons),
        db.examenEntries.bulkAdd(backup.data.examenEntries),
        db.guidingQuestions.bulkAdd(backup.data.guidingQuestions),
        db.propositos.bulkAdd(backup.data.propositos),
      ])
    }
  )
}

export function downloadBackup(backup: BackupData): void {
  const json = JSON.stringify(backup, null, 2)
  const blob = new Blob([json], { type: 'application/json' })
  const url = URL.createObjectURL(blob)

  const date = new Date().toISOString().split('T')[0]
  const filename = `plano-de-vida-backup-${date}.json`

  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

export function parseBackupFile(file: File): Promise<BackupData> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      try {
        const data = JSON.parse(reader.result as string) as BackupData
        if (!data.version || !data.data) {
          reject(new Error('Arquivo de backup inválido'))
          return
        }
        resolve(data)
      } catch {
        reject(new Error('Erro ao ler arquivo de backup'))
      }
    }
    reader.onerror = () => reject(new Error('Erro ao ler arquivo'))
    reader.readAsText(file)
  })
}

// Practice import types and functions

export interface PracticeImportItem {
  name: string
  content: string
  category?: string
}

function textToHtml(text: string): string {
  const paragraphs = text.split(/\n\n+/)
  return paragraphs
    .map((p) => `<p>${p.replace(/\n/g, '<br>')}</p>`)
    .join('')
}

function normalizeStr(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
}

export function parsePracticeImportFile(file: File): Promise<PracticeImportItem[]> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      try {
        const data = JSON.parse(reader.result as string)
        if (!Array.isArray(data)) {
          reject(new Error('Arquivo deve conter um array JSON'))
          return
        }
        for (const item of data) {
          if (!item.name || !item.content) {
            reject(new Error(`Item inválido: cada prática precisa de "name" e "content"`))
            return
          }
        }
        resolve(data as PracticeImportItem[])
      } catch {
        reject(new Error('Erro ao ler arquivo JSON'))
      }
    }
    reader.onerror = () => reject(new Error('Erro ao ler arquivo'))
    reader.readAsText(file)
  })
}

export async function importPractices(
  items: PracticeImportItem[],
  categories: Category[]
): Promise<{ added: number; updated: number }> {
  const now = new Date().toISOString()
  const maxSortOrder = await db.practices.orderBy('sortOrder').last()
  let sortOrder = (maxSortOrder?.sortOrder ?? 0) + 1

  const categoryMap = new Map<string, string>()
  for (const cat of categories) {
    categoryMap.set(normalizeStr(cat.name), cat.id)
  }

  const existingPractices = await db.practices.toArray()
  const existingByName = new Map<string, Practice>()
  for (const p of existingPractices) {
    existingByName.set(normalizeStr(p.name), p)
  }

  let added = 0
  let updated = 0

  for (const item of items) {
    const categoryId = item.category
      ? categoryMap.get(normalizeStr(item.category)) ?? ''
      : ''
    const existing = existingByName.get(normalizeStr(item.name))

    if (existing) {
      await db.practices.update(existing.id, {
        content: textToHtml(item.content),
        categoryId,
        updatedAt: now,
      })
      updated++
    } else {
      await db.practices.add({
        id: generateId(),
        name: item.name,
        categoryId,
        content: textToHtml(item.content),
        imageData: null,
        isRequired: false,
        sortOrder: sortOrder++,
        isArchived: false,
        createdAt: now,
        updatedAt: now,
      })
      added++
    }
  }

  return { added, updated }
}

export async function downloadEncryptedBackup(
  backup: BackupData,
  password: string
): Promise<void> {
  const json = JSON.stringify(backup)
  const encrypted = await encryptData(json, password)
  const blob = new Blob([encrypted], { type: 'application/octet-stream' })
  const url = URL.createObjectURL(blob)

  const date = new Date().toISOString().split('T')[0]
  const filename = `plano-de-vida-backup-${date}.enc`

  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

export async function parseEncryptedBackupFile(
  file: File,
  password: string
): Promise<BackupData> {
  const buffer = await file.arrayBuffer()
  const json = await decryptData(buffer, password)

  const data = JSON.parse(json) as BackupData
  if (!data.version || !data.data) {
    throw new Error('Arquivo de backup inválido')
  }
  return data
}
