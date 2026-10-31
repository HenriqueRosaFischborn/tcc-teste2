import { beforeEach, describe, expect, it, vi } from 'vitest'

const {
    authMock,
    findUserByEmailMock,
    transactionMock,
    updateMock,
    updateForaDaTransacaoMock,
    findUniqueMock,
    findManyInscricaoMock,
    findManyCategoriaMock,
    findManyDivisaoMock,
    sendConfirmedMock,
    sendCancelledMock
} = vi.hoisted(() => ({
    authMock: vi.fn(),
    findUserByEmailMock: vi.fn(),
    transactionMock: vi.fn(),
    updateMock: vi.fn(),
    updateForaDaTransacaoMock: vi.fn(),
    findUniqueMock: vi.fn(),
    findManyInscricaoMock: vi.fn(),
    findManyCategoriaMock: vi.fn(),
    findManyDivisaoMock: vi.fn(),
    sendConfirmedMock: vi.fn(),
    sendCancelledMock: vi.fn()
}))

vi.mock('react', async (importOriginal) => {
    const actual = await importOriginal<typeof import('react')>()

    return {
        ...actual,
        cache: (fn: unknown) => fn
    }
})

vi.mock('@/auth', () => ({ auth: authMock }))
vi.mock('@/lib/user', () => ({ findUserByEmail: findUserByEmailMock }))

// `update` no client de fora (`db`) existe só para provar que a action NÃO
// escreve por ele: toda gravação tem de passar pelo client da transação.
vi.mock('@/lib/db', () => ({
    default: {
        incricao: {
            update: updateForaDaTransacaoMock,
            findUnique: findUniqueMock
        },
        $transaction: transactionMock
    }
}))

vi.mock('@/app/api/email/confirmed-inscription/send', () => ({
    sendConfirmedMessageEmail: sendConfirmedMock
}))

vi.mock('@/app/api/email/canceled-inscription/send', () => ({
    sendCancelledMessageEmail: sendCancelledMock
}))

import updateDataBase from '@/app/gerenciamento/torneios/[torneio]/analisar-jogadores/client/updateDataBase'
import { UnauthorizedError } from '@/lib/auth-guard'

const admin = { id: 1, email: 'admin@exemplo.com', admin: true, socio: true }
const comum = { id: 7, email: 'jogador@exemplo.com', admin: false, socio: false }

const UUID_1 = '11111111-1111-4111-8111-111111111111'
const UUID_2 = '22222222-2222-4222-8222-222222222222'
const UUID_CAT = '33333333-3333-4333-8333-333333333333'
const UUID_CAT_NOVA = '44444444-4444-4444-8444-444444444444'

/** Torneio ao qual as inscrições e as categorias/divisões padrão pertencem. */
const ID_TORNEIO = 9
/** Um torneio diferente, para os testes de vínculo. */
const OUTRO_TORNEIO = 99

const CATEGORIAS_DO_BANCO = [
    { uuid: UUID_CAT, id_torneio: BigInt(ID_TORNEIO) },
    { uuid: UUID_CAT_NOVA, id_torneio: BigInt(ID_TORNEIO) }
]

const DIVISOES_DO_BANCO = [
    { id: BigInt(3), id_torneio: BigInt(ID_TORNEIO) },
    { id: BigInt(4), id_torneio: BigInt(ID_TORNEIO) }
]

/**
 * Inscrição como o navegador a envia. O e-mail aqui é o do **payload** — o
 * teste do destinatário confere que ele é ignorado em favor do banco.
 */
function jogadorDoPayload(uuid = UUID_1) {
    return {
        uuid,
        name: 'Fulano de Tal',
        city: 'Araranguá',
        club: 'CXA',
        genre: true,
        data_nasc: '2010-05-04T00:00:00.000Z',
        id_fide: 111,
        id_cbx: 222,
        uuid_cat: UUID_CAT,
        id_usuario: 7,
        id_division: 3,
        id_torneio: 9,
        rtg_fide: 1800,
        rtg_cbx: 1750,
        status: 'Pendente',
        federation: 'BRA',
        titulo: null,
        categoria: { name: 'Sub-12', uuid: UUID_CAT, id_torneio: 9 },
        divisoes: { name: 'Absoluto', id: 3 },
        usuario: { id: 7, email: 'endereco-do-payload@exemplo.com' }
    }
}

