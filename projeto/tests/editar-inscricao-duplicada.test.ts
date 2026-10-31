import { beforeEach, describe, expect, it, vi } from 'vitest'

const {
    requireUserMock,
    findFirstMock,
    updateManyMock,
    categoriaFindFirstMock,
    categoriaFindManyMock,
    divisoesFindManyMock,
    sendEmailMock
} = vi.hoisted(() => ({
    requireUserMock: vi.fn(),
    findFirstMock: vi.fn(),
    updateManyMock: vi.fn(),
    categoriaFindFirstMock: vi.fn(),
    categoriaFindManyMock: vi.fn(),
    divisoesFindManyMock: vi.fn(),
    sendEmailMock: vi.fn()
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
        incricao: {
            findFirst: findFirstMock,
            updateMany: updateManyMock
        },
        categoria: { findFirst: categoriaFindFirstMock, findMany: categoriaFindManyMock },
        divisoes: { findMany: divisoesFindManyMock }
    }
}))

vi.mock('@/lib/supabase', () => ({
    getSupabaseAdmin: vi.fn()
}))

vi.mock('@/app/api/email/update-infos/send', () => ({
    sendUpdateInscriptionEmail: sendEmailMock
}))

import actionInscriIndividual from '@/app/minhas-inscricoes/[inscricao]/editar-informacoes/form/action'

const USUARIO = 7
const OUTRO_USUARIO = 99

const UUID_ATUAL = '11111111-1111-4111-8111-111111111111'
const UUID_DO_OUTRO = '22222222-2222-4222-8222-222222222222'
const UUID_TERCEIRO = '33333333-3333-4333-8333-333333333333'
const UUID_CAT = '44444444-4444-4444-8444-444444444444'

const FIDE = 12345
const TORNEIO = BigInt(9)
const DIVISAO = BigInt(3)

/** Registro completo como o Prisma devolve com `include`. */
function inscricao(uuid: string, idUsuario: number, idTorneio = TORNEIO, idFide: number | null = FIDE) {
    return {
        uuid,
        name: 'Fulano de Tal',
        city: 'Araranguá',
        club: 'CXA',
        genre: true,
        data_nasc: new Date('2010-05-04T00:00:00.000Z'),
        id_fide: idFide,
        id_cbx: null,
        uuid_cat: UUID_CAT,
        status: 'Pendente',
        id_usuario: idUsuario,
        id_division: DIVISAO,
        id_torneio: idTorneio,
        rtg_fide: null,
        rtg_cbx: null,
        federation: 'BRA',
        titulo: null,
        categoria: { name: 'Absoluto', uuid: UUID_CAT, id_torneio: idTorneio, min_y: 1900 },
        divisoes: { name: 'Absoluto', id: DIVISAO },
        usuario: { id: idUsuario, email: 'jogador@exemplo.com' }
    }
}

/** Tabela falsa de `incricao`, filtrada com as mesmas condições do `where`. */
let tabela: ReturnType<typeof inscricao>[]

function combina(linha: ReturnType<typeof inscricao>, where: Record<string, unknown>) {
    if (where.id_usuario !== undefined && linha.id_usuario !== where.id_usuario) return false
    if (where.id_fide !== undefined && linha.id_fide !== where.id_fide) return false
    if (where.id_torneio !== undefined && linha.id_torneio !== where.id_torneio) return false

    // A checagem de duplicidade consulta por identidade do jogador:
    // `OR: [{ id_fide }, { id_cbx }]`.
    if (where.OR !== undefined) {
        const condicoes = where.OR as Record<string, unknown>[]

        const alguma = condicoes.some((condicao) =>
            Object.entries(condicao).every(
                ([campo, valor]) => (linha as Record<string, unknown>)[campo] === valor
            )
        )

        if (!alguma) return false
    }

    if (where.uuid !== undefined) {
        const uuid = where.uuid as string | { not?: string }

        if (typeof uuid === 'string') {
            if (linha.uuid !== uuid) return false
        } else if (uuid.not !== undefined) {
            if (linha.uuid === uuid.not) return false
        }
    }

    return true
}

function formulario(uuid: string) {
    const formdata = new FormData()

    formdata.set('uuid', uuid)
    formdata.set('name', 'Fulano de Tal')
    formdata.set('city', 'Araranguá')
    formdata.set('team', 'CXA')
    formdata.set('borndate', '04/05/2010')
    formdata.set('genre', 'masc')
    formdata.set('uuidCat', UUID_CAT)
    formdata.set('idfide', String(FIDE))
    formdata.set('idcbx', '')
    formdata.set('hasFide', 'true')
    formdata.set('division', 'Absoluto')
    formdata.set('fileComprovante', new File([], ''))

    return formdata
}

const anterior = {}

