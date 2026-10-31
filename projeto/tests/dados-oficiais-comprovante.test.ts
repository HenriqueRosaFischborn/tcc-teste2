import { beforeEach, describe, expect, it, vi } from 'vitest'

const {
    authMock,
    categoriaFindFirstMock,
    categoriaFindManyMock,
    divisoesFindManyMock,
    incricaoFindFirstMock,
    incricaoCreateMock,
    incricaoDeleteMock,
    usuarioFindUniqueMock,
    verifyFideMock,
    verifyCbxMock,
    uploadMock,
    sendNewMock,
    sendRequestedMock
} = vi.hoisted(() => ({
    authMock: vi.fn(),
    categoriaFindFirstMock: vi.fn(),
    categoriaFindManyMock: vi.fn(),
    divisoesFindManyMock: vi.fn(),
    incricaoFindFirstMock: vi.fn(),
    incricaoCreateMock: vi.fn(),
    incricaoDeleteMock: vi.fn(),
    usuarioFindUniqueMock: vi.fn(),
    verifyFideMock: vi.fn(),
    verifyCbxMock: vi.fn(),
    uploadMock: vi.fn(),
    sendNewMock: vi.fn(),
    sendRequestedMock: vi.fn()
}))

vi.mock('@/auth', () => ({ auth: authMock }))

vi.mock('@/lib/db', () => ({
    default: {
        categoria: { findFirst: categoriaFindFirstMock, findMany: categoriaFindManyMock },
        divisoes: { findMany: divisoesFindManyMock },
        incricao: {
            findFirst: incricaoFindFirstMock,
            create: incricaoCreateMock,
            delete: incricaoDeleteMock
        },
        usuario: { findUnique: usuarioFindUniqueMock }
    }
}))

vi.mock('@/app/torneios-abertos/[torneio]/form/verify-player', () => ({
    verifyFideId: verifyFideMock,
    verifyCbxId: verifyCbxMock
}))

vi.mock('@/lib/supabase', () => ({
    getSupabaseAdmin: vi.fn().mockResolvedValue({
        storage: { from: () => ({ upload: uploadMock }) }
    })
}))

vi.mock('@/app/api/email/new-inscription/send', () => ({ sendNewInscription: sendNewMock }))
vi.mock('@/app/api/email/inscription-solicited/send', () => ({ sendRequestedMessageEmail: sendRequestedMock }))

// `after` do Next roda a tarefa depois da resposta e só existe dentro de uma
// requisição: nos testes ela roda na hora.
vi.mock('next/server', () => ({ after: (tarefa: () => unknown) => tarefa() }))

import { submitInscription } from '@/app/torneios-abertos/[torneio]/form/submit-inscription'

const TORNEIO = BigInt(9)
const DIV_MASC = BigInt(3)
const UUID_CAT = 'aaaa1111-1111-4111-8111-111111111111'
const UUID_INSCRICAO = '99999999-9999-4999-8999-999999999999'

const estadoInicial = { status: 'idle' as const }

const payloadForjado = JSON.stringify({
    name: 'Nome Inventado',
    bornYear: '1990',
    genre: 'm',
    title: 'GM',
    federation: 'RUS',
    idFide: '123',
    ratings: { standard: 3000, rapid: 3000, blitz: 3000 }
})

function formulario(opcoes: {
    hasFide?: boolean,
    comprovante?: File,
    playerFide?: string
} = {}) {
    const formdata = new FormData()

    formdata.set('name', 'Fulano Digitado')
    formdata.set('city', 'Araranguá')
    formdata.set('team', 'CXA')
    formdata.set('borndate', '04/05/2012')
    formdata.set('genre', 'masc')
    formdata.set('uuidCat', UUID_CAT)
    formdata.set('division', 'Absoluto')
    formdata.set('hasFide', opcoes.hasFide ? 'true' : 'false')

    if (opcoes.hasFide) {
        formdata.set('idfide', '123')
        formdata.set('idcbx', '456')
    }

    if (opcoes.playerFide !== undefined) formdata.set('playerFide', opcoes.playerFide)
    if (opcoes.comprovante) formdata.set('fileComprovante', opcoes.comprovante)

    return formdata
}

function arquivo(nome: string, tipo: string, tamanho: number) {
    return new File([new Uint8Array(tamanho)], nome, { type: tipo })
}

