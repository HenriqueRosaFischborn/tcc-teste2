'use server'

import * as cheerio from 'cheerio'
import countries from 'i18n-iso-countries'
import en from 'i18n-iso-countries/langs/en.json'
import type { LookupResult, OfficialPlayer } from './types'

countries.registerLocale(en)

/**
 * Orçamento total de UMA consulta, somando todas as tentativas.
 *
 * A FIDE não responde requisição vinda de IP de datacenter (é o caso da Vercel):
 * a conexão fica pendurada em vez de ser recusada. Com 2 tentativas de 12 s o
 * jogador passava 24,5 s olhando um formulário parado, sem nenhum aviso, antes
 * de o erro aparecer — que é exatamente o "fica só carregando" relatado.
 *
 * Quem resolve isso é o `FIDE_PROXY` (veja abaixo): o prazo continua curto para
 * o caso sem proxy, em que a FIDE simplesmente não vai responder.
 */
const PRAZO_TOTAL_MS = 8000

/** Teto de cada tentativa isolada, sempre limitado ao que resta do orçamento. */
const PRAZO_POR_TENTATIVA_MS = 6000

const TENTATIVAS = 2
const INTERVALO_ENTRE_TENTATIVAS_MS = 400

/** Abaixo disso não vale começar outra tentativa: ela já nasceria sem tempo. */
const TEMPO_MINIMO_TENTATIVA_MS = 1200

const MOTIVO_TEMPO_ESGOTADO = 'tempo esgotado'

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
 * A FIDE recusa (ou deixa pendurada) a conexão de IP de nuvem — é o caso da
 * Vercel, e é por isso que a consulta funciona no localhost e falha hospedada.
 * Nenhuma biblioteca HTTP resolve isso: o que decide é o IP de origem.
 *
 * `FIDE_PROXY` desvia SÓ a consulta da FIDE por um endereço que a FIDE aceita
 * (API de scraping, proxy próprio, gateway). É um template com `{url}` no lugar
 * do perfil:
 *
 *   FIDE_PROXY="https://api.scraperapi.com/?api_key=...&url={url}"
 *
 * Sem a variável — localhost, por exemplo — a consulta continua indo direto.
 */
const aplicarProxyFide = (url: string): string => {
  const proxy = process.env.FIDE_PROXY?.trim()

  if (!proxy) return url

  // Serviços que não usam template recebem o endereço anexado ao final, que é o
  // formato ".../raw?url=" adotado por boa parte deles.
  return proxy.includes('{url}')
    ? proxy.replace('{url}', encodeURIComponent(url))
    : proxy + encodeURIComponent(url)
}

/**
 * O log da Vercel é público para quem tem acesso ao projeto, e o endereço do
 * proxy carrega a chave da API na query. Só o endereço sem query vai para lá.
 */
const urlParaLog = (url: string): string => {
  try {
    const { origin, pathname } = new URL(url)
    return origin + pathname
  } catch {
    return 'endereço inválido'
  }
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
  if (error.name === 'TimeoutError' || error.name === 'AbortError') return MOTIVO_TEMPO_ESGOTADO

  return error.message === '' ? error.name : error.message
}

async function tentarFetch(url: string, prazoMs: number): Promise<FetchResult> {
  try {
    const response = await fetch(url, {
      headers: BROWSER_HEADERS,
      cache: 'no-store',
      signal: AbortSignal.timeout(prazoMs),
    })

    if (!response.ok) return { ok: false, motivo: `HTTP ${response.status}` }

    return { ok: true, html: await response.text() }
  } catch (error) {
    return { ok: false, motivo: descreverErro(error) }
  }
}

/**
 * Vale a pena repetir? Um site que aceitou a conexão e devolveu erro pode
 * responder bem na segunda. Um que estourou o prazo (IP bloqueado, conexão
 * descartada no meio do caminho) não vai responder na segunda — repetir só
 * dobraria a espera do jogador.
 */
const valeRepetir = (motivo: string) => motivo !== MOTIVO_TEMPO_ESGOTADO

/**
 * Baixa a página dentro de um orçamento de tempo fixo. O log fica no servidor
 * porque é lá que a falha acontece quando o sistema está hospedado — sem ele,
 * uma recusa da FIDE é indistinguível de um problema de rede.
 */