/** A consulta da checagem de duplicidade, se tiver acontecido. */
function consultaDeDuplicidade() {
    return findFirstMock.mock.calls
        .map((chamada) => chamada[0].where as Record<string, unknown>)
        .find((where) => where.OR !== undefined)
}

beforeEach(() => {
    requireUserMock.mockReset().mockResolvedValue({
        id: USUARIO,
        email: 'jogador@exemplo.com',
        admin: false,
        socio: false
    })

    findFirstMock.mockReset().mockImplementation(
        async ({ where }: { where: Record<string, unknown> }) =>
            tabela.find((linha) => combina(linha, where)) ?? null
    )

    updateManyMock.mockReset().mockResolvedValue({ count: 1 })

    categoriaFindFirstMock.mockReset().mockResolvedValue({
        uuid: UUID_CAT,
        id_torneio: TORNEIO,
        default_division: DIVISAO,
        torneio: { title: 'Torneio de Teste', tempo_torneio_time_digitalTotempo: null }
    })

    categoriaFindManyMock.mockReset().mockResolvedValue([
        { uuid: UUID_CAT, name: 'Absoluto', min_y: 1900, max_y: 2100, default_division: DIVISAO }
    ])

    divisoesFindManyMock.mockReset().mockResolvedValue([
        { id: DIVISAO, name: 'Absoluto', isAbsolute: true, genre: 'ambos' }
    ])

    sendEmailMock.mockReset().mockResolvedValue({ ok: true })

    tabela = [inscricao(UUID_ATUAL, USUARIO)]
})

describe('T26 — o jogador edita a própria inscrição', () => {
    it('não confunde a própria inscrição com duplicata e salva', async () => {
        const resultado = await actionInscriIndividual(anterior, formulario(UUID_ATUAL))

        expect(resultado.message?.[0]).toBe('Sucesso')
        expect(resultado.message?.[0]).not.toBe('Você já está inscrito')
        expect(updateManyMock).toHaveBeenCalledTimes(1)
        expect(sendEmailMock).toHaveBeenCalledTimes(1)
    })

    it('a consulta de duplicidade exclui a inscrição em edição', async () => {
        await actionInscriIndividual(anterior, formulario(UUID_ATUAL))

        expect(consultaDeDuplicidade()).toEqual({
            id_torneio: TORNEIO,
            OR: [{ id_fide: FIDE }],
            uuid: { not: UUID_ATUAL }
        })
    })

    it('a gravação continua exigindo posse (T05)', async () => {
        await actionInscriIndividual(anterior, formulario(UUID_ATUAL))

        expect(updateManyMock).toHaveBeenCalledWith(
            expect.objectContaining({ where: { uuid: UUID_ATUAL, id_usuario: USUARIO } })
        )
    })
})

describe('T26 — proteção contra duplicata de verdade é preservada', () => {
    it('bloqueia quando OUTRA inscrição do mesmo torneio tem o mesmo FIDE', async () => {
        // Terceiro inscrito, com o mesmo ID FIDE, no mesmo torneio.
        tabela.push(inscricao(UUID_TERCEIRO, OUTRO_USUARIO))

        const resultado = await actionInscriIndividual(anterior, formulario(UUID_ATUAL))

        expect(resultado.message?.[0]).toBe('Você já está inscrito')
        expect(updateManyMock).not.toHaveBeenCalled()
        expect(sendEmailMock).not.toHaveBeenCalled()
    })

    it('não bloqueia por inscrição de OUTRO torneio com o mesmo FIDE', async () => {
        tabela.push(inscricao(UUID_TERCEIRO, OUTRO_USUARIO, BigInt(77)))

        const resultado = await actionInscriIndividual(anterior, formulario(UUID_ATUAL))

        expect(resultado.message?.[0]).toBe('Sucesso')
    })
})

describe('T26 — posse preservada (T05)', () => {
    it('inscrição de outra pessoa não é lida nem gravada', async () => {
        tabela.push(inscricao(UUID_DO_OUTRO, OUTRO_USUARIO))

        await expect(
            actionInscriIndividual(anterior, formulario(UUID_DO_OUTRO))
        ).rejects.toThrow(/Inscrição não encontrada/)

        expect(updateManyMock).not.toHaveBeenCalled()
        expect(sendEmailMock).not.toHaveBeenCalled()
    })

    it('sem sessão, não lê nem grava', async () => {
        const { UnauthorizedError } = await import('@/lib/auth-guard')

        requireUserMock.mockRejectedValue(new UnauthorizedError('unauthenticated'))

        const resultado = await actionInscriIndividual(anterior, formulario(UUID_ATUAL))

        expect(resultado.message?.[0]).toMatch(/Sessão expirada/)
        expect(updateManyMock).not.toHaveBeenCalled()
    })
})