beforeEach(() => {
    authMock.mockReset().mockResolvedValue({ user: { email: 'jogador@exemplo.com' } })

    categoriaFindFirstMock.mockReset().mockResolvedValue({
        uuid: UUID_CAT,
        name: 'Sub-12',
        id_torneio: TORNEIO,
        min_y: 2010,
        max_y: 2013,
        default_division: DIV_MASC,
        torneio: {
            title: 'Torneio',
            date_inscri: new Date('2099-01-01T00:00:00.000Z'),
            inscri_closed_by_arbiter: false,
            tempo_torneio_time_digitalTotempo: null
        }
    })

    categoriaFindManyMock.mockReset().mockResolvedValue([
        { uuid: UUID_CAT, name: 'Sub-12', min_y: 2010, max_y: 2013, default_division: DIV_MASC }
    ])
    divisoesFindManyMock.mockReset().mockResolvedValue([
        { id: DIV_MASC, name: 'Sub-12', genre: 'masculino', isAbsolute: false }
    ])
    incricaoFindFirstMock.mockReset().mockResolvedValue(null)
    incricaoDeleteMock.mockReset().mockResolvedValue({})
    usuarioFindUniqueMock.mockReset().mockResolvedValue({ id: 7, email: 'jogador@exemplo.com' })

    incricaoCreateMock.mockReset().mockResolvedValue({
        uuid: UUID_INSCRICAO,
        city: 'Araranguá',
        club: 'CXA',
        genre: true,
        data_nasc: new Date('2012-05-04'),
        id_fide: BigInt(123),
        id_cbx: null,
        uuid_cat: UUID_CAT,
        status: 'Pendente',
        id_usuario: 7,
        name: 'Nome Oficial',
        id_division: DIV_MASC,
        id_torneio: TORNEIO,
        rtg_fide: BigInt(1800),
        rtg_cbx: null,
        federation: 'BRA',
        titulo: null
    })

    verifyFideMock.mockReset()
    verifyCbxMock.mockReset()
    uploadMock.mockReset().mockResolvedValue({ error: null })
    sendNewMock.mockReset().mockResolvedValue({ success: true })
    sendRequestedMock.mockReset().mockResolvedValue({ success: true })
})

/* ================================================================== *
 * T16 — dados oficiais
 * ================================================================== */

describe('T16 — o JSON do navegador não define os dados oficiais', () => {
    it('usa o que a FIDE devolve, ignorando o payload forjado', async () => {
        verifyFideMock.mockResolvedValue({
            status: 'found',
            player: {
                name: 'Nome Oficial',
                bornYear: '2012',
                genre: 'm',
                title: 'MF',
                federation: 'BRA',
                idFide: '123',
                ratings: { standard: 1800, rapid: 1750, blitz: 1700 }
            }
        })
        verifyCbxMock.mockResolvedValue({ status: 'not-found' })

        await submitInscription(estadoInicial, formulario({
            hasFide: true,
            playerFide: payloadForjado
        }))

        const dados = incricaoCreateMock.mock.calls[0][0].data

        expect(dados.name).toBe('Nome Oficial')
        expect(dados.federation).toBe('BRA')
        expect(dados.titulo).toBe('MF')
        expect(dados.rtg_fide).toBe(1800)
        expect(dados.name).not.toBe('Nome Inventado')
        expect(dados.rtg_fide).not.toBe(3000)
    })

    it('site oficial fora do ar não bloqueia a inscrição', async () => {
        verifyFideMock.mockResolvedValue({ status: 'unavailable' })
        verifyCbxMock.mockResolvedValue({ status: 'unavailable' })

        const resultado = await submitInscription(estadoInicial, formulario({
            hasFide: true,
            playerFide: payloadForjado
        }))

        expect(resultado).toEqual({ status: 'success' })

        const dados = incricaoCreateMock.mock.calls[0][0].data
        expect(dados.name).toBe('Fulano Digitado')
        expect(dados.rtg_fide).toBe(null)
        expect(dados.federation).toBeUndefined()
        expect(dados.titulo).toBeUndefined()
    })

    it('jogador sem FIDE nem CBX não consulta nada e usa o nome digitado', async () => {
        const resultado = await submitInscription(estadoInicial, formulario({ hasFide: false }))

        expect(resultado).toEqual({ status: 'success' })
        expect(verifyFideMock).not.toHaveBeenCalled()
        expect(verifyCbxMock).not.toHaveBeenCalled()
        expect(incricaoCreateMock.mock.calls[0][0].data.name).toBe('Fulano Digitado')
    })
})

