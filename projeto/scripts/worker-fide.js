/**
 * Proxy de saída para a consulta à FIDE — roda na Cloudflare, NÃO faz parte do
 * app Next.js. Este arquivo existe só para você colar no painel da Cloudflare.
 *
 * POR QUE PRECISA DISSO
 * A FIDE (ratings.fide.com) não atende requisição vinda de IP de nuvem. Na
 * Vercel a conexão fica pendurada e a consulta falha; no localhost (IP
 * residencial) funciona. Nenhuma biblioteca HTTP resolve: o que decide é o IP de
 * origem. Este Worker busca a página a partir da Cloudflare e devolve o HTML
 * para o app — é o "FIDE_PROXY" lido em verify-player.ts.
 *
 * COMO PUBLICAR (não precisa instalar nada)
 * 1. Crie uma conta grátis em https://dash.cloudflare.com/sign-up (não pede cartão).
 * 2. Menu lateral → "Workers & Pages" → "Create" → "Worker" (Start with Hello World!).
 * 3. Dê um nome (ex.: proxy-fide) e clique em "Deploy".
 * 4. Clique em "Edit code", apague o conteúdo e cole ESTE arquivo inteiro.
 * 5. Troque a senha em TOKEN abaixo por uma sua. Clique em "Deploy" de novo.
 * 6. Copie a URL do topo: https://proxy-fide.SEU-USUARIO.workers.dev
 * 7. Teste no navegador (deve aparecer o HTML do perfil):
 *    https://proxy-fide.SEU-USUARIO.workers.dev/?token=SUA_SENHA&url=https://ratings.fide.com/profile/44731736
 * 8. Na Vercel, em Settings → Environment Variables, crie:
 *    FIDE_PROXY = https://proxy-fide.SEU-USUARIO.workers.dev/?token=SUA_SENHA&url={url}
 *    e faça um novo deploy.
 * 9. Confira em https://SEU-SITE.vercel.app/api/diagnostico-fide?id=44731736
 */

/** Troque por uma senha sua: sem ela o Worker seria um proxy aberto. */
const TOKEN = 'troque-esta-senha'

/** Só a FIDE passa por aqui; qualquer outro destino é recusado. */
const ALVO_PERMITIDO = 'ratings.fide.com'

// Os mesmos cabeçalhos de navegador que verify-player.ts usa.
const HEADERS = {
  'User-Agent':
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
  Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  'Accept-Language': 'pt-BR,pt;q=0.9,en;q=0.8',
  Referer: 'https://ratings.fide.com/',
}

export default {
  async fetch(request) {
    const params = new URL(request.url).searchParams

    if (params.get('token') !== TOKEN) {
      return new Response('Token inválido', { status: 403 })
    }

    const alvo = params.get('url')

    if (!alvo) {
      return new Response('Faltou o parâmetro ?url=', { status: 400 })
    }

    let url

    try {
      url = new URL(alvo)
    } catch {
      return new Response('Endereço inválido em ?url=', { status: 400 })
    }

    if (url.hostname !== ALVO_PERMITIDO) {
      return new Response('Destino não permitido', { status: 403 })
    }

    let corpo
    let status
    let tipo

    try {
      const resposta = await fetch(url.toString(), {
        headers: HEADERS,
        signal: AbortSignal.timeout(20000),
      })

      status = resposta.status
      tipo = resposta.headers.get('content-type') ?? 'text/html; charset=utf-8'

      // O corpo é lido inteiro AQUI antes de responder. Repassar `resposta.body`
      // (o stream) devolvia a resposta vazia — só os 3 bytes do BOM. A página
      // tem ~95 KB, então bufferizar não custa nada.
      corpo = await resposta.text()
    } catch (erro) {
      return new Response(`Falha ao buscar a FIDE: ${erro.message}`, { status: 502 })
    }

    // `x-corpo-bytes` mostra no cabeçalho quantos bytes vieram da FIDE: é o que
    // diferencia "a FIDE não mandou conteúdo" de "o Worker perdeu o conteúdo".
    return new Response(corpo, {
      status,
      headers: {
        'content-type': tipo,
        'cache-control': 'no-store',
        'x-corpo-bytes': String(corpo.length),
      },
    })
  },
}
