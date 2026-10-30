export type Genre = 'masc' | 'fem'

export type Ratings = {
  standard: number | null
  rapid: number | null
  blitz: number | null
}

/** Dados de um jogador obtidos nos sites oficiais (FIDE ou CBX). */
export type OfficialPlayer = {
  name: string
  /** FIDE: ano de nascimento (ex.: "1990"). CBX: data completa (ex.: "14/03/1976"). */
  bornYear: string
  genre: 'm' | 'f' | null
  title: string | null
  /** Sigla da federação dada pela FIDE (ex.: "BRA"). */
  federation: string | null
  idFide: string | null
  ratings: Ratings
}

/**
 * Resultado de uma consulta a um site oficial.
 * Separar "não encontrado" de "não foi possível consultar" é o que permite
 * avisar o jogador em vez de deixar o formulário travado.
 */
export type LookupResult =
  | { status: 'found'; player: OfficialPlayer }
  | { status: 'not-found' }
  | { status: 'unavailable' }

export type Category = {
  uuid: string
  name: string
  price: number
  /** Nome da divisão padrão da categoria. Só vem preenchida quando o torneio tem divisão absoluta. */
  defaultDivision: string | null
  /** Nome da divisão absoluta do torneio. */
  absoluteDivision: string | null
}

export type CategoryLookup =
  | { status: 'found'; category: Category }
  | { status: 'none' }

/** Estado da categoria na tela: idle = falta a data de nascimento. */
export type CategoryStatus = 'idle' | 'found' | 'none'

export type InscriptionState =
  | { status: 'idle' }
  | { status: 'duplicate' }
  | { status: 'error'; message: string }
  | { status: 'success' }