/** Mesma inscrição como o banco a devolve, com BigInt e outro e-mail. */
function jogadorDoBanco(status = 'Confirmada') {
    return {
        uuid: UUID_1,
        name: 'Fulano de Tal',
        city: 'Araranguá',
        club: 'CXA',
        genre: true,
        data_nasc: new Date('2010-05-04T00:00:00.000Z'),
        // O tsconfig compila para ES2017, então literal `111n` não compila; o
        // Prisma devolve BigInt do mesmo jeito.
        id_fide: BigInt(111),
        id_cbx: BigInt(222),
        uuid_cat: UUID_CAT,
        id_usuario: 7,
        id_division: BigInt(3),
        id_torneio: BigInt(9),
        rtg_fide: BigInt(1800),
        rtg_cbx: BigInt(1750),
        status,
        federation: 'BRA',
        titulo: null,
        categoria: { name: 'Sub-12', uuid: UUID_CAT, id_torneio: BigInt(9) },
        divisoes: { name: 'Absoluto', id: BigInt(3) },
        usuario: { id: 7, email: 'endereco-do-banco@exemplo.com' },
        torneio: { title: 'Torneio Real do Banco' }
    }
}

function formulario(defaultInscri: object, nowInscri: object) {
    const formdata = new FormData()

    formdata.set('nameTournment', 'Nome Vindo do Cliente')
    formdata.set('defaultInscri', JSON.stringify(defaultInscri))
    formdata.set('nowInscri', JSON.stringify(nowInscri))

    return formdata
}

const anterior = { message: '' }

let ordem: string[]
/** Gravações que a transação "commitou". Vazio quando o callback lança. */
let commitadas: unknown[]

beforeEach(() => {
    authMock.mockReset()
    findUserByEmailMock.mockReset()
    transactionMock.mockReset()
    updateMock.mockReset()
    updateForaDaTransacaoMock.mockReset()
    findUniqueMock.mockReset()
    findManyInscricaoMock.mockReset()
    findManyCategoriaMock.mockReset()
    findManyDivisaoMock.mockReset()
    sendConfirmedMock.mockReset()
    sendCancelledMock.mockReset()

    authMock.mockResolvedValue({ user: { email: admin.email } })
    findUserByEmailMock.mockResolvedValue(admin)

    ordem = []
    commitadas = []

    /**
     * Transação de mentira com semântica tudo-ou-nada: as gravações ficam num
     * buffer e só viram "commitadas" se o callback terminar sem exceção. Isso
     * prova que a action deixa o erro subir em vez de engoli-lo no meio do
     * caminho — o rollback de verdade é do Postgres, não deste mock.
     */
    transactionMock.mockImplementation(async (callback: (tx: unknown) => Promise<unknown>) => {
        const pendentes: unknown[] = []

        const tx = {
            incricao: {
                update: async (args: unknown) => {
                    const resultado = await updateMock(args)
                    pendentes.push(args)
                    return resultado
                },
                findMany: findManyInscricaoMock
            },
            categoria: { findMany: findManyCategoriaMock },
            divisoes: { findMany: findManyDivisaoMock }
        }

        const resultado = await callback(tx)

        commitadas.push(...pendentes)

        return resultado
    })

    updateMock.mockImplementation(async () => {
        ordem.push('update')
        return {}
    })

    updateForaDaTransacaoMock.mockImplementation(async () => {
        ordem.push('update-fora-da-transacao')
        return {}
    })

    findManyInscricaoMock.mockImplementation(async ({ where }: { where: { uuid: { in: string[] } } }) =>
        where.uuid.in.map((uuid) => ({ uuid, id_torneio: BigInt(ID_TORNEIO) }))
    )

    findManyCategoriaMock.mockImplementation(async ({ where }: { where: { uuid: { in: string[] } } }) =>
        CATEGORIAS_DO_BANCO.filter((categoria) => where.uuid.in.includes(categoria.uuid))
    )

    findManyDivisaoMock.mockImplementation(async ({ where }: { where: { id: { in: bigint[] } } }) =>
        DIVISOES_DO_BANCO.filter((divisao) => where.id.in.some((id) => id === divisao.id))
    )

    findUniqueMock.mockImplementation(async () => {
        ordem.push('findUnique')
        return jogadorDoBanco()
    })

    sendConfirmedMock.mockImplementation(async () => {
        ordem.push('email')
        return { success: true }
    })

    sendCancelledMock.mockImplementation(async () => {
        ordem.push('email')
        return { success: true }
    })
})

