'use server'

import * as cheerio from 'cheerio'
import countries from 'i18n-iso-countries'
import en from 'i18n-iso-countries/langs/en.json'
import type { LookupResult, OfficialPlayer } from './types'

countries.registerLocale(en)

/**
 * Tempo máximo de cada consulta. Sem esse limite, um site oficial fora do ar
 * (ou bloqueando o IP do servidor) deixa a requisição pendurada até o tempo
 * máximo da função na Vercel — e o formulário fica travado para o jogador.
 */
const REQUEST_TIMEOUT_MS = 7000

// Os sites oficiais recusam requisições com cara de robô (ex.: "Mozilla/5.0" sozinho).
const BROWSER_HEADERS = {
  'User-Agent':
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
  Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  'Accept-Language': 'pt-BR,pt;q=0.9,en;q=0.8',
}

/** Devolve o HTML da página ou null quando a consulta falha (timeout, erro HTTP, rede...). */
async function fetchHtml(url: string): Promise<string | null> {
  try {
    const response = await fetch(url, {
      headers: BROWSER_HEADERS,
      cache: 'no-store',
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    })

    if (!response.ok) return null

    return await response.text()
  } catch {
    return null
  }
}

const toRating = (value: string | undefined): number | null => {
  const rating = Number(value)
  return Number.isFinite(rating) && rating > 0 ? rating : null
}

/** Extrai os dados do perfil em ratings.fide.com. */
export async function verifyFideId(id: string): Promise<LookupResult> {
  const html = await fetchHtml(`https://ratings.fide.com/profile/${encodeURIComponent(id)}`)
  if (html === null) return { status: 'unavailable' }

  const $ = cheerio.load(html)
  const name = $('.player-title').text().trim()

  if (name === '') {
    // Página sem perfil pode ser "jogador inexistente" ou uma resposta de bloqueio.
    // Só tratamos como inexistente quando o site diz isso explicitamente.
    const pageText = $('body').text()
    return /no record found/i.test(pageText) ? { status: 'not-found' } : { status: 'unavailable' }
  }

  const [standard, rapid, blitz] = $('.profile-games').text().trim().match(/Not rated|\d+/g) ?? []

  const flagCode = $('.profile-info-country img')
    .attr('src')
    ?.split('/')
    .pop()
    ?.replace('.svg', '')
    .toUpperCase()

  const rawTitle = $('.profile-info-row')
    .text()
    .match(/FIDE title\s*([A-Za-z]+)/i)?.[1]

  return {
    status: 'found',
    player: {
      name,
      bornYear: $('.profile-info-byear').text().trim(),
      genre: $('.profile-info-sex').text().trim() === 'Male' ? 'm' : 'f',
      title: rawTitle && rawTitle.toLowerCase() !== 'none' ? rawTitle : null,
      federation: flagCode ? (countries.alpha2ToAlpha3(flagCode) ?? null) : null,
      idFide: id,
      ratings: {
        standard: toRating(standard),
        rapid: toRating(rapid),
        blitz: toRating(blitz),
      },
    },
  }
}

/** Extrai os dados do perfil em cbx.org.br. */
export async function verifyCbxId(id: string): Promise<LookupResult> {
  const html = await fetchHtml(`https://www.cbx.org.br/jogador/${encodeURIComponent(id)}`)
  if (html === null) return { status: 'unavailable' }

  const $ = cheerio.load(html)
  const profileRow = $('#dados-jogador-row1').text().trim()
  const name = profileRow.match(/^([\s\S]+?)\s*Data Nasc\./)?.[1]?.trim() ?? ''

  if (name === '') return { status: 'not-found' }

  // Tabela "Evolução Rating": colunas Clássico, Rápido e Blitz (a primeira linha é a mais recente).
  const latestRatings = $('#ContentPlaceHolder1_gdvRating')
    .text()
    .replace(/\s+/g, ' ')
    .match(/[A-Za-zÀ-ÿ]{3}\/\d{4}(\d{4})(\d{4})(\d{4})/)

  const player: OfficialPlayer = {
    name,
    bornYear: profileRow.match(/Data Nasc\.:\s*([\d/]+)/)?.[1] ?? '',
    genre: null,
    title: null,
    federation: null,
    idFide: profileRow.match(/ID FIDE:\s*(\d+)/)?.[1] ?? null,
    ratings: {
      standard: toRating(latestRatings?.[1]),
      rapid: toRating(latestRatings?.[2]),
      blitz: toRating(latestRatings?.[3]),
    },
  }

  return { status: 'found', player }
}
