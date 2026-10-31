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
const REQUEST_TIMEOUT_MS = 12000

/**
 * Quantas vezes cada site oficial é tentado antes de desistir. A FIDE recusa ou
 * demora de forma intermitente quando a requisição vem de IP de datacenter (é o
 * caso da Vercel), então uma segunda tentativa resolve boa parte das falhas.
 */
const TENTATIVAS = 2
const INTERVALO_ENTRE_TENTATIVAS_MS = 500

// Os sites oficiais recusam requisições com cara de robô (ex.: "Mozilla/5.0" sozinho).
const BROWSER_HEADERS = {
  'User-Agent':
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
  Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  'Accept-Language': 'pt-BR,pt;q=0.9,en;q=0.8',
  // Sem o Referer a FIDE às vezes responde com a página de bloqueio.
  Referer: 'https://ratings.fide.com/',
}

/**
 * Resultado de uma tentativa de consulta.
 * `motivo` existe para o erro chegar até o jogador (e até o log da Vercel) em
 * vez de virar um "não foi possível consultar" sem explicação.
 */
type FetchResult = { ok: true; html: string } | { ok: false; motivo: string }

const descreverErro = (error: unknown): string => {
  if (!(error instanceof Error)) return String(error)

  // Timeout do AbortSignal chega como TimeoutError/DOMException.
  if (error.name === 'TimeoutError' || error.name === 'AbortError') return 'tempo esgotado'

  return error.message === '' ? error.name : error.message
}

async function tentarFetch(url: string): Promise<FetchResult> {
  try {
    const response = await fetch(url, {
      headers: BROWSER_HEADERS,
      cache: 'no-store',
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    })

    if (!response.ok) return { ok: false, motivo: `HTTP ${response.status}` }

    return { ok: true, html: await response.text() }
  } catch (error) {
    return { ok: false, motivo: descreverErro(error) }
  }
}

/**
 * Baixa a página, tentando mais de uma vez. O log fica no servidor porque é lá
 * que a falha acontece quando o sistema está hospedado — sem ele, uma recusa da
 * FIDE é indistinguível de um problema de rede.
 */
async function fetchHtml(url: string): Promise<FetchResult> {
  let ultimo: FetchResult = { ok: false, motivo: 'sem tentativas' }

  for (let tentativa = 1; tentativa <= TENTATIVAS; tentativa++) {
    ultimo = await tentarFetch(url)

    if (ultimo.ok) return ultimo

    console.error(`[consulta-oficial] tentativa ${tentativa}/${TENTATIVAS} falhou em ${url}: ${ultimo.motivo}`)

    if (tentativa < TENTATIVAS) {
      await new Promise((resolve) => setTimeout(resolve, INTERVALO_ENTRE_TENTATIVAS_MS))
    }
  }

  return ultimo
}

const toRating = (value: string | undefined): number | null => {
  const rating = Number(value)
  return Number.isFinite(rating) && rating > 0 ? rating : null
}

/** Texto do primeiro elemento que casar com algum dos seletores. */
const primeiroTexto = ($: cheerio.CheerioAPI, seletores: string): string => {
  for (const seletor of seletores.split(',')) {
    const texto = $(seletor.trim()).first().text().trim()
    if (texto !== '') return texto
  }

  return ''
}

/** Extrai os dados do perfil em ratings.fide.com. */
export async function verifyFideId(id: string): Promise<LookupResult> {
  const url = `https://ratings.fide.com/profile/${encodeURIComponent(id)}`
  const busca = await fetchHtml(url)

  if (!busca.ok) return { status: 'unavailable', motivo: busca.motivo }

  const $ = cheerio.load(busca.html)

  // O layout já mudou uma vez; os seletores alternativos evitam que uma troca de
  // classe derrube a consulta inteira.
  const name = primeiroTexto($, '.player-title, [class*="player-title"], .profile-title')

  if (name === '') {
    const pageText = $('body').text()

    // Página sem perfil pode ser "jogador inexistente" ou uma resposta de bloqueio.
    // Só tratamos como inexistente quando o site diz isso explicitamente.
    if (/no record found/i.test(pageText)) return { status: 'not-found' }

    // Sem o bloco do jogador: registra o começo da página para saber o que a
    // FIDE devolveu (bloqueio, captcha, página de erro...).
    console.error(
      `[consulta-oficial] FIDE devolveu uma página sem o perfil do jogador ${id}: ` +
        pageText.replace(/\s+/g, ' ').trim().slice(0, 300)
    )

    return { status: 'unavailable', motivo: 'página inesperada da FIDE' }
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
  const busca = await fetchHtml(`https://www.cbx.org.br/jogador/${encodeURIComponent(id)}`)

  if (!busca.ok) return { status: 'unavailable', motivo: busca.motivo }

  const $ = cheerio.load(busca.html)
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
