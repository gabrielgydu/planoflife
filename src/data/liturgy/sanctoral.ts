// Sanctoral calendar (General Roman Calendar + Brazilian national calendar), mined from the
// harvested pt-BR liturgy API oracle (scripts/liturgy/.cache/api/*.json, 2024-01-01..2027-05-31,
// 1244 days). Each entry's `name` reproduces the API's own display convention verbatim (including
// its capitalization/wording quirks) so downstream content lookups and the verify script can match
// it directly; the alias map for the handful of dates where the API itself is internally
// inconsistent across years lives in scripts/liturgy/verify-calendar.mjs, not here.
//
// Coverage note: this list only contains celebrations that actually WON their day at least once in
// the harvested window. Lower-precedence optional memorials that never surfaced (always suppressed
// by something else in 2024-2027) are absent — a reasonable limitation for a perpetual engine
// validated against this oracle; extending it needs an independent source (e.g. the Missal itself).
//
// `outranksSunday: true` marks the small set of entries empirically confirmed (via a real date in
// the oracle where the fixed date fell on a Sunday of Ordinary Time) to still win that Sunday —
// i.e. Feasts of the Lord under the Table of Liturgical Days (rank 5), plus the Nov 2 commemoration
// which has its own top-tier precedence. Ordinary Feasts of saints (São Marcos, etc.) do NOT carry
// this flag and correctly lose to a Sunday of Ordinary Time/Christmas when they coincide.

import type { LiturgicalColor } from '../../utils/liturgy/calendar.ts'

export type SanctoralRank = 'Solemnity' | 'Feast' | 'Memorial'

export interface SanctoralFixedEntry {
  month: number // 1-12
  day: number
  name: string
  rank: SanctoralRank
  color: LiturgicalColor
  outranksSunday?: boolean
}

