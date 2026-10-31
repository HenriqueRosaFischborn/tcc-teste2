import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { verifyCbxId, verifyFideId } from '@/app/torneios-abertos/[torneio]/form/verify-player'

/** HTML mínimo com o mesmo esqueleto que a FIDE usa no perfil do jogador. */
const paginaDoJogador = `
<html><body>
  <div class="player-title">Fischborn, Henrique Da Rosa</div>
  <div class="profile-info-byear">2009</div>
  <div class="profile-info-sex">Male</div>
  <div class="profile-info-country"><img src="/images/flags/br.svg" /></div>
  <div class="profile-info-row">FIDE title None</div>
  <div class="profile-games">Not rated 1560 1596</div>
</body></html>`

const paginaDeBloqueio = '<html><body><h1>Access denied</h1></body></html>'
const paginaSemJogador = '<html><body><p>No record found for this ID</p></body></html>'

const resposta = (html: string, status = 200) =>
    ({ ok: status >= 200 && status < 300, status, text: async () => html }) as Response

const fetchMock = vi.fn()

beforeEach(() => {
    fetchMock.mockReset()
    vi.stubGlobal('fetch', fetchMock)
    // As falhas são registradas de propósito no servidor; o teste não precisa do ruído.
    vi.spyOn(console, 'error').mockImplementation(() => {})
})

afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
})

describe('verifyFideId', () => {
    it('extrai os dados do perfil', async () => {
        fetchMock.mockResolvedValueOnce(resposta(paginaDoJogador))

        const resultado = await verifyFideId('44731736')

        expect(resultado).toEqual({
            status: 'found',
            player: {
                name: 'Fischborn, Henrique Da Rosa',
                bornYear: '2009',
                genre: 'm',
                title: null,
                federation: 'BRA',
                idFide: '44731736',
                ratings: { standard: null, rapid: 1560, blitz: 1596 },
            },
        })
    })

    it('consulta a FIDE com cabeçalhos de navegador', async () => {
        fetchMock.mockResolvedValueOnce(resposta(paginaDoJogador))

        await verifyFideId('44731736')

        const [url, opcoes] = fetchMock.mock.calls[0]
        expect(url).toBe('https://ratings.fide.com/profile/44731736')
        expect(opcoes.headers.Referer).toBe('https://ratings.fide.com/')
        expect(opcoes.signal).toBeDefined()
    })

    it('trata "no record found" como jogador inexistente', async () => {
        fetchMock.mockResolvedValueOnce(resposta(paginaSemJogador))

        await expect(verifyFideId('1111111')).resolves.toEqual({ status: 'not-found' })
    })

    it('devolve disponível de novo quando a FIDE responde sem o perfil', async () => {
        fetchMock.mockResolvedValue(resposta(paginaDeBloqueio))

        const resultado = await verifyFideId('44731736')

        expect(resultado.status).toBe('unavailable')
        expect(resultado).toMatchObject({ motivo: 'página inesperada da FIDE' })
    })

    it('tenta de novo e funciona quando a primeira requisição falha', async () => {
        fetchMock
            .mockResolvedValueOnce(resposta('', 503))
            .mockResolvedValueOnce(resposta(paginaDoJogador))

        await expect(verifyFideId('44731736')).resolves.toMatchObject({ status: 'found' })
        expect(fetchMock).toHaveBeenCalledTimes(2)
    })

    it('devolve o motivo da falha quando todas as tentativas falham', async () => {
        fetchMock.mockResolvedValue(resposta('', 503))

        const resultado = await verifyFideId('44731736')

        expect(resultado).toEqual({ status: 'unavailable', motivo: 'HTTP 503' })
        expect(fetchMock).toHaveBeenCalledTimes(2)
    })

    it('não repete quando o site não responde (conexão descartada)', async () => {
        // É o caso da FIDE com IP de datacenter: a conexão fica pendurada. Repetir
        // dobraria a espera do jogador sem chance de dar certo.
        fetchMock.mockImplementation(
            (_url: string, opcoes: { signal: AbortSignal }) =>
                new Promise((_resolve, reject) => {
                    opcoes.signal.addEventListener('abort', () => {
                        const erro = new Error('The operation was aborted due to timeout')
                        erro.name = 'TimeoutError'
                        reject(erro)
                    })
                })
        )

        const resultado = await verifyFideId('44731736', { prazoMs: 1500 })

        expect(resultado).toEqual({ status: 'unavailable', motivo: 'tempo esgotado' })
        expect(fetchMock).toHaveBeenCalledTimes(1)
    })

    it('resume o erro de rede em vez de deixar o formulário sem explicação', async () => {
        fetchMock.mockRejectedValue(new Error('getaddrinfo ENOTFOUND ratings.fide.com'))

        const resultado = await verifyFideId('44731736')

        expect(resultado.status).toBe('unavailable')
        expect(resultado).toMatchObject({ motivo: 'getaddrinfo ENOTFOUND ratings.fide.com' })
    })
})

