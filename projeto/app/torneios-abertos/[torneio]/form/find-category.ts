'use server'

import db from '@/lib/db'
import type { CategoryLookup, Genre } from './types'

const divisionGenre: Record<Genre, 'masculino' | 'feminino'> = {
  masc: 'masculino',
  fem: 'feminino',
}

const categoryInclude = { divisoes: { select: { genre: true } } } as const

/**
 * Categorias candidatas para o ano de nascimento informado:
 * 1. as que cobrem a idade do jogador;
 * 2. senão, a mais próxima abaixo da idade;
 * 3. senão, a mais próxima acima da idade.
 */
async function loadCandidates(tournamentId: number, year: number) {
  const inRange = await db.categoria.findMany({
    where: { id_torneio: tournamentId, min_y: { lte: year }, max_y: { gte: year } },
    include: categoryInclude,
  })

  if (inRange.length > 0) return inRange

  const older = await db.categoria.findMany({
    where: { id_torneio: tournamentId, max_y: { lt: year } },
    orderBy: { max_y: 'desc' },
    include: categoryInclude,
  })

  if (older.length > 0) return older

  return db.categoria.findMany({
    where: { id_torneio: tournamentId, min_y: { gt: year } },
    orderBy: { min_y: 'asc' },
    include: categoryInclude,
  })
}

export async function findCategory(
  tournamentId: number,
  birthDate: string,
  genre: Genre
): Promise<CategoryLookup> {
  const year = Number(birthDate.split('/')[2])

  if (!Number.isInteger(year) || year <= 0) return { status: 'none' }

  const candidates = await loadCandidates(tournamentId, year)

  const category = candidates.find(
    (item) => item.divisoes.genre === divisionGenre[genre] || item.divisoes.genre === 'ambos'
  )

  if (!category) return { status: 'none' }

  const divisions = await db.divisoes.findMany({ where: { id_torneio: category.id_torneio } })

  const defaultDivision = divisions.find((division) => division.id === category.default_division) ?? null
  const absoluteDivision = divisions.find((division) => division.isAbsolute) ?? null

  // A troca de divisão só é oferecida quando as duas existem.
  const divisionsNames =
    defaultDivision && absoluteDivision
      ? { defaultDivision: defaultDivision.name, absoluteDivision: absoluteDivision.name }
      : { defaultDivision: null, absoluteDivision: null }

  return {
    status: 'found',
    category: {
      uuid: category.uuid,
      name: category.name,
      price: category.value,
      ...divisionsNames,
    },
  }
}