/** Dados que o update recebeu na primeira gravação. */
function dadosGravados() {
    return updateMock.mock.calls[0]?.[0]?.data as Record<string, unknown>
}

describe('updateDataBase — autorização', () => {
    it('sem administrador, lança e não grava nem envia', async () => {
        findUserByEmailMock.mockResolvedValue(comum)

        const formdata = formulario(
            { [UUID_1]: jogadorDoPayload() },
            { [UUID_1]: { ...jogadorDoPayload(), status: 'Confirmada' } }
        )

        await expect(updateDataBase(anterior, formdata)).rejects.toBeInstanceOf(UnauthorizedError)
        expect(updateMock).not.toHaveBeenCalled()
        expect(sendConfirmedMock).not.toHaveBeenCalled()
    })

    it('sem sessão, lança e não grava', async () => {
        authMock.mockResolvedValue(null)

        const formdata = formulario(
            { [UUID_1]: jogadorDoPayload() },
            { [UUID_1]: { ...jogadorDoPayload(), status: 'Confirmada' } }
        )

        await expect(updateDataBase(anterior, formdata)).rejects.toMatchObject({ reason: 'unauthenticated' })
        expect(updateMock).not.toHaveBeenCalled()
    })
})

describe('updateDataBase — gravação aguardada', () => {
    it('falha na gravação vira "Erro" e não dispara e-mail', async () => {
        updateMock.mockRejectedValue(new Error('banco fora'))

        const formdata = formulario(
            { [UUID_1]: jogadorDoPayload() },
            { [UUID_1]: { ...jogadorDoPayload(), status: 'Confirmada' } }
        )

        const resultado = await updateDataBase(anterior, formdata)

        expect(resultado).toEqual({ message: 'Erro' })
        expect(sendConfirmedMock).not.toHaveBeenCalled()
        expect(sendCancelledMock).not.toHaveBeenCalled()
    })

    it('grava todas as inscrições antes de responder', async () => {
        findUniqueMock.mockResolvedValue({ ...jogadorDoBanco(), uuid: UUID_2 })

        const formdata = formulario(
            { [UUID_1]: jogadorDoPayload(), [UUID_2]: jogadorDoPayload(UUID_2) },
            {
                [UUID_1]: { ...jogadorDoPayload(), status: 'Confirmada' },
                [UUID_2]: { ...jogadorDoPayload(UUID_2), status: 'Confirmada' }
            }
        )

        const resultado = await updateDataBase(anterior, formdata)

        expect(resultado).toEqual({ message: 'Alterações salvas' })
        expect(updateMock).toHaveBeenCalledTimes(2)
    })
})