describe('verifyFideId com proxy de saída', () => {
    // A FIDE não atende IP de nuvem; FIDE_PROXY desvia só a consulta dela.
    const comProxy = (template: string, teste: () => Promise<void>) => async () => {
        process.env.FIDE_PROXY = template

        try {
            await teste()
        } finally {
            delete process.env.FIDE_PROXY
        }
    }

    it('passa a consulta pelo template quando FIDE_PROXY está definido', comProxy(
        'https://proxy.exemplo/raw?url={url}',
        async () => {
            fetchMock.mockResolvedValueOnce(resposta(paginaDoJogador))

            await expect(verifyFideId('44731736')).resolves.toMatchObject({ status: 'found' })

            const [url] = fetchMock.mock.calls[0]
            expect(url).toBe(
                'https://proxy.exemplo/raw?url=https%3A%2F%2Fratings.fide.com%2Fprofile%2F44731736'
            )
        }
    ))

    it('anexa o endereço quando o template não tem {url}', comProxy(
        'https://proxy.exemplo/fetch?url=',
        async () => {
            fetchMock.mockResolvedValueOnce(resposta(paginaDoJogador))

            await verifyFideId('44731736')

            const [url] = fetchMock.mock.calls[0]
            expect(url).toBe(
                'https://proxy.exemplo/fetch?url=https%3A%2F%2Fratings.fide.com%2Fprofile%2F44731736'
            )
        }
    ))

    it('não vaza a chave do proxy no log da Vercel', comProxy(
        'https://api.scraperapi.com/?api_key=SEGREDO&url={url}',
        async () => {
            fetchMock.mockResolvedValue(resposta('', 503))

            await verifyFideId('44731736')

            const registrado = vi
                .mocked(console.error)
                .mock.calls.map((chamada) => chamada.join(' '))
                .join('\n')

            expect(registrado).toContain('api.scraperapi.com')
            expect(registrado).not.toContain('SEGREDO')
        }
    ))

    it('mantém a consulta direta quando a variável não existe', async () => {
        fetchMock.mockResolvedValueOnce(resposta(paginaDoJogador))

        await verifyFideId('44731736')

        expect(fetchMock.mock.calls[0][0]).toBe('https://ratings.fide.com/profile/44731736')
    })

    it('não desvia a consulta da CBX, que responde normalmente', comProxy(
        'https://proxy.exemplo/raw?url={url}',
        async () => {
            fetchMock.mockResolvedValueOnce(resposta('<html><body></body></html>'))

            await verifyCbxId('76967')

            expect(fetchMock.mock.calls[0][0]).toBe('https://www.cbx.org.br/jogador/76967')
        }
    ))
})

describe('verifyCbxId', () => {
    const paginaCbx = `
    <html><body>
      <div id="dados-jogador-row1">Henrique da Rosa Fischborn Data Nasc.: 23/05/2009 ID FIDE: 44731736</div>
      <table id="ContentPlaceHolder1_gdvRating"><tr><td>Mai/2026</td><td>1786</td><td>1790</td><td>1751</td></tr></table>
    </body></html>`

    it('extrai os dados do perfil', async () => {
        fetchMock.mockResolvedValueOnce(resposta(paginaCbx))

        await expect(verifyCbxId('76967')).resolves.toEqual({
            status: 'found',
            player: {
                name: 'Henrique da Rosa Fischborn',
                bornYear: '23/05/2009',
                genre: null,
                title: null,
                federation: null,
                idFide: '44731736',
                ratings: { standard: 1786, rapid: 1790, blitz: 1751 },
            },
        })
    })

    it('devolve o motivo quando a CBX está fora do ar', async () => {
        fetchMock.mockResolvedValue(resposta('', 502))

        await expect(verifyCbxId('76967')).resolves.toEqual({ status: 'unavailable', motivo: 'HTTP 502' })
    })
})
