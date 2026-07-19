import { db, ADDITIONAL_PRACTICES } from './index'
import type { Category, Practice } from '../types'
import { generateId } from '../utils/id'
import {
  PLANO_DE_VIDA_CATEGORY_ID,
  PLANO_DE_VIDA_CATEGORY_NAME,
  PLANO_DE_VIDA_ICON,
} from '../data/planoDeVida'
import {
  COSTUMES_CATEGORY_ID,
  COSTUMES_CATEGORY_NAME,
  COSTUMES_ICON,
} from '../data/costumes'

const now = new Date().toISOString()

// "Plano de Vida" and "Costumes" carry FIXED ids (not generateId): the v14/v15
// migrations create the same rows on existing installs, and a fresh install
// that later adopts a synced snapshot must agree on the ids or the union-merge
// would duplicate the categories (no tombstones). The time-of-day categories
// predate sync and keep their per-device random ids.
const defaultCategories: Category[] = [
  { id: PLANO_DE_VIDA_CATEGORY_ID, name: PLANO_DE_VIDA_CATEGORY_NAME, sortOrder: 0, emoji: PLANO_DE_VIDA_ICON, createdAt: now, updatedAt: now },
  { id: COSTUMES_CATEGORY_ID, name: COSTUMES_CATEGORY_NAME, sortOrder: 1, emoji: COSTUMES_ICON, createdAt: now, updatedAt: now },
  { id: generateId(), name: 'Orações da Manhã', sortOrder: 2, emoji: 'Sunrise', createdAt: now, updatedAt: now },
  { id: generateId(), name: 'Meio da Manhã', sortOrder: 3, emoji: 'Sun', createdAt: now, updatedAt: now },
  { id: generateId(), name: 'Meio-dia', sortOrder: 4, emoji: 'Clock', createdAt: now, updatedAt: now },
  { id: generateId(), name: 'Tarde', sortOrder: 5, emoji: 'CloudSun', createdAt: now, updatedAt: now },
  { id: generateId(), name: 'Noite', sortOrder: 6, emoji: 'Moon', createdAt: now, updatedAt: now },
  { id: generateId(), name: 'Missa / Igreja', sortOrder: 7, emoji: 'Church', createdAt: now, updatedAt: now },
]

function createDefaultPractices(categories: Category[]): Practice[] {
  const catMap = Object.fromEntries(categories.map((c) => [c.name, c.id]))
  const plano = catMap[PLANO_DE_VIDA_CATEGORY_NAME]

  // The Plano de Vida slots 4, 9 and 11–13 come from ADDITIONAL_PRACTICES below
  // (they carry explicit sortOrders); the base list holds everything else in its
  // final v14 shape, so a fresh install needs no migration.
  const base: Practice[] = [
    // Plano de Vida
    { id: generateId(), name: 'Oferecimento de Obras', categoryId: plano, content: '', imageData: null, bundledTextId: 'oferecimento_de_obras', isRequired: true, sortOrder: 0, isArchived: false, createdAt: now, updatedAt: now },
    { id: generateId(), name: 'Oração mental da manhã', categoryId: plano, content: '', imageData: null, isRequired: true, sortOrder: 1, isArchived: false, createdAt: now, updatedAt: now },
    { id: generateId(), name: 'Santa Missa', categoryId: plano, content: '', imageData: null, isRequired: true, sortOrder: 2, isArchived: false, createdAt: now, updatedAt: now },
    { id: generateId(), name: 'Visita ao Santíssimo', categoryId: plano, content: '', imageData: null, bundledTextId: 'visita_ao_santissimo', isRequired: true, sortOrder: 3, isArchived: false, createdAt: now, updatedAt: now },
    { id: generateId(), name: 'Leitura Espiritual', categoryId: plano, content: '', imageData: null, isRequired: true, sortOrder: 5, isArchived: false, createdAt: now, updatedAt: now },
    { id: generateId(), name: 'Preces', categoryId: plano, content: '', imageData: null, bundledTextId: 'preces_da_obra', isRequired: true, sortOrder: 6, isArchived: false, createdAt: now, updatedAt: now },
    { id: generateId(), name: 'Santo Rosário', categoryId: plano, content: '', imageData: null, isRequired: true, sortOrder: 7, isArchived: false, createdAt: now, updatedAt: now },
    { id: generateId(), name: 'Ângelus', categoryId: plano, content: '', imageData: null, bundledTextId: 'angelus', isRequired: true, sortOrder: 8, isArchived: false, createdAt: now, updatedAt: now },
    { id: generateId(), name: 'Exame de Consciência', categoryId: plano, content: '', imageData: null, isRequired: true, sortOrder: 10, isArchived: false, createdAt: now, updatedAt: now },

    // Meio-dia
    { id: generateId(), name: 'Lembrai-vos', categoryId: catMap['Meio-dia'], content: '', imageData: null, bundledTextId: 'lembrai_vos', isRequired: false, sortOrder: 0, isArchived: false, createdAt: now, updatedAt: now },

    // Costumes (Água Benta + Três Ave-Marias) come from ADDITIONAL_PRACTICES
    // below — their specs carry fixed ids and pinned sortOrders.

    // Missa / Igreja
    { id: generateId(), name: 'Comunhão Espiritual', categoryId: catMap['Missa / Igreja'], content: '', imageData: null, isRequired: false, sortOrder: 0, isArchived: false, createdAt: now, updatedAt: now },
  ]

  // Practices added after the initial seed — placed at the spec's pinned slot, or
  // appended to the end of their category. Kept in sync with the version-upgrade
  // path via ADDITIONAL_PRACTICES (see addMissingAdditionalPractices).
  for (const spec of ADDITIONAL_PRACTICES) {
    const categoryId = catMap[spec.categoryName]
    if (!categoryId) continue
    const maxSortOrder = base
      .filter((p) => p.categoryId === categoryId)
      .reduce((m, p) => Math.max(m, p.sortOrder), -1)
    base.push({
      id: spec.id ?? generateId(),
      name: spec.name,
      categoryId,
      content: '',
      imageData: null,
      isRequired: spec.isRequired,
      sortOrder: spec.sortOrder ?? maxSortOrder + 1,
      isArchived: false,
      createdAt: now,
      updatedAt: now,
      ...(spec.bundledTextId ? { bundledTextId: spec.bundledTextId } : {}),
      ...(spec.activeWindow ? { activeWindow: spec.activeWindow } : {}),
      ...(spec.scheduleDays ? { scheduleDays: spec.scheduleDays } : {}),
      ...(spec.cadence ? { cadence: spec.cadence } : {}),
      ...(spec.monthlySchedule ? { monthlySchedule: spec.monthlySchedule } : {}),
    })
  }

  // Every seeded practice is a spiritual devotion. Tag here so fresh installs
  // match the v6 migration that backfills existing installs.
  return base.map((p) => ({ ...p, domain: 'spiritual' as const }))
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
