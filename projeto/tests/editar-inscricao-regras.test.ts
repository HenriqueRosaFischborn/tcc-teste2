import { beforeEach, describe, expect, it, vi } from 'vitest'

const {
    requireUserMock,
    findFirstMock,
    updateManyMock,
    categoriaFindFirstMock,
    categoriaFindManyMock,
    divisoesFindManyMock,
    sendEmailMock,
    verifyFideMock,
    verifyCbxMock
} = vi.hoisted(() => ({
    requireUserMock: vi.fn(),
    findFirstMock: vi.fn(),
    updateManyMock: vi.fn(),
    categoriaFindFirstMock: vi.fn(),
    categoriaFindManyMock: vi.fn(),
    divisoesFindManyMock: vi.fn(),
    sendEmailMock: vi.fn(),
    verifyFideMock: vi.fn(),
    verifyCbxMock: vi.fn()
}))

vi.mock('@/lib/auth-guard', () => {
    class UnauthorizedError extends Error {
        readonly reason: string

        constructor(reason: string) {
            super('não autorizado')
            this.name = 'UnauthorizedError'
            this.reason = reason
        }
    }

    return { requireUser: requireUserMock, UnauthorizedError }
})

vi.mock('@/lib/db', () => ({
    default: {
        incricao: { findFirst: findFirstMock, updateMany: updateManyMock },
        categoria: { findFirst: categoriaFindFirstMock, findMany: categoriaFindManyMock },
        divisoes: { findMany: divisoesFindManyMock }
    }
}))

vi.mock('@/lib/supabase', () => ({ getSupabaseAdmin: vi.fn() }))
vi.mock('@/app/api/email/update-infos/send', () => ({ sendUpdateInscriptionEmail: sendEmailMock }))
vi.mock('@/app/torneios-abertos/[torneio]/form/verify-player', () => ({
    verifyFideId: verifyFideMock,
    verifyCbxId: verifyCbxMock
}))

import actionInscriIndividual from '@/app/minhas-inscricoes/[inscricao]/editar-informacoes/form/action'

const USUARIO = 7
const UUID_ATUAL = '11111111-1111-4111-8111-111111111111'

const TORNEIO = BigInt(9)
const OUTRO_TORNEIO = BigInt(77)
const DIV_MASC = BigInt(3)
const DIV_ABSOLUTA = BigInt(4)

const CAT_ATUAL = 'aaaa1111-1111-4111-8111-111111111111'
const CAT_DE_OUTRO_TORNEIO = 'bbbb2222-2222-4222-8222-222222222222'

/** Linha de `incricao` como o Prisma devolve com `include`. */
function inscricao(idTorneio = TORNEIO) {
    return {
        uuid: UUID_ATUAL,
        name: 'Fulano de Tal',
        city: 'Araranguá',
        club: 'CXA',
        genre: true,
        data_nasc: new Date('2012-05-04T00:00:00.000Z'),
        id_fide: null,
        id_cbx: null,
        uuid_cat: CAT_ATUAL,
        status: 'Pendente',
        id_usuario: USUARIO,
        id_division: DIV_MASC,
        id_torneio: idTorneio,
        rtg_fide: null as bigint | null,
        rtg_cbx: null as bigint | null,
        federation: 'BRA',
        titulo: null,
        categoria: { name: 'Sub-12', uuid: CAT_ATUAL, id_torneio: idTorneio, min_y: 2010 },
        divisoes: { name: 'Sub-12 Masculino', id: DIV_MASC },
        usuario: { id: USUARIO, email: 'jogador@exemplo.com' }
    }
}

let linha: ReturnType<typeof inscricao>

function formulario(uuidCat: string, idfide = '', idcbx = '') {
    const formdata = new FormData()

    formdata.set('uuid', UUID_ATUAL)
    formdata.set('name', 'Fulano de Tal')
    formdata.set('city', 'Araranguá')
    formdata.set('team', 'CXA')
    formdata.set('borndate', '04/05/2012')
    formdata.set('genre', 'masc')
    formdata.set('uuidCat', uuidCat)
    formdata.set('idfide', idfide)
    formdata.set('idcbx', idcbx)
    formdata.set('hasFide', 'false')
    formdata.set('division', 'Absoluto')
    formdata.set('fileComprovante', new File([], ''))

    return formdata
}

const anterior = {}

beforeEach(() => {
    linha = inscricao()

    requireUserMock.mockReset().mockResolvedValue({
        id: USUARIO,
        email: 'jogador@exemplo.com',
        admin: false,
        socio: false
    })

    findFirstMock.mockReset().mockImplementation(
        async ({ where }: { where: { uuid?: string, id_usuario?: number } }) => {
            if (where.uuid !== undefined && where.uuid !== linha.uuid) return null
            if (where.id_usuario !== undefined && where.id_usuario !== linha.id_usuario) return null

            return linha
        }
    )

    updateManyMock.mockReset().mockResolvedValue({ count: 1 })

    categoriaFindFirstMock.mockReset().mockImplementation(
        async ({ where }: { where: { uuid: string } }) => ({
            uuid: where.uuid,
            name: 'Sub-12',
            // A categoria de outro torneio é o caso de manipulação.
            id_torneio: where.uuid === CAT_DE_OUTRO_TORNEIO ? OUTRO_TORNEIO : TORNEIO,
            min_y: 2010,
            max_y: 2013,
            default_division: DIV_MASC,
            torneio: { title: 'Torneio de Teste', tempo_torneio_time_digitalTotempo: null }
        })
    )

    categoriaFindManyMock.mockReset().mockResolvedValue([
        { uuid: CAT_ATUAL, name: 'Sub-12', min_y: 2010, max_y: 2013, default_division: DIV_MASC }
    ])

    divisoesFindManyMock.mockReset().mockResolvedValue([
        { id: DIV_MASC, name: 'Sub-12 Masculino', genre: 'masculino', isAbsolute: false },
        { id: DIV_ABSOLUTA, name: 'Absoluto', genre: 'ambos', isAbsolute: true }
    ])

    sendEmailMock.mockReset().mockResolvedValue({ ok: true })

    verifyFideMock.mockReset().mockResolvedValue({ status: 'unavailable' })
    verifyCbxMock.mockReset().mockResolvedValue({ status: 'unavailable' })
})

