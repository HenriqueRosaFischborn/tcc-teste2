import { beforeEach, describe, expect, it, vi } from 'vitest'

const {
    authMock,
    categoriaFindFirstMock,
    categoriaFindManyMock,
    divisoesFindManyMock,
    incricaoFindFirstMock,
    incricaoCreateMock,
    usuarioFindUniqueMock,
    sendNewMock,
    sendRequestedMock,
    verifyFideMock,
    verifyCbxMock
} = vi.hoisted(() => ({
    authMock: vi.fn(),
    categoriaFindFirstMock: vi.fn(),
    categoriaFindManyMock: vi.fn(),
    divisoesFindManyMock: vi.fn(),
    incricaoFindFirstMock: vi.fn(),
    incricaoCreateMock: vi.fn(),
    usuarioFindUniqueMock: vi.fn(),
    sendNewMock: vi.fn(),
    sendRequestedMock: vi.fn(),
    verifyFideMock: vi.fn(),
    verifyCbxMock: vi.fn()
}))

vi.mock('@/auth', () => ({ auth: authMock }))

vi.mock('@/lib/db', () => ({
    default: {
        categoria: { findFirst: categoriaFindFirstMock, findMany: categoriaFindManyMock },
        divisoes: { findMany: divisoesFindManyMock },
        incricao: { findFirst: incricaoFindFirstMock, create: incricaoCreateMock },
        usuario: { findUnique: usuarioFindUniqueMock }
    }
}))

vi.mock('@/lib/supabase', () => ({ getSupabaseAdmin: vi.fn() }))
vi.mock('@/app/torneios-abertos/[torneio]/form/verify-player', () => ({
    verifyFideId: verifyFideMock,
    verifyCbxId: verifyCbxMock
}))
vi.mock('@/app/api/email/new-inscription/send', () => ({ sendNewInscription: sendNewMock }))
vi.mock('@/app/api/email/inscription-solicited/send', () => ({ sendRequestedMessageEmail: sendRequestedMock }))

// `after` do Next roda a tarefa depois da resposta e só existe dentro de uma
// requisição: nos testes ela roda na hora.
vi.mock('next/server', () => ({ after: (tarefa: () => unknown) => tarefa() }))

import { submitInscription } from '@/app/torneios-abertos/[torneio]/form/submit-inscription'

const TORNEIO = BigInt(9)
const ID_USUARIO = 7

const DIV_MASC = BigInt(3)
const DIV_ABSOLUTA = BigInt(4)

const CAT_SUB12 = 'aaaa1111-1111-4111-8111-111111111111'
const CAT_SUB10 = 'bbbb2222-2222-4222-8222-222222222222'

const estadoInicial = { status: 'idle' as const }

function divisoes() {
    return [
        { id: DIV_MASC, name: 'Sub-12 Masculino', genre: 'masculino', isAbsolute: false },
        { id: DIV_ABSOLUTA, name: 'Absoluto', genre: 'ambos', isAbsolute: true }
    ]
}

function categorias() {
    return [
        { uuid: CAT_SUB12, name: 'Sub-12', min_y: 2010, max_y: 2013, default_division: DIV_MASC },
        { uuid: CAT_SUB10, name: 'Sub-10', min_y: 2014, max_y: 2017, default_division: DIV_MASC }
    ]
}

function formulario(uuidCat: string, borndate = '04/05/2012', ids: { fide?: string, cbx?: string } = {}) {
    const formdata = new FormData()

    formdata.set('name', 'Fulano de Tal')
    formdata.set('city', 'Araranguá')
    formdata.set('team', 'CXA')
    formdata.set('borndate', borndate)
    formdata.set('genre', 'masc')
    formdata.set('uuidCat', uuidCat)
    formdata.set('division', 'Absoluto')
    formdata.set('fileComprovante', new File([], ''))

    if (ids.fide !== undefined || ids.cbx !== undefined) {
        formdata.set('hasFide', 'true')
        formdata.set('idfide', ids.fide ?? '')
        formdata.set('idcbx', ids.cbx ?? '')
    } else {
        formdata.set('hasFide', 'false')
    }

    return formdata
}