/* ================================================================== *
 * T18 — comprovante
 * ================================================================== */

describe('T18 — validação do comprovante antes de gravar', () => {
    it('recusa arquivo que não é imagem', async () => {
        const resultado = await submitInscription(
            estadoInicial,
            formulario({ comprovante: arquivo('comprovante.pdf', 'application/pdf', 1024) })
        )

        expect(resultado.status).toBe('error')
        expect(resultado.status === 'error' && resultado.message).toMatch(/precisa ser uma imagem/i)
        expect(incricaoCreateMock).not.toHaveBeenCalled()
    })

    it('aceita qualquer formato de imagem, não só JPG e PNG', async () => {
        const resultado = await submitInscription(
            estadoInicial,
            formulario({ comprovante: arquivo('print.webp', 'image/webp', 4096) })
        )

        expect(resultado).toEqual({ status: 'success' })
        expect(uploadMock).toHaveBeenCalledTimes(1)
    })

    it('aceita imagem sem MIME quando a extensão é de imagem', async () => {
        const resultado = await submitInscription(
            estadoInicial,
            formulario({ comprovante: arquivo('foto.heic', '', 4096) })
        )

        expect(resultado).toEqual({ status: 'success' })
        expect(uploadMock).toHaveBeenCalledTimes(1)
    })

    it('recusa arquivo acima do limite de 20 MB', async () => {
        const resultado = await submitInscription(
            estadoInicial,
            formulario({ comprovante: arquivo('foto.png', 'image/png', 20 * 1024 * 1024 + 1) })
        )

        expect(resultado.status).toBe('error')
        expect(resultado.status === 'error' && resultado.message).toMatch(/limite é 20 MB/i)
        expect(incricaoCreateMock).not.toHaveBeenCalled()
    })

    it('aceita imagem grande, desde que abaixo de 20 MB', async () => {
        const resultado = await submitInscription(
            estadoInicial,
            formulario({ comprovante: arquivo('foto.png', 'image/png', 12 * 1024 * 1024) })
        )

        expect(resultado).toEqual({ status: 'success' })
        expect(uploadMock).toHaveBeenCalledTimes(1)
    })

    it('aceita imagem dentro do limite e envia', async () => {
        const resultado = await submitInscription(
            estadoInicial,
            formulario({ comprovante: arquivo('foto.png', 'image/png', 2048) })
        )

        expect(resultado).toEqual({ status: 'success' })
        expect(uploadMock).toHaveBeenCalledTimes(1)
    })
})

describe('T18 — falha no upload não vira "inscrição concluída"', () => {
    it('desfaz a inscrição, avisa o jogador e não envia e-mail', async () => {
        uploadMock.mockResolvedValue({ error: { message: 'storage fora' } })

        const resultado = await submitInscription(
            estadoInicial,
            formulario({ comprovante: arquivo('foto.png', 'image/png', 2048) })
        )

        expect(resultado.status).toBe('error')
        expect(resultado.status === 'error' && resultado.message).toMatch(/não foi concluída/i)

        // Estado consistente: a inscrição criada foi removida.
        expect(incricaoDeleteMock).toHaveBeenCalledWith({ where: { uuid: UUID_INSCRICAO } })
        expect(sendNewMock).not.toHaveBeenCalled()
        expect(sendRequestedMock).not.toHaveBeenCalled()
    })

    it('exceção no upload também desfaz', async () => {
        uploadMock.mockRejectedValue(new Error('rede caiu'))

        const resultado = await submitInscription(
            estadoInicial,
            formulario({ comprovante: arquivo('foto.png', 'image/png', 2048) })
        )

        expect(resultado.status).toBe('error')
        expect(incricaoDeleteMock).toHaveBeenCalledTimes(1)
    })

    it('se o próprio desfazer falhar, a mensagem diz que a inscrição ficou registrada', async () => {
        uploadMock.mockResolvedValue({ error: { message: 'storage fora' } })
        incricaoDeleteMock.mockRejectedValue(new Error('banco fora'))

        const resultado = await submitInscription(
            estadoInicial,
            formulario({ comprovante: arquivo('foto.png', 'image/png', 2048) })
        )

        expect(resultado.status).toBe('error')
        // Não pode afirmar que desfez o que não foi desfeito.
        expect(resultado.status === 'error' && resultado.message).toMatch(/ficou registrada sem comprovante/i)
        expect(resultado.status === 'error' && resultado.message).not.toMatch(/não foi concluída/i)
    })
})
