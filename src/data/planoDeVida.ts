import type { Practice } from '../types'

// The "Plano de Vida" category: the core plan-of-life obligations, gathered
// from the time-of-day categories into one list (v14 migration + fresh seed).
// The category id is FIXED so every device creates the same row — the sync
// merge unions by id with no tombstones, so a per-device random id would
// duplicate the category on the first push conflict (see ADDITIONAL_PRACTICES
// in db/index.ts for the same convention on practices).

export const PLANO_DE_VIDA_CATEGORY_ID = 'plano-de-vida'
export const PLANO_DE_VIDA_CATEGORY_NAME = 'Plano de Vida'
// Lucide icon name, resolved by shared/CategoryIcon.tsx ICON_MAP.
export const PLANO_DE_VIDA_ICON = 'Cross'

// The 11 daily practices moved (and mostly renamed) into the category, in their
// final order. `oldName` is what the seed called the practice before v14; the
// migration matches rows by normalized old OR new name — the original seed rows
// have per-device random ids, so the name is the only stable cross-device key.
// `oldCategoryName` disambiguates if the user created a same-named practice
// elsewhere: on multiple matches the row in the expected source category wins.
export interface PlanoDeVidaMove {
  oldName: string
  newName: string
  oldCategoryName: string
  sortOrder: number
}

export const PLANO_DE_VIDA_MOVES: PlanoDeVidaMove[] = [
  { oldName: 'Oferecimento de Obras', newName: 'Oferecimento de Obras', oldCategoryName: 'Orações da Manhã', sortOrder: 0 },
  { oldName: 'Meditação', newName: 'Oração mental da manhã', oldCategoryName: 'Orações da Manhã', sortOrder: 1 },
  { oldName: 'Missa', newName: 'Santa Missa', oldCategoryName: 'Missa / Igreja', sortOrder: 2 },
  { oldName: 'Visita ao Santíssimo', newName: 'Visita ao Santíssimo', oldCategoryName: 'Meio da Manhã', sortOrder: 3 },
  { oldName: 'Leitura do Evangelho', newName: 'Leitura do Novo Testamento', oldCategoryName: 'Orações da Manhã', sortOrder: 4 },
  { oldName: 'Leitura Espiritual', newName: 'Leitura Espiritual', oldCategoryName: 'Tarde', sortOrder: 5 },
  { oldName: 'Preces da Obra', newName: 'Preces', oldCategoryName: 'Orações da Manhã', sortOrder: 6 },
  { oldName: 'Rosário', newName: 'Santo Rosário', oldCategoryName: 'Tarde', sortOrder: 7 },
  { oldName: 'Angelus', newName: 'Ângelus', oldCategoryName: 'Meio-dia', sortOrder: 8 },
  { oldName: 'Meditação da Tarde', newName: 'Oração mental da tarde', oldCategoryName: 'Tarde', sortOrder: 9 },
  { oldName: 'Exame de Consciência', newName: 'Exame de Consciência', oldCategoryName: 'Noite', sortOrder: 10 },
]

// The new practices (11–13) live in ADDITIONAL_PRACTICES (db/index.ts); only
// their fixed ids and names are defined here so readers/UI can reference them.
export const MORTIFICACAO_PRACTICE_ID = 'mortificacao-corporal'
export const MORTIFICACAO_NAME = 'Mortificação corporal'
export const CONFISSAO_PRACTICE_ID = 'confissao-sacramental'
export const CONFISSAO_NAME = 'Confissão sacramental'

// "Santa Missa" (a core move, per-device random id — matched by normalized name,
// the only stable cross-device key). Opening it shows the day's liturgy readings
// (LiturgiaView) instead of the plain text pager. NOT a fixed id: the v14 move
// renamed the seeded "Missa" row in place, keeping its original id.
export const SANTA_MISSA_NAME = 'Santa Missa'

const normalizeName = (s: string) =>
  s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim()

/** True for the "Santa Missa" practice — used to route it to the liturgy reader. */
export function isSantaMissaPractice(practice: Practice): boolean {
  return normalizeName(practice.name) === normalizeName(SANTA_MISSA_NAME)
}