describe('updateDataBase — e-mail depois do commit e com dados do banco', () => {
    const formdata = () => formulario(
        { [UUID_1]: jogadorDoPayload() },
        { [UUID_1]: { ...jogadorDoPayload(), status: 'Confirmada' } }
    )

    it('só envia depois de gravar e reler a inscrição', async () => {
        await updateDataBase(anterior, formdata())

        expect(ordem).toEqual(['update', 'findUnique', 'email'])
    })

    it('usa o e-mail do banco, não o do payload', async () => {
        await updateDataBase(anterior, formdata())

        const [inscricao] = sendConfirmedMock.mock.calls[0]

        expect(inscricao.usuario.email).toBe('endereco-do-banco@exemplo.com')
        expect(inscricao.usuario.email).not.toBe('endereco-do-payload@exemplo.com')
    })

    it('usa o título do torneio do banco, não o do payload', async () => {
        await updateDataBase(anterior, formdata())

        const [, torneio] = sendConfirmedMock.mock.calls[0]

        expect(torneio).toBe('Torneio Real do Banco')
        expect(torneio).not.toBe('Nome Vindo do Cliente')
    })

    it('converte BigInt do banco para number antes de montar o e-mail', async () => {
        await updateDataBase(anterior, formdata())

        const [inscricao] = sendConfirmedMock.mock.calls[0]

        expect(inscricao.id_fide).toBe(111)
        expect(typeof inscricao.id_fide).toBe('number')
        expect(inscricao.categoria.id_torneio).toBe(9)
        expect(typeof inscricao.categoria.id_torneio).toBe('number')
    })

    it('status Recusada usa o e-mail de cancelamento', async () => {
        findUniqueMock.mockResolvedValue(jogadorDoBanco('Recusada'))

        await updateDataBase(anterior, formulario(
            { [UUID_1]: jogadorDoPayload() },
            { [UUID_1]: { ...jogadorDoPayload(), status: 'Recusada' } }
        ))

        expect(sendCancelledMock).toHaveBeenCalledTimes(1)
        expect(sendConfirmedMock).not.toHaveBeenCalled()
    })
})

describe('updateDataBase — quando o e-mail NÃO deve sair', () => {
    it('alterar um campo que não é o status não envia nada', async () => {
        const formdata = formulario(
            { [UUID_1]: jogadorDoPayload() },
            { [UUID_1]: { ...jogadorDoPayload(), name: 'Fulano Editado' } }
        )

        const resultado = await updateDataBase(anterior, formdata)

        expect(resultado).toEqual({ message: 'Alterações salvas' })
        expect(ordem).toEqual(['update'])
        expect(sendConfirmedMock).not.toHaveBeenCalled()
        expect(sendCancelledMock).not.toHaveBeenCalled()
    })

    it('status que não seja Confirmada nem Recusada não envia nada', async () => {
        const confirmado = { ...jogadorDoPayload(), status: 'Confirmada' }

        const formdata = formulario(
            { [UUID_1]: confirmado },
            { [UUID_1]: { ...confirmado, status: 'Pendente' } }
        )

        await updateDataBase(anterior, formdata)

        expect(updateMock).toHaveBeenCalledTimes(1)
        expect(sendConfirmedMock).not.toHaveBeenCalled()
        expect(sendCancelledMock).not.toHaveBeenCalled()
    })

    it('inscrição apagada entre a gravação e a leitura não quebra o fluxo', async () => {
        findUniqueMock.mockResolvedValue(null)

        const formdata = formulario(
            { [UUID_1]: jogadorDoPayload() },
            { [UUID_1]: { ...jogadorDoPayload(), status: 'Confirmada' } }
        )

        const resultado = await updateDataBase(anterior, formdata)

        expect(resultado).toEqual({ message: 'Alterações salvas' })
        expect(sendConfirmedMock).not.toHaveBeenCalled()
    })
})

/* ================================================================== *
 * T49 — lista de campos permitidos
 * ================================================================== */

describe('T49 — alterações legítimas continuam funcionando', () => {
    it('grava todos os campos que a tela edita', async () => {
        const antes = jogadorDoPayload()

        const depois = {
            ...antes,
            status: 'Confirmada',
            name: 'Nome Novo',
            city: 'Criciúma',
            club: 'Clube Novo',
            federation: 'SC',
            titulo: 'MF',
            id_fide: 999,
            id_cbx: 888,
            rtg_fide: 2200,
            rtg_cbx: 2100,
            data_nasc: '2011-03-02T00:00:00.000Z',
            genre: false,
            id_division: 4,
            uuid_cat: UUID_CAT_NOVA
        }

        await updateDataBase(anterior, formulario({ [UUID_1]: antes }, { [UUID_1]: depois }))

        expect(dadosGravados()).toEqual({
            status: 'Confirmada',
            name: 'Nome Novo',
            city: 'Criciúma',
            club: 'Clube Novo',
            federation: 'SC',
            titulo: 'MF',
            id_fide: 999,
            id_cbx: 888,
            rtg_fide: 2200,
            rtg_cbx: 2100,
            data_nasc: new Date('2011-03-02T00:00:00.000Z'),
            genre: false,
            id_division: 4,
            uuid_cat: UUID_CAT_NOVA
        })
    })

    it('campo nulo é aceito onde a coluna permite', async () => {
        const antes = { ...jogadorDoPayload(), club: 'CXA', titulo: 'MF', id_fide: 111 }

        const depois = { ...antes, club: null, titulo: null, id_fide: null }

        await updateDataBase(anterior, formulario({ [UUID_1]: antes }, { [UUID_1]: depois }))

        expect(dadosGravados()).toEqual({ club: null, titulo: null, id_fide: null })
    })

    it('payload sem nenhuma alteração não gera UPDATE', async () => {
        const jogador = jogadorDoPayload()

        const resultado = await updateDataBase(
            anterior,
            formulario({ [UUID_1]: jogador }, { [UUID_1]: jogador })
        )

        expect(resultado).toEqual({ message: 'Alterações salvas' })
        expect(updateMock).not.toHaveBeenCalled()
    })
})

