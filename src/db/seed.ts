import { db } from './index'
import type { Category, Practice } from '../types'
import { generateId } from '../utils/id'

const now = new Date().toISOString()

const defaultCategories: Category[] = [
  { id: generateId(), name: 'Orações da Manhã', sortOrder: 0, emoji: 'Sunrise', createdAt: now, updatedAt: now },
  { id: generateId(), name: 'Meio da Manhã', sortOrder: 1, emoji: 'Sun', createdAt: now, updatedAt: now },
  { id: generateId(), name: 'Meio-dia', sortOrder: 2, emoji: 'Clock', createdAt: now, updatedAt: now },
  { id: generateId(), name: 'Tarde', sortOrder: 3, emoji: 'CloudSun', createdAt: now, updatedAt: now },
  { id: generateId(), name: 'Noite', sortOrder: 4, emoji: 'Moon', createdAt: now, updatedAt: now },
  { id: generateId(), name: 'Missa / Igreja', sortOrder: 5, emoji: 'Church', createdAt: now, updatedAt: now },
]

function createDefaultPractices(categories: Category[]): Practice[] {
  const catMap = Object.fromEntries(categories.map((c) => [c.name, c.id]))

  return [
    // Orações da Manhã
    { id: generateId(), name: 'Oferecimento de Obras', categoryId: catMap['Orações da Manhã'], content: '', imageData: null, bundledTextId: 'oferecimento_de_obras', isRequired: true, sortOrder: 0, isArchived: false, createdAt: now, updatedAt: now },
    { id: generateId(), name: 'Meditação', categoryId: catMap['Orações da Manhã'], content: '', imageData: null, isRequired: true, sortOrder: 1, isArchived: false, createdAt: now, updatedAt: now },
    { id: generateId(), name: 'Preces da Obra', categoryId: catMap['Orações da Manhã'], content: '', imageData: null, bundledTextId: 'preces_da_obra', isRequired: false, sortOrder: 2, isArchived: false, createdAt: now, updatedAt: now },

    // Meio da Manhã
    { id: generateId(), name: 'Visita ao Santíssimo', categoryId: catMap['Meio da Manhã'], content: '', imageData: null, bundledTextId: 'visita_ao_santissimo', isRequired: false, sortOrder: 0, isArchived: false, createdAt: now, updatedAt: now },

    // Meio-dia
    { id: generateId(), name: 'Angelus', categoryId: catMap['Meio-dia'], content: '', imageData: null, bundledTextId: 'angelus', isRequired: false, sortOrder: 0, isArchived: false, createdAt: now, updatedAt: now },
    { id: generateId(), name: 'Lembrai-vos', categoryId: catMap['Meio-dia'], content: '', imageData: null, bundledTextId: 'lembrai_vos', isRequired: false, sortOrder: 1, isArchived: false, createdAt: now, updatedAt: now },

    // Tarde
    { id: generateId(), name: 'Rosário', categoryId: catMap['Tarde'], content: '', imageData: null, isRequired: true, sortOrder: 0, isArchived: false, createdAt: now, updatedAt: now },
    { id: generateId(), name: 'Leitura Espiritual', categoryId: catMap['Tarde'], content: '', imageData: null, isRequired: false, sortOrder: 1, isArchived: false, createdAt: now, updatedAt: now },

    // Noite
    { id: generateId(), name: 'Exame de Consciência', categoryId: catMap['Noite'], content: '', imageData: null, isRequired: true, sortOrder: 0, isArchived: false, createdAt: now, updatedAt: now },
    { id: generateId(), name: 'Três Ave-Marias', categoryId: catMap['Noite'], content: '', imageData: null, isRequired: false, sortOrder: 1, isArchived: false, createdAt: now, updatedAt: now },

    // Missa / Igreja
    { id: generateId(), name: 'Missa', categoryId: catMap['Missa / Igreja'], content: '', imageData: null, isRequired: false, sortOrder: 0, isArchived: false, createdAt: now, updatedAt: now },
    { id: generateId(), name: 'Comunhão Espiritual', categoryId: catMap['Missa / Igreja'], content: '', imageData: null, isRequired: false, sortOrder: 1, isArchived: false, createdAt: now, updatedAt: now },
  ]
}

export async function seedDatabase(): Promise<void> {
  const categoriesCount = await db.categories.count()
  if (categoriesCount > 0) return // Already seeded

  await db.transaction('rw', db.categories, db.practices, async () => {
    await db.categories.bulkAdd(defaultCategories)
    const practices = createDefaultPractices(defaultCategories)
    await db.practices.bulkAdd(practices)
  })
}
