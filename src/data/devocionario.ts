import devocionario from './devocionario.json'
import type { Prayer } from '../types'

// The Devocionário — the pt-BR Livro de Orações from opusdei.org, harvested by
// scripts/fetch-devocionario.mjs (see that file for the sourcing rules). The JSON
// is the single source of truth for both the prayers and the order of the sections
// they live in; nothing here restates it.

export type PrayerLang = 'pt' | 'la'

export interface DevocionarioSection {
  slug: string
  namePt: string
}

/** Section slug for prayers the user wrote — always last, and never in the JSON. */
export const USER_SECTION_SLUG = 'minhas'
export const USER_SECTION_NAME = 'Minhas orações'

/** Every section in reading order, with the user's own prayers pinned at the end. */
export const DEVOCIONARIO_SECTIONS: DevocionarioSection[] = [
  ...(devocionario.sections as DevocionarioSection[]),
  { slug: USER_SECTION_SLUG, namePt: USER_SECTION_NAME },
]

const SECTION_ORDER = new Map(DEVOCIONARIO_SECTIONS.map((s, i) => [s.slug, i]))

export function sectionName(slug: string): string {
  return DEVOCIONARIO_SECTIONS.find((s) => s.slug === slug)?.namePt ?? slug
}

/** Sort key for a prayer's section; unknown sections sort after the known ones. */
export function sectionIndex(slug: string): number {
  return SECTION_ORDER.get(slug) ?? DEVOCIONARIO_SECTIONS.length
}

/** The bundled default prayers, ready to insert. Fresh objects on every call. */
export function defaultPrayers(now: string): Prayer[] {
  return (
    devocionario.prayers as Array<Omit<Prayer, 'source' | 'isFavorite' | 'createdAt' | 'updatedAt'>>
  ).map((p) => ({
    ...p,
    source: 'default' as const,
    isFavorite: false,
    createdAt: now,
    updatedAt: now,
  }))
}

/** Languages the prayer actually has a text for, Portuguese first. */
export function prayerLangs(prayer: Prayer): PrayerLang[] {
  return (['pt', 'la'] as const).filter((l) => !!prayer.texts[l])
}

/**
 * The prayer in `lang`, or — when it has no text in that language — in the one it
 * does have. Latin-only prayers are ordinary here, so callers must never assume pt.
 */
export function prayerLang(prayer: Prayer, lang: PrayerLang): PrayerLang {
  return prayer.texts[lang] ? lang : (prayerLangs(prayer)[0] ?? lang)
}

/** Title in the given language, falling back to the other one, then to the id. */
export function prayerTitle(prayer: Prayer, lang?: PrayerLang): string {
  if (lang && prayer.title[lang]) return prayer.title[lang]
  return prayer.title.pt ?? prayer.title.la ?? prayer.id
}

/** Prayer text in the given language, falling back to whichever one exists. */
export function prayerText(prayer: Prayer, lang: PrayerLang): string {
  return prayer.texts[prayerLang(prayer, lang)] ?? ''
}
