import type { TournamentCategory, TournamentDivision } from '@/lib/types'
import type { CategoryLookup, Genre } from './types'

const divisionGenre: Record<Genre, TournamentDivision['genre']> = {
  masc: 'masculino',
  fem: 'feminino',
}

/**
 * Escolhe a categoria do jogador pelo ano de nascimento e pelo gênero.
 *
 * Regras (as mesmas usadas no cadastro de torneios):
 * 1. a categoria que cobre o ano de nascimento do jogador;
 * 2. senão, a mais próxima abaixo da idade;
 * 3. senão, a mais próxima acima da idade.
 *
 * Entre as que cobrem a idade vence a de intervalo mais estreito, para que uma
 * categoria de idade (ex.: Sub 12) sempre ganhe da categoria absoluta, que pega
 * todos os anos.
 */
export function selectCategory(
  categories: TournamentCategory[],
  divisions: TournamentDivision[],
  birthDate: string,
  genre: Genre
): CategoryLookup {
  const year = Number(birthDate.split('/')[2])

  if (!Number.isInteger(year) || year <= 0) return { status: 'none' }

  const genreOfDivision = divisionGenre[genre]

  const eligible = categories.filter((category) => {
    const division = divisions.find((item) => item.id === category.divisionId)

    return division?.genre === genreOfDivision || division?.genre === 'ambos'
  })

  const span = (category: TournamentCategory) => category.maxYear - category.minYear

  const inRange = eligible
    .filter((category) => category.minYear <= year && category.maxYear >= year)
    .sort((a, b) => span(a) - span(b))

  const closestOlder = eligible
    .filter((category) => category.maxYear < year)
    .sort((a, b) => b.maxYear - a.maxYear)

  const closestYounger = eligible
    .filter((category) => category.minYear > year)
    .sort((a, b) => a.minYear - b.minYear)

  const category = inRange[0] ?? closestOlder[0] ?? closestYounger[0]

  if (!category) return { status: 'none' }

  const defaultDivision = divisions.find((division) => division.id === category.divisionId) ?? null
  const absoluteDivision = divisions.find((division) => division.isAbsolute) ?? null

  // A troca de divisão só é oferecida quando as duas existem.
  const divisionNames =
    defaultDivision && absoluteDivision
      ? { defaultDivision: defaultDivision.name, absoluteDivision: absoluteDivision.name }
      : { defaultDivision: null, absoluteDivision: null }

  return {
    status: 'found',
    category: {
      uuid: category.uuid,
      name: category.name,
      price: category.price,
      ...divisionNames,
    },
  }
}
