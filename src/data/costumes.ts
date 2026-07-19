// The "Costumes" category: the small customs of the plan of life (holy water
// on entering/leaving home, the three Hail Marys at bedtime), kept as a
// sibling of "Plano de Vida" (v15 migration + fresh seed). The category id is
// FIXED for the same reason as plano-de-vida: the sync merge unions by id with
// no tombstones, so a per-device random id would duplicate the category on the
// first push conflict.

export const COSTUMES_CATEGORY_ID = 'costumes'
export const COSTUMES_CATEGORY_NAME = 'Costumes'
// Lucide icon name, resolved by shared/CategoryIcon.tsx ICON_MAP.
export const COSTUMES_ICON = 'HandHeart'

// Fixed practice ids/names — the specs live in ADDITIONAL_PRACTICES
// (db/index.ts). Três Ave-Marias normally already exists from the original
// seed (per-device random id, in "Noite"); ensureCostumesState moves that row
// by name, and the fixed-id spec only inserts a replacement when it's gone.
export const AGUA_BENTA_PRACTICE_ID = 'agua-benta'
export const AGUA_BENTA_NAME = 'Água Benta'
export const TRES_AVE_MARIAS_PRACTICE_ID = 'tres-ave-marias'
export const TRES_AVE_MARIAS_NAME = 'Três Ave-Marias'
export const TRES_AVE_MARIAS_OLD_CATEGORY_NAME = 'Noite'

// The Athanasian Creed (Symbolum Quicumque), prayed on the third Sunday of every
// month. A bundled-text practice (PT + Latin) whose visibility is gated by the
// monthlySchedule field — week 3, weekday 0 (Sunday), computed from the clock.
export const CREDO_ATANASIO_PRACTICE_ID = 'credo-atanasio'
export const CREDO_ATANASIO_NAME = 'Credo de Atanásio'
export const CREDO_ATANASIO_BUNDLED_ID = 'credo_atanasio'
// Third Sunday of the month (date-fns getDay: 0 = Sunday).
export const CREDO_ATANASIO_MONTHLY: { week: number; weekday: number } = { week: 3, weekday: 0 }