describe('T49 — identificadores e relacionamentos proibidos', () => {
    it('não grava id_usuario nem quando o payload manda outro dono', async () => {
        const antes = jogadorDoPayload()
        const depois = { ...antes, id_usuario: 999 }

        const resultado = await updateDataBase(anterior, formulario({ [UUID_1]: antes }, { [UUID_1]: depois }))

        expect(resultado).toEqual({ message: 'Alterações salvas' })
        expect(updateMock).not.toHaveBeenCalled()
    })

    it('troca de dono junto com mudança legítima grava só a mudança legítima', async () => {
        const antes = jogadorDoPayload()
        const depois = { ...antes, id_usuario: 999, status: 'Confirmada' }

        await updateDataBase(anterior, formulario({ [UUID_1]: antes }, { [UUID_1]: depois }))

        expect(dadosGravados()).toEqual({ status: 'Confirmada' })
        expect(dadosGravados()).not.toHaveProperty('id_usuario')
    })

    it('não grava id_torneio nem uuid', async () => {
        const antes = jogadorDoPayload()
        const depois = { ...antes, id_torneio: 42, uuid: UUID_2, name: 'Nome Novo' }

        await updateDataBase(anterior, formulario({ [UUID_1]: antes }, { [UUID_1]: depois }))

        expect(dadosGravados()).toEqual({ name: 'Nome Novo' })
        expect(dadosGravados()).not.toHaveProperty('id_torneio')
        expect(dadosGravados()).not.toHaveProperty('uuid')
    })

    it('campos internos desconhecidos do payload são ignorados', async () => {
        const antes = jogadorDoPayload()
        const depois = { ...antes, admin: true, password: 'x', pontuacao: 10 }

        await updateDataBase(anterior, formulario({ [UUID_1]: antes }, { [UUID_1]: depois }))

        expect(updateMock).not.toHaveBeenCalled()
    })

    it('uuid de inscrição fora do formato é recusado', async () => {
        const antes = jogadorDoPayload()

        const resultado = await updateDataBase(
            anterior,
            formulario({ 'uuid-1': antes }, { 'uuid-1': { ...antes, status: 'Confirmada' } })
        )

        expect(resultado).toEqual({ message: 'Erro' })
        expect(updateMock).not.toHaveBeenCalled()
    })
})