beforeEach(() => {
    authMock.mockReset().mockResolvedValue({ user: { email: 'jogador@exemplo.com' } })

    categoriaFindFirstMock.mockReset().mockResolvedValue({
        uuid: CAT_SUB12,
        name: 'Sub-12',
        id_torneio: TORNEIO,
        min_y: 2010,
        max_y: 2013,
        default_division: DIV_MASC,
        torneio: {
            title: 'Torneio de Teste',
            date_inscri: new Date('2099-01-01T00:00:00.000Z'),
            inscri_closed_by_arbiter: false,
            tempo_torneio_time_digitalTotempo: null
        }
    })

    categoriaFindManyMock.mockReset().mockResolvedValue(categorias())
    divisoesFindManyMock.mockReset().mockResolvedValue(divisoes())
    incricaoFindFirstMock.mockReset().mockResolvedValue(null)
    incricaoCreateMock.mockReset().mockResolvedValue({
        uuid: '99999999-9999-4999-8999-999999999999',
        city: 'Araranguá',
        club: 'CXA',
        genre: true,
        data_nasc: new Date('2012-05-04'),
        id_fide: null,
        id_cbx: null,
        uuid_cat: CAT_SUB12,
        status: 'Pendente',
        id_usuario: ID_USUARIO,
        name: 'Fulano de Tal',
        id_division: DIV_ABSOLUTA,
        id_torneio: TORNEIO,
        rtg_fide: null,
        rtg_cbx: null,
        federation: 'BRA',
        titulo: null
    })
    usuarioFindUniqueMock.mockReset().mockResolvedValue({ id: ID_USUARIO, email: 'jogador@exemplo.com' })

    sendNewMock.mockReset().mockResolvedValue({ success: true })
    sendRequestedMock.mockReset().mockResolvedValue({ success: true })

    verifyFideMock.mockReset().mockResolvedValue({ status: 'unavailable' })
    verifyCbxMock.mockReset().mockResolvedValue({ status: 'unavailable' })
})

describe('T15 — torneio encerrado não aceita inscrição nova', () => {
    it('recusa quando o árbitro encerrou as inscrições', async () => {
        categoriaFindFirstMock.mockResolvedValue({
            ...await categoriaFindFirstMock.getMockImplementation()!(),
            torneio: {
                title: 'Torneio',
                date_inscri: new Date('2099-01-01T00:00:00.000Z'),
                inscri_closed_by_arbiter: true,
                tempo_torneio_time_digitalTotempo: null
            }
        })

        const resultado = await submitInscription(estadoInicial, formulario(CAT_SUB12))

        expect(resultado.status).toBe('error')
        expect(resultado.status === 'error' && resultado.message).toMatch(/encerradas pelo árbitro/i)
        expect(incricaoCreateMock).not.toHaveBeenCalled()
    })

    it('recusa quando o prazo terminou', async () => {
        categoriaFindFirstMock.mockResolvedValue({
            uuid: CAT_SUB12,
            name: 'Sub-12',
            id_torneio: TORNEIO,
            min_y: 2010,
            max_y: 2013,
            default_division: DIV_MASC,
            torneio: {
                title: 'Torneio',
                date_inscri: new Date('2020-01-01T00:00:00.000Z'),
                inscri_closed_by_arbiter: false,
                tempo_torneio_time_digitalTotempo: null
            }
        })

        const resultado = await submitInscription(estadoInicial, formulario(CAT_SUB12))

        expect(resultado.status).toBe('error')
        expect(resultado.status === 'error' && resultado.message).toMatch(/prazo/i)
        expect(incricaoCreateMock).not.toHaveBeenCalled()
    })
})