async function fetchHtml(url: string, prazoTotalMs: number): Promise<FetchResult> {
  const limite = Date.now() + prazoTotalMs
  let ultimo: FetchResult = { ok: false, motivo: MOTIVO_TEMPO_ESGOTADO }

  for (let tentativa = 1; tentativa <= TENTATIVAS; tentativa++) {
    const restante = limite - Date.now()

    if (restante < TEMPO_MINIMO_TENTATIVA_MS) break

    ultimo = await tentarFetch(url, Math.min(PRAZO_POR_TENTATIVA_MS, restante))

    if (ultimo.ok) return ultimo

    console.error(
      `[consulta-oficial] tentativa ${tentativa}/${TENTATIVAS} falhou em ${urlParaLog(url)}: ${ultimo.motivo}`
    )

    if (tentativa === TENTATIVAS || !valeRepetir(ultimo.motivo)) break

    await new Promise((resolve) => setTimeout(resolve, INTERVALO_ENTRE_TENTATIVAS_MS))
  }

  return ultimo
}

const toRating = (value: string | undefined): number | null => {
  const rating = Number(value)
  return Number.isFinite(rating) && rating > 0 ? rating : null
}

/**
 * A FIDE escreve o título por extenso ("Woman FIDE Master") e o sistema guarda
 * a abreviação oficial. Antes a consulta pegava só a primeira palavra e gravava
 * "Woman" em vez de "WFM".
 */
const TITULOS: Record<string, string> = {
  grandmaster: 'GM',
  'international master': 'IM',
  'fide master': 'FM',
  'candidate master': 'CM',
  'woman grandmaster': 'WGM',
  'woman international master': 'WIM',
  'woman fide master': 'WFM',
  'woman candidate master': 'WCM',
}

/** Devolve a abreviação, ou o texto como veio se a FIDE usar um título novo. */
const abreviarTitulo = (texto: string): string | null => {
  const nome = texto.replace(/\s+/g, ' ').trim()

  if (nome === '' || nome.toLowerCase() === 'none') return null

  return TITULOS[nome.toLowerCase()] ?? nome
}

/** Texto do primeiro elemento que casar com algum dos seletores. */
const primeiroTexto = ($: cheerio.CheerioAPI, seletores: string): string => {
  for (const seletor of seletores.split(',')) {
    const texto = $(seletor.trim()).first().text().trim()
    if (texto !== '') return texto
  }

  return ''
}

/**
 * `prazoMs` existe para quem chama poder encurtar a espera. O envio da
 * inscrição usa o dado oficial só para enriquecer o cadastro, então prefere
 * desistir antes a segurar o jogador na tela de envio.
 */
type ConsultaOpcoes = { prazoMs?: number }

/** Extrai os dados do perfil em ratings.fide.com. */
export async function verifyFideId(
  id: string,
  opcoes: ConsultaOpcoes = {}
): Promise<LookupResult> {
  const url = aplicarProxyFide(`https://ratings.fide.com/profile/${encodeURIComponent(id)}`)
  const busca = await fetchHtml(url, opcoes.prazoMs ?? PRAZO_TOTAL_MS)

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

  // O título fica em ".profile-info-title" (por extenso). O fallback lê a linha
  // "FIDE title" caso a classe mude.
  const textoDoTitulo =
    primeiroTexto($, '.profile-info-title') ||
    $('.profile-info-row')
      .filter((_, linha) => /fide title/i.test($(linha).text()))
      .first()
      .text()
      .replace(/fide title/i, '')
      .trim()

  return {
    status: 'found',
    player: {
      name,
      bornYear: $('.profile-info-byear').text().trim(),
      genre: $('.profile-info-sex').text().trim() === 'Male' ? 'm' : 'f',
      title: abreviarTitulo(textoDoTitulo),
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
export async function verifyCbxId(
  id: string,
  opcoes: ConsultaOpcoes = {}
): Promise<LookupResult> {
  const busca = await fetchHtml(
    `https://www.cbx.org.br/jogador/${encodeURIComponent(id)}`,
    opcoes.prazoMs ?? PRAZO_TOTAL_MS
  )

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