describe('T49 — valores inválidos são recusados e nada é gravado', () => {
    it.each([
        ['status fora do enum', { status: 'Aprovada' }],
        ['genre não booleano', { genre: 'true' }],
        ['id_fide negativo', { id_fide: -1 }],
        ['id_fide fracionário', { id_fide: 12.5 }],
        ['id_fide em texto', { id_fide: 'ABC' }],
        ['rtg_fide acima do teto', { rtg_fide: 1e15 }],
        ['name numérico', { name: 123 }],
        ['name vazio', { name: '   ' }],
        ['name longo demais', { name: 'x'.repeat(121) }],
        ['data_nasc inválida', { data_nasc: 'não é data' }],
        ['data_nasc no futuro', { data_nasc: '2999-01-01T00:00:00.000Z' }],
        ['uuid_cat fora do formato UUID', { uuid_cat: 'cat-1' }],
        ['id_division em texto', { id_division: '3' }]
    ])('%s', async (_caso, alteracao) => {
        const antes = jogadorDoPayload()
        const depois = { ...antes, ...alteracao }

        const resultado = await updateDataBase(anterior, formulario({ [UUID_1]: antes }, { [UUID_1]: depois }))

        expect(resultado).toEqual({ message: 'Erro' })
        expect(updateMock).not.toHaveBeenCalled()
        expect(sendConfirmedMock).not.toHaveBeenCalled()
        expect(sendCancelledMock).not.toHaveBeenCalled()
    })

    it('uma inscrição inválida impede a gravação das outras', async () => {
        const primeira = { ...jogadorDoPayload(), status: 'Confirmada' }
        const segunda = { ...jogadorDoPayload(UUID_2), genre: 'sim' }

        const resultado = await updateDataBase(
            anterior,
            formulario(
                { [UUID_1]: jogadorDoPayload(), [UUID_2]: jogadorDoPayload(UUID_2) },
                { [UUID_1]: primeira, [UUID_2]: segunda }
            )
        )

        expect(resultado).toEqual({ message: 'Erro' })
        expect(updateMock).not.toHaveBeenCalled()
    })

    it('payload que não é JSON válido devolve "Erro"', async () => {
        const formdata = new FormData()
        formdata.set('defaultInscri', '{{{')
        formdata.set('nowInscri', '}}}')

        await expect(updateDataBase(anterior, formdata)).resolves.toEqual({ message: 'Erro' })
        expect(updateMock).not.toHaveBeenCalled()
    })
})

/* ================================================================== *
 * T50 — transação e vínculo com o torneio
 * ================================================================== */

/** Payload com uma inscrição mudando só o status. */
function confirmacao() {
    return formulario(
        { [UUID_1]: jogadorDoPayload() },
        { [UUID_1]: { ...jogadorDoPayload(), status: 'Confirmada' } }
    )
}

describe('T50 — gravação transacional', () => {
    it('grava pelo client da transação, nunca pelo client de fora', async () => {
        const resultado = await updateDataBase(anterior, confirmacao())

        expect(resultado).toEqual({ message: 'Alterações salvas' })
        expect(transactionMock).toHaveBeenCalledTimes(1)
        expect(updateMock).toHaveBeenCalledTimes(1)
        expect(updateForaDaTransacaoMock).not.toHaveBeenCalled()
        expect(commitadas).toHaveLength(1)
    })

    it('falha no meio não commita nenhuma das gravações', async () => {
        updateMock
            .mockImplementationOnce(async () => ({}))
            .mockImplementationOnce(async () => {
                throw new Error('banco fora no meio da transação')
            })

        const resultado = await updateDataBase(
            anterior,
            formulario(
                { [UUID_1]: jogadorDoPayload(), [UUID_2]: jogadorDoPayload(UUID_2) },
                {
                    [UUID_1]: { ...jogadorDoPayload(), status: 'Confirmada' },
                    [UUID_2]: { ...jogadorDoPayload(UUID_2), status: 'Confirmada' }
                }
            )
        )

        expect(resultado).toEqual({ message: 'Erro' })
        // As duas tentativas aconteceram, mas o callback lançou: nada commitou.
        expect(updateMock).toHaveBeenCalledTimes(2)
        expect(commitadas).toEqual([])
        expect(sendConfirmedMock).not.toHaveBeenCalled()
        expect(sendCancelledMock).not.toHaveBeenCalled()
    })

    it('payload sem alterações nem abre transação', async () => {
        const jogador = jogadorDoPayload()

        const resultado = await updateDataBase(
            anterior,
            formulario({ [UUID_1]: jogador }, { [UUID_1]: jogador })
        )

        expect(resultado).toEqual({ message: 'Alterações salvas' })
        expect(transactionMock).not.toHaveBeenCalled()
    })

    it('e-mail só sai depois da transação terminar', async () => {
        await updateDataBase(anterior, confirmacao())

        // ordem: as leituras de vínculo (nenhuma aqui), a gravação, a releitura
        // pós-commit e só então o envio.
        expect(ordem).toEqual(['update', 'findUnique', 'email'])
        expect(commitadas).toHaveLength(1)
    })
})