/** Fixed-date sanctoral entries, sorted by month/day. */
export const SANCTORAL_FIXED: SanctoralFixedEntry[] = [
  { month: 1, day: 2, name: 'Santos Basílio Magno e Gregório Nazianzeno, bispos e doutores da Igreja, Memória', rank: 'Memorial', color: 'Branco' },
  { month: 1, day: 17, name: 'Santo Antão, abade, Memória', rank: 'Memorial', color: 'Branco' },
  // Jan 20 (São Sebastião) deliberately omitted: the oracle shows it winning in only 1 of the 4
  // harvested years (2025) and losing to a plain OT feria in the other 3 (2024, 2026, 2027), with
  // no discernible pattern (different weekdays each time) — genuinely facultative in a way this
  // table can't resolve. Including it unconditionally would cause 3 wrong predictions to fix 1.
  { month: 1, day: 21, name: 'Santa Inês, virgem e mártir, Memória', rank: 'Memorial', color: 'Vermelho' },
  { month: 1, day: 24, name: 'São Francisco de Sales, bispo e doutor da Igreja, Memória', rank: 'Memorial', color: 'Branco' },
  // Jan 25, Conversão de São Paulo (Feast, wins every one of 2024/2025/2027). Also appeared, in a
  // clearly glitched form, on 2024-03-22 (see verify-calendar.mjs's KNOWN_ANOMALIES) — a duplicate
  // upstream fetch, not a real transfer; that date is excluded from comparison, not modeled here.
  { month: 1, day: 25, name: 'Conversão de São Paulo, Apóstolo, Festa', rank: 'Feast', color: 'Branco' },
  { month: 1, day: 26, name: 'Santos Timóteo e Tito, bispos, Memória', rank: 'Memorial', color: 'Branco' },
  { month: 1, day: 28, name: 'Santo Tomás de Aquino, presbítero e doutor da Igreja, Memória', rank: 'Memorial', color: 'Branco' },
  { month: 1, day: 31, name: 'São João Bosco, presbítero, Memória', rank: 'Memorial', color: 'Branco' },
  { month: 2, day: 2, name: 'Apresentação do Senhor, Festa', rank: 'Feast', color: 'Branco', outranksSunday: true },
  { month: 2, day: 5, name: 'Santa Águeda, virgem e mártir, Memória', rank: 'Memorial', color: 'Vermelho' },
  { month: 2, day: 6, name: 'São Paulo Miki e companheiros, Mártires, Memória', rank: 'Memorial', color: 'Vermelho' },
  { month: 2, day: 10, name: 'Santa Escolástica, virgem, Memória', rank: 'Memorial', color: 'Branco' },
  { month: 2, day: 14, name: 'Santos Cirilo, monge, e Metódio, bispo', rank: 'Memorial', color: 'Branco' },
  { month: 2, day: 22, name: 'Cátedra de São Pedro, Apóstolo, Festa', rank: 'Feast', color: 'Branco' },
  { month: 3, day: 19, name: 'São José, esposo da Bem-Aventurada Virgem Maria, Padroeiro da Igreja Universal, Solenidade', rank: 'Solemnity', color: 'Branco' },
  { month: 4, day: 7, name: 'São João Batista de La Salle, presbítero, Memória', rank: 'Memorial', color: 'Branco' },
  { month: 4, day: 11, name: 'Santo Estanislau, Bispo e Mártir, Memória', rank: 'Memorial', color: 'Vermelho' },
  { month: 4, day: 25, name: 'São Marcos, Evangelista, Festa', rank: 'Feast', color: 'Vermelho' },
  { month: 4, day: 29, name: 'Santa Catarina de Sena, virgem e doutora da Igreja, Memória', rank: 'Memorial', color: 'Branco' },
  { month: 5, day: 2, name: 'Santo Atanásio, bispo e doutor da Igreja, Memória', rank: 'Memorial', color: 'Branco' },
  { month: 5, day: 3, name: 'Santos Filipe e Tiago, Apóstolos, Festa', rank: 'Feast', color: 'Vermelho' },
  { month: 5, day: 14, name: 'São Matias, Apóstolo, Festa', rank: 'Feast', color: 'Vermelho' },
  { month: 5, day: 26, name: 'São Filipe Néri, presbítero, Memória', rank: 'Memorial', color: 'Branco' },
  { month: 5, day: 31, name: 'Visitação da Bem-aventurada Virgem Maria, Festa', rank: 'Feast', color: 'Branco' },
  { month: 6, day: 1, name: 'São Justino, mártir, Memória', rank: 'Memorial', color: 'Vermelho' },
  { month: 6, day: 3, name: 'São Carlos Lwanga e companheiros mártires, Memória', rank: 'Memorial', color: 'Vermelho' },
  { month: 6, day: 5, name: 'São Bonifácio, bispo e mártir, Memória', rank: 'Memorial', color: 'Vermelho' },
  { month: 6, day: 9, name: 'São José de Anchieta, presbítero, Memória', rank: 'Memorial', color: 'Branco' },
  { month: 6, day: 11, name: 'São Barnabé, Apóstolo, Memória', rank: 'Memorial', color: 'Vermelho' },
  { month: 6, day: 13, name: 'Santo Antônio de Pádua, Presbítero e Doutor da Igreja, Memória', rank: 'Memorial', color: 'Branco' },
  { month: 6, day: 21, name: 'São Luís Gonzaga, Religioso, Memória', rank: 'Memorial', color: 'Branco' },
  { month: 6, day: 24, name: 'Natividade de São João Batista, Solenidade', rank: 'Solemnity', color: 'Branco' },
  { month: 6, day: 28, name: 'Santo Irineu, Bispo e Mártir, Memória', rank: 'Memorial', color: 'Vermelho' },
  { month: 7, day: 3, name: 'São Tomé, Apóstolo, Festa', rank: 'Feast', color: 'Vermelho' },
  { month: 7, day: 9, name: 'Santa Paulina do Coração Agonizante de Jesus, virgem, Memória', rank: 'Memorial', color: 'Branco' },
  { month: 7, day: 11, name: 'São Bento, abade, Memória', rank: 'Memorial', color: 'Branco' },
  { month: 7, day: 15, name: 'São Boaventura, bispo e doutor da Igreja, Memória', rank: 'Memorial', color: 'Branco' },
  { month: 7, day: 16, name: 'Bem-aventurada Virgem Maria do Monte Carmelo, Festa', rank: 'Feast', color: 'Branco' },
  { month: 7, day: 17, name: 'Bem-aventurado Inácio de Azevedo, presbítero, e companheiros, mártires, Memória', rank: 'Memorial', color: 'Vermelho' },
  { month: 7, day: 22, name: 'Santa Maria Madalena, Festa', rank: 'Feast', color: 'Branco' },
  { month: 7, day: 25, name: 'São Tiago, Apóstolo, Festa', rank: 'Feast', color: 'Vermelho' },
  { month: 7, day: 26, name: 'Santos Joaquim e Ana, pais da Bem-aventurada Virgem Maria, Memória', rank: 'Memorial', color: 'Branco' },
  { month: 7, day: 29, name: 'Santos Marta, Maria e Lázaro, Memória', rank: 'Memorial', color: 'Branco' },
  { month: 7, day: 31, name: 'Santo Inácio de Loyola, presbítero, Memória', rank: 'Memorial', color: 'Branco' },
  { month: 8, day: 1, name: 'Santo Afonso Maria de Ligório, bispo e doutor da Igreja, Memória', rank: 'Memorial', color: 'Branco' },
  { month: 8, day: 4, name: 'São João Maria Vianney, presbítero, Memória', rank: 'Memorial', color: 'Branco' },
  { month: 8, day: 6, name: 'Transfiguração do Senhor, Festa', rank: 'Feast', color: 'Branco', outranksSunday: true },
  { month: 8, day: 8, name: 'São Domingos, presbítero, Memória', rank: 'Memorial', color: 'Branco' },
  { month: 8, day: 10, name: 'São Lourenço, diácono e mártir, Festa', rank: 'Feast', color: 'Vermelho' },
  { month: 8, day: 11, name: 'Santa Clara, virgem, Memória', rank: 'Memorial', color: 'Branco' },
  { month: 8, day: 13, name: 'Santa Dulce Lopes Pontes, virgem, Memória', rank: 'Memorial', color: 'Branco' },
  { month: 8, day: 14, name: 'São Maximiliano Maria Kolbe, presbítero e mártir, Memória', rank: 'Memorial', color: 'Vermelho' },
  { month: 8, day: 20, name: 'São Bernardo, abade e doutor da Igreja, Memória', rank: 'Memorial', color: 'Branco' },
  { month: 8, day: 21, name: 'São Pio X, papa, Memória', rank: 'Memorial', color: 'Branco' },
  { month: 8, day: 22, name: 'Bem-aventurada Virgem Maria Rainha, Memória', rank: 'Memorial', color: 'Branco' },
  { month: 8, day: 23, name: 'Santa Rosa de Lima, Virgem, Padroeira da América Latina, Festa', rank: 'Feast', color: 'Branco' },
  { month: 8, day: 24, name: 'São Bartolomeu, Apóstolo, Festa', rank: 'Feast', color: 'Vermelho' },
  { month: 8, day: 27, name: 'Santa Mônica, Memória', rank: 'Memorial', color: 'Branco' },
  { month: 8, day: 28, name: 'Santo Agostinho, bispo e doutor da Igreja, Memória', rank: 'Memorial', color: 'Branco' },
  { month: 8, day: 29, name: 'Martírio de São João Batista, Memória', rank: 'Memorial', color: 'Vermelho' },
  { month: 9, day: 3, name: 'São Gregório Magno, papa e doutor da Igreja, Memória', rank: 'Memorial', color: 'Branco' },
  { month: 9, day: 8, name: 'Natividade da Bem-aventurada Virgem Maria, Festa', rank: 'Feast', color: 'Branco' },
  { month: 9, day: 13, name: 'São João Crisóstomo, Bispo e Doutor da Igreja, Memória', rank: 'Memorial', color: 'Branco' },
  { month: 9, day: 14, name: 'Exaltação da Santa Cruz, Festa', rank: 'Feast', color: 'Vermelho', outranksSunday: true },
  { month: 9, day: 15, name: 'Bem-aventurada Virgem Maria das Dores, Memória', rank: 'Memorial', color: 'Branco' },
  { month: 9, day: 16, name: 'Santos Cornélio, papa, e Cipriano, bispo, mártires, Memória', rank: 'Memorial', color: 'Vermelho' },
  { month: 9, day: 20, name: 'Santos André Kim Tae-gon, presbítero, Paulo Chóng Hasang e companheiros, mártires, Memória', rank: 'Memorial', color: 'Vermelho' },
  { month: 9, day: 21, name: 'São Mateus, Apóstolo e Evangelista, Festa', rank: 'Feast', color: 'Vermelho' },
  { month: 9, day: 23, name: 'São Pio de Pietrelcina, presbítero, Memória', rank: 'Memorial', color: 'Branco' },
  { month: 9, day: 27, name: 'São Vicente de Paulo, presbítero, Memória', rank: 'Memorial', color: 'Branco' },
  { month: 9, day: 29, name: 'Santos Miguel, Gabriel e Rafael, Arcanjos, Festa', rank: 'Feast', color: 'Branco' },
  { month: 9, day: 30, name: 'São Jerônimo, presbítero e doutor da Igreja, Memória', rank: 'Memorial', color: 'Branco' },
  { month: 10, day: 1, name: 'Santa Teresa do Menino Jesus, virgem e doutora da Igreja, Memória', rank: 'Memorial', color: 'Branco' },
  { month: 10, day: 2, name: 'Santos Anjos da Guarda, Memória', rank: 'Memorial', color: 'Branco' },
  { month: 10, day: 3, name: 'Santos André de Soveral e Ambrósio Francisco Ferro, presbíteros, Mateus Moreira e companheiros, mártires, Memória', rank: 'Memorial', color: 'Vermelho' },
  { month: 10, day: 4, name: 'São Francisco de Assis, Religioso, Memória', rank: 'Memorial', color: 'Branco' },
  { month: 10, day: 7, name: 'Bem-aventurada Virgem Maria do Rosário, Memória', rank: 'Memorial', color: 'Branco' },
  { month: 10, day: 12, name: 'Bem-Aventurada Virgem Maria da Conceição Aparecida, Padroeira do Brasil, Solenidade', rank: 'Solemnity', color: 'Branco' },
  { month: 10, day: 15, name: 'Santa Teresa de Jesus, virgem e doutora da Igreja, Memória', rank: 'Memorial', color: 'Branco' },
  { month: 10, day: 17, name: 'Santo Inácio de Antioquia, bispo e mártir, Memória', rank: 'Memorial', color: 'Vermelho' },
  { month: 10, day: 18, name: 'São Lucas, Evangelista, Festa', rank: 'Feast', color: 'Vermelho' },
  { month: 10, day: 25, name: "Santo Antônio de Sant'Ana Galvão, Religioso, Memória", rank: 'Memorial', color: 'Branco' },
  { month: 10, day: 28, name: 'Santos Simão e Judas, Apóstolos, Festa', rank: 'Feast', color: 'Vermelho' },
  { month: 11, day: 2, name: 'Comemoração de Todos os Fiéis Defuntos', rank: 'Memorial', color: 'Roxo', outranksSunday: true },
  { month: 11, day: 4, name: 'São Carlos Borromeu, bispo, Memória', rank: 'Memorial', color: 'Branco' },
  { month: 11, day: 9, name: 'Dedicação da Basílica do Latrão (Catedral de Roma), Festa', rank: 'Feast', color: 'Branco', outranksSunday: true },
  { month: 11, day: 10, name: 'São Leão Magno, papa e doutor da Igreja, Memória', rank: 'Memorial', color: 'Branco' },
  { month: 11, day: 11, name: 'São Martinho de Tours, bispo, Memória', rank: 'Memorial', color: 'Branco' },
  { month: 11, day: 12, name: 'São Josafá, bispo e mártir, Memória', rank: 'Memorial', color: 'Vermelho' },
  { month: 11, day: 17, name: 'Santa Isabel da Hungria, religiosa, Memória', rank: 'Memorial', color: 'Branco' },
  { month: 11, day: 19, name: 'Santos Roque González, Afonso Rodríguez e João de Castillo, presbíteros e mártires, Memória', rank: 'Memorial', color: 'Vermelho' },
  { month: 11, day: 21, name: 'Apresentação da Bem-aventurada Virgem Maria, Memória', rank: 'Memorial', color: 'Branco' },
  { month: 11, day: 22, name: 'Santa Cecília, virgem e mártir, Memória', rank: 'Memorial', color: 'Vermelho' },
  { month: 11, day: 24, name: 'Santo André Dung-Lac, presbítero, e companheiros mártires, Memória', rank: 'Memorial', color: 'Vermelho' },
  { month: 11, day: 30, name: 'Santo André, Apóstolo, Festa', rank: 'Feast', color: 'Vermelho' },
  { month: 12, day: 3, name: 'São Francisco Xavier, presbítero, Memória', rank: 'Memorial', color: 'Branco' },
  { month: 12, day: 7, name: 'Santo Ambrósio, bispo e doutor da Igreja, Memória', rank: 'Memorial', color: 'Branco' },
  { month: 12, day: 8, name: 'Imaculada Conceição da Bem-aventurada Virgem Maria, Solenidade', rank: 'Solemnity', color: 'Branco' },
  { month: 12, day: 12, name: 'Bem-aventurada Virgem Maria de Guadalupe, Padroeira principal da América, Festa', rank: 'Feast', color: 'Branco' },
  { month: 12, day: 13, name: 'Santa Luzia, virgem e mártir, Memória', rank: 'Memorial', color: 'Vermelho' },
  { month: 12, day: 14, name: 'São João da Cruz, presbítero e doutor da Igreja, Memória', rank: 'Memorial', color: 'Branco' },
]

/**
 * Moveable sanctoral entries — celebrations that carry sanctoral (not Sunday-privileged) precedence
 * but whose date is defined relative to Easter, not a fixed civil date. Currently just the
 * Immaculate Heart of Mary (Saturday after the Sacred Heart of Jesus, i.e. Easter+69 == Pentecost+20).
 * Unlike Sacred Heart itself (a Solemnity, always undefeated, modeled as a pure temporal celebration
 * in calendar.ts), the Immaculate Heart is only a Memorial and could in principle be outranked by a
 * higher-precedence sanctoral entry landing on the same date — not observed in the 2024-2027 oracle
 * window, but modeled correctly here so the resolver stays honest.
 */
export interface SanctoralMoveableEntry {
  offsetFromEaster: number
  name: string
  rank: SanctoralRank
  color: LiturgicalColor
}

export const SANCTORAL_MOVEABLE: SanctoralMoveableEntry[] = [
  { offsetFromEaster: 50, name: 'Bem-aventurada Virgem Maria, Mãe da Igreja, Memória', rank: 'Memorial', color: 'Branco' },
  { offsetFromEaster: 69, name: 'Imaculado Coração da Bem-aventurada Virgem Maria, Memória', rank: 'Memorial', color: 'Branco' },
]