describe('T15/T17 — categoria manipulada é recusada', () => {
    it('recusa categoria que não está no torneio', async () => {
        // A categoria existe no banco (findFirst devolve), mas não está na lista
        // do torneio — é o que aconteceria com um uuid de outro torneio.
        categoriaFindManyMock.mockResolvedValue([
            { uuid: CAT_SUB10, name: 'Sub-10', min_y: 2014, max_y: 2017, default_division: DIV_MASC }
        ])

        const resultado = await submitInscription(estadoInicial, formulario(CAT_SUB12))

        expect(resultado.status).toBe('error')
        expect(resultado.status === 'error' && resultado.message).toMatch(/não pertence a este torneio/i)
        expect(incricaoCreateMock).not.toHaveBeenCalled()
    })

    it('recusa categoria de idade incompatível quando outra cobre o ano', async () => {
        // Nascido em 2012 escolhendo a Sub-10 (2014-2017).
        categoriaFindFirstMock.mockResolvedValue({
            uuid: CAT_SUB10,
            name: 'Sub-10',
            id_torneio: TORNEIO,
            min_y: 2014,
            max_y: 2017,
            default_division: DIV_MASC,
            torneio: {
                title: 'Torneio',
                date_inscri: new Date('2099-01-01T00:00:00.000Z'),
                inscri_closed_by_arbiter: false,
                tempo_torneio_time_digitalTotempo: null
            }
        })

        const resultado = await submitInscription(estadoInicial, formulario(CAT_SUB10))

        expect(resultado.status).toBe('error')
        expect(resultado.status === 'error' && resultado.message).toMatch(/não corresponde à idade/i)
        expect(incricaoCreateMock).not.toHaveBeenCalled()
    })

    it('recusa categoria de divisão feminina para jogador masculino', async () => {
        divisoesFindManyMock.mockResolvedValue([
            { id: DIV_MASC, name: 'Sub-12 Masculino', genre: 'feminino', isAbsolute: false },
            { id: DIV_ABSOLUTA, name: 'Absoluto', genre: 'ambos', isAbsolute: true }
        ])

        const resultado = await submitInscription(estadoInicial, formulario(CAT_SUB12))

        expect(resultado.status).toBe('error')
        expect(resultado.status === 'error' && resultado.message).toMatch(/gênero/i)
        expect(incricaoCreateMock).not.toHaveBeenCalled()
    })

    it('recusa data de nascimento inválida', async () => {
        const resultado = await submitInscription(estadoInicial, formulario(CAT_SUB12, '99/99/0000'))

        expect(resultado.status).toBe('error')
        expect(incricaoCreateMock).not.toHaveBeenCalled()
    })
})

describe('T15/T17 — inscrição válida continua funcionando', () => {
    it('grava a inscrição e responde sucesso', async () => {
        const resultado = await submitInscription(estadoInicial, formulario(CAT_SUB12))

        expect(resultado).toEqual({ status: 'success' })
        expect(incricaoCreateMock).toHaveBeenCalledTimes(1)
    })

    it('grava a divisão absoluta quando o jogador a escolhe', async () => {
        await submitInscription(estadoInicial, formulario(CAT_SUB12))

        expect(incricaoCreateMock).toHaveBeenCalledWith(
            expect.objectContaining({
                data: expect.objectContaining({ id_division: DIV_ABSOLUTA })
            })
        )
    })
})

/* ================================================================== *
 * T12 — duplicidade por identidade do jogador
 * ================================================================== */

describe('T12 — duplicidade é do jogador, não da conta', () => {
    it('recusa quando o mesmo ID CBX já está inscrito no torneio', async () => {
        incricaoFindFirstMock.mockResolvedValue({ uuid: 'outro-uuid', name: 'Fulano' })

        const resultado = await submitInscription(
            estadoInicial,
            formulario(CAT_SUB12, '04/05/2012', { cbx: '456' })
        )

        expect(resultado).toEqual({ status: 'duplicate' })
        expect(incricaoCreateMock).not.toHaveBeenCalled()
    })

    it('recusa quando o mesmo ID FIDE já está inscrito no torneio', async () => {
        incricaoFindFirstMock.mockResolvedValue({ uuid: 'outro-uuid', name: 'Fulano' })

        const resultado = await submitInscription(
            estadoInicial,
            formulario(CAT_SUB12, '04/05/2012', { fide: '123' })
        )

        expect(resultado).toEqual({ status: 'duplicate' })
    })

    it('a checagem não filtra pela conta — vários jogadores na mesma conta passam', async () => {
        await submitInscription(estadoInicial, formulario(CAT_SUB12, '04/05/2012', { fide: '123' }))

        const where = incricaoFindFirstMock.mock.calls[0][0].where as Record<string, unknown>

        expect(where).not.toHaveProperty('id_usuario')
        expect(where.id_torneio).toBe(TORNEIO)
    })

    it('jogador sem ID nenhum não passa pela checagem e inscreve normalmente', async () => {
        const resultado = await submitInscription(estadoInicial, formulario(CAT_SUB12))

        expect(resultado).toEqual({ status: 'success' })
        expect(incricaoFindFirstMock).not.toHaveBeenCalled()
    })
})
