import { beforeEach, describe, expect, it, vi } from 'vitest'

import {
    converterValor,
    valorDoGenero
} from '@/app/gerenciamento/torneios/[torneio]/analisar-jogadores/client/converter-valor'

const {
    authMock,
    findUserByEmailMock,
    updateMock,
    findUniqueMock,
    transactionMock
} = vi.hoisted(() => ({
    authMock: vi.fn(),
    findUserByEmailMock: vi.fn(),
    updateMock: vi.fn(),
    findUniqueMock: vi.fn(),
    transactionMock: vi.fn()
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

vi.mock('@/lib/db', () => ({
    default: {
        incricao: { update: vi.fn(), findUnique: findUniqueMock },
        $transaction: transactionMock
    }
}))

vi.mock('@/app/api/email/confirmed-inscription/send', () => ({
    sendConfirmedMessageEmail: vi.fn()
}))

vi.mock('@/app/api/email/canceled-inscription/send', () => ({
    sendCancelledMessageEmail: vi.fn()
}))

import updateDataBase from '@/app/gerenciamento/torneios/[torneio]/analisar-jogadores/client/updateDataBase'

const UUID_1 = '11111111-1111-4111-8111-111111111111'
const UUID_CAT = '33333333-3333-4333-8333-333333333333'

const admin = { id: 1, email: 'admin@exemplo.com', admin: true, socio: true }

describe('T19 — carregar: banco → valor do <select>', () => {
    it('masculino no banco aparece como "true"', () => {
        expect(valorDoGenero(true)).toBe('true')
    })

    it('feminino no banco aparece como "false"', () => {
        expect(valorDoGenero(false)).toBe('false')
    })
})

describe('T19 — alterar: valor do <select> → estado', () => {
    it('selecionar "Masculino" vira true', () => {
        expect(converterValor('boolean', 'true')).toBe(true)
    })

    it('selecionar "Feminino" vira false (era o bug)', () => {
        expect(converterValor('boolean', 'false')).toBe(false)
    })

    it('trocar Masculino → Feminino → Masculino acompanha o select', () => {
        let genero = converterValor('boolean', valorDoGenero(true))
        expect(genero).toBe(true)

        genero = converterValor('boolean', valorDoGenero(false))
        expect(genero).toBe(false)

        genero = converterValor('boolean', valorDoGenero(true))
        expect(genero).toBe(true)
    })
})

describe('T19 — as outras conversões continuam iguais', () => {
    it('texto passa direto', () => {
        expect(converterValor('string', 'Fulano')).toBe('Fulano')
    })

    it('números são convertidos', () => {
        expect(converterValor('number', '1800')).toBe(1800)
        expect(converterValor('division', '3')).toBe(3)
    })

    it('data é montada fora, aqui fica vazio', () => {
        expect(converterValor('date', '01/01/2010')).toBe('')
    })
})

/* ------------------------------------------------------------------ *
 * Fim a fim: o valor convertido chega ao banco como booleano correto
 * ------------------------------------------------------------------ */

function jogador(genre: boolean) {
    return {
        uuid: UUID_1,
        name: 'Fulano de Tal',
        city: 'Araranguá',
        club: 'CXA',
        genre,
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
        usuario: { id: 7, email: 'jogador@exemplo.com' }
    }
}

function formulario(generoNoBanco: boolean, valorSelecionado: string) {
    const formdata = new FormData()

    // A tela parte do que veio do banco e o admin troca no <select>.
    const antes = jogador(generoNoBanco)
    const depois = { ...antes, genre: converterValor('boolean', valorSelecionado) as boolean }

    formdata.set('defaultInscri', JSON.stringify({ [UUID_1]: antes }))
    formdata.set('nowInscri', JSON.stringify({ [UUID_1]: depois }))

    return formdata
}

beforeEach(() => {
    authMock.mockReset().mockResolvedValue({ user: { email: admin.email } })
    findUserByEmailMock.mockReset().mockResolvedValue(admin)
    updateMock.mockReset().mockResolvedValue({})
    findUniqueMock.mockReset().mockResolvedValue(null)

    transactionMock.mockReset().mockImplementation(async (callback: (tx: unknown) => Promise<unknown>) =>
        callback({
            incricao: { update: updateMock, findMany: vi.fn().mockResolvedValue([
                { uuid: UUID_1, id_torneio: BigInt(9) }
            ]) },
            categoria: { findMany: vi.fn().mockResolvedValue([]) },
            divisoes: { findMany: vi.fn().mockResolvedValue([]) }
        })
    )
})

describe('T19 — salvar: o gênero chega ao banco correto', () => {
    it('trocar para Feminino grava false', async () => {
        await updateDataBase({ message: '' }, formulario(true, 'false'))

        expect(updateMock.mock.calls[0][0].data).toMatchObject({ genre: false })
    })

    it('trocar para Masculino grava true', async () => {
        await updateDataBase({ message: '' }, formulario(false, 'true'))

        expect(updateMock.mock.calls[0][0].data).toMatchObject({ genre: true })
    })

    it('não mexer no select não grava gênero nenhum', async () => {
        const formdata = formulario(false, 'false')

        await updateDataBase({ message: '' }, formdata)

        expect(updateMock).not.toHaveBeenCalled()
    })
})