describe('T50 — categoria e divisão precisam ser do torneio da inscrição', () => {
    const trocandoDivisao = (id: number) => formulario(
        { [UUID_1]: jogadorDoPayload() },
        { [UUID_1]: { ...jogadorDoPayload(), id_division: id } }
    )

    const trocandoCategoria = (uuid: string) => formulario(
        { [UUID_1]: jogadorDoPayload() },
        { [UUID_1]: { ...jogadorDoPayload(), uuid_cat: uuid } }
    )

    it('aceita categoria e divisão do mesmo torneio', async () => {
        const resultado = await updateDataBase(
            anterior,
            formulario(
                { [UUID_1]: jogadorDoPayload() },
                { [UUID_1]: { ...jogadorDoPayload(), uuid_cat: UUID_CAT_NOVA, id_division: 4 } }
            )
        )

        expect(resultado).toEqual({ message: 'Alterações salvas' })
        expect(findManyCategoriaMock).toHaveBeenCalledTimes(1)
        expect(findManyDivisaoMock).toHaveBeenCalledTimes(1)
        expect(commitadas).toHaveLength(1)
    })

    it('recusa categoria de outro torneio', async () => {
        findManyCategoriaMock.mockResolvedValue([{ uuid: UUID_CAT_NOVA, id_torneio: BigInt(OUTRO_TORNEIO) }])

        const resultado = await updateDataBase(anterior, trocandoCategoria(UUID_CAT_NOVA))

        expect(resultado).toEqual({ message: 'Erro' })
        expect(updateMock).not.toHaveBeenCalled()
        expect(commitadas).toEqual([])
    })

    it('recusa categoria que não existe', async () => {
        findManyCategoriaMock.mockResolvedValue([])

        const resultado = await updateDataBase(anterior, trocandoCategoria(UUID_CAT_NOVA))

        expect(resultado).toEqual({ message: 'Erro' })
        expect(commitadas).toEqual([])
    })

    it('recusa divisão de outro torneio', async () => {
        findManyDivisaoMock.mockResolvedValue([{ id: BigInt(4), id_torneio: BigInt(OUTRO_TORNEIO) }])

        const resultado = await updateDataBase(anterior, trocandoDivisao(4))

        expect(resultado).toEqual({ message: 'Erro' })
        expect(updateMock).not.toHaveBeenCalled()
        expect(commitadas).toEqual([])
    })

    it('recusa divisão que não existe', async () => {
        findManyDivisaoMock.mockResolvedValue([])

        const resultado = await updateDataBase(anterior, trocandoDivisao(4))

        expect(resultado).toEqual({ message: 'Erro' })
        expect(commitadas).toEqual([])
    })

    it('recusa quando a inscrição não existe mais', async () => {
        findManyInscricaoMock.mockResolvedValue([])

        const resultado = await updateDataBase(anterior, trocandoDivisao(4))

        expect(resultado).toEqual({ message: 'Erro' })
        expect(commitadas).toEqual([])
    })

    it('não consulta vínculo quando nem categoria nem divisão mudaram', async () => {
        const resultado = await updateDataBase(
            anterior,
            formulario(
                { [UUID_1]: jogadorDoPayload() },
                { [UUID_1]: { ...jogadorDoPayload(), name: 'Nome Novo' } }
            )
        )

        expect(resultado).toEqual({ message: 'Alterações salvas' })
        expect(findManyInscricaoMock).not.toHaveBeenCalled()
        expect(findManyCategoriaMock).not.toHaveBeenCalled()
        expect(findManyDivisaoMock).not.toHaveBeenCalled()
    })

    it('limpar a divisão não exige consulta de vínculo', async () => {
        const antes = jogadorDoPayload()

        const resultado = await updateDataBase(
            anterior,
            formulario({ [UUID_1]: antes }, { [UUID_1]: { ...antes, id_division: null } })
        )

        expect(resultado).toEqual({ message: 'Alterações salvas' })
        expect(dadosGravados()).toEqual({ id_division: null })
        expect(findManyDivisaoMock).not.toHaveBeenCalled()
        expect(findManyInscricaoMock).not.toHaveBeenCalled()
    })
})