describe('T15 — a edição não transfere a inscrição de torneio', () => {
    it('recusa categoria de outro torneio', async () => {
        const resultado = await actionInscriIndividual(anterior, formulario(CAT_DE_OUTRO_TORNEIO))

        expect(resultado.message?.[0]).toMatch(/não pertence ao torneio desta inscrição/i)
        expect(updateManyMock).not.toHaveBeenCalled()
    })

    it('não escreve id_torneio na atualização', async () => {
        const resultado = await actionInscriIndividual(anterior, formulario(CAT_ATUAL))

        expect(resultado.message?.[0]).toBe('Sucesso')

        const dados = updateManyMock.mock.calls[0][0].data as Record<string, unknown>
        expect(dados).not.toHaveProperty('id_torneio')
    })

    it('prazo vencido não impede corrigir uma inscrição existente', async () => {
        // O torneio já encerrou (nada na action consulta prazo), e a edição passa.
        const resultado = await actionInscriIndividual(anterior, formulario(CAT_ATUAL))

        expect(resultado.message?.[0]).toBe('Sucesso')
        expect(updateManyMock).toHaveBeenCalledTimes(1)
    })
})

describe('T17 — idade e gênero na edição', () => {
    it('recusa categoria de gênero incompatível', async () => {
        divisoesFindManyMock.mockResolvedValue([
            { id: DIV_MASC, name: 'Sub-12 Masculino', genre: 'feminino', isAbsolute: false },
            { id: DIV_ABSOLUTA, name: 'Absoluto', genre: 'ambos', isAbsolute: true }
        ])

        const resultado = await actionInscriIndividual(anterior, formulario(CAT_ATUAL))

        expect(resultado.message?.[0]).toMatch(/gênero/i)
        expect(updateManyMock).not.toHaveBeenCalled()
    })

    it('recusa categoria de idade incompatível quando outra cobre o ano', async () => {
        // O jogador nasceu em 2012 e a categoria escolhida cobre 2014-2017.
        categoriaFindManyMock.mockResolvedValue([
            { uuid: CAT_ATUAL, name: 'Sub-10', min_y: 2014, max_y: 2017, default_division: DIV_MASC },
            { uuid: CAT_DE_OUTRO_TORNEIO, name: 'Sub-12', min_y: 2010, max_y: 2013, default_division: DIV_MASC }
        ])
        categoriaFindFirstMock.mockResolvedValue({
            uuid: CAT_ATUAL,
            name: 'Sub-10',
            id_torneio: TORNEIO,
            min_y: 2014,
            max_y: 2017,
            default_division: DIV_MASC,
            torneio: { title: 'Torneio', tempo_torneio_time_digitalTotempo: null }
        })

        const resultado = await actionInscriIndividual(anterior, formulario(CAT_ATUAL))

        expect(resultado.message?.[0]).toMatch(/não corresponde à idade/i)
        expect(updateManyMock).not.toHaveBeenCalled()
    })
})

describe('T16 na edição — dados oficiais não são apagados quando o serviço cai', () => {
    beforeEach(() => {
        linha = { ...inscricao(), rtg_fide: BigInt(1800), rtg_cbx: BigInt(1500) }
    })

    it('FIDE e CBX indisponíveis mantêm os ratings já gravados', async () => {
        verifyFideMock.mockResolvedValue({ status: 'unavailable' })
        verifyCbxMock.mockResolvedValue({ status: 'unavailable' })

        await actionInscriIndividual(anterior, formulario(CAT_ATUAL, '123', '456'))

        const dados = updateManyMock.mock.calls[0][0].data as Record<string, unknown>

        expect(dados.rtg_fide).toBe(1800)
        expect(dados.rtg_cbx).toBe(1500)
    })

    it('consulta bem-sucedida usa o rating oficial', async () => {
        verifyFideMock.mockResolvedValue({
            status: 'found',
            player: {
                name: 'Nome Oficial',
                bornYear: '2012',
                genre: 'm',
                title: 'MF',
                federation: 'BRA',
                idFide: '123',
                ratings: { standard: 2100, rapid: 2050, blitz: 2000 }
            }
        })

        await actionInscriIndividual(anterior, formulario(CAT_ATUAL, '123'))

        const dados = updateManyMock.mock.calls[0][0].data as Record<string, unknown>

        expect(dados.rtg_fide).toBe(2100)
        expect(dados.name).toBe('Nome Oficial')
    })

    it('jogador sem ID tem o rating limpo', async () => {
        await actionInscriIndividual(anterior, formulario(CAT_ATUAL, ''))

        const dados = updateManyMock.mock.calls[0][0].data as Record<string, unknown>

        expect(dados.rtg_fide).toBe(null)
        expect(verifyFideMock).not.toHaveBeenCalled()
    })
})
