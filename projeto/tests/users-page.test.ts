import { beforeEach, describe, expect, it, vi } from 'vitest'

const { authMock, findUserByEmailMock, findManyMock } = vi.hoisted(() => ({
    authMock: vi.fn(),
    findUserByEmailMock: vi.fn(),
    findManyMock: vi.fn()
}))

// `cache` do React precisa de um render em andamento; nos testes vira passagem
// direta. Mesmo tratamento usado em auth-guard.test.ts.
vi.mock('react', async (importOriginal) => {
    const actual = await importOriginal<typeof import('react')>()

    return {
        ...actual,
        cache: (fn: unknown) => fn
    }
})

vi.mock('@/auth', () => ({
    auth: authMock
}))

vi.mock('@/lib/user', () => ({
    findUserByEmail: findUserByEmailMock
}))

vi.mock('@/lib/db', () => ({
    default: { usuario: { findMany: findManyMock } }
}))

// A tabela é Client Component e arrasta CSS, o `Switch` e o `changeFunction`.
// O que interessa aqui é só o que a página entrega a ela.
vi.mock('@/app/gerenciamento/usuarios/usersTable', () => ({
    default: () => null
}))

import Users from '@/app/gerenciamento/usuarios/page'
import { UnauthorizedError } from '@/lib/auth-guard'

const admin = { id: 1, email: 'admin@exemplo.com', admin: true, socio: true }
const comum = { id: 7, email: 'jogador@exemplo.com', admin: false, socio: false }

/**
 * Reproduz o que o `select` do Prisma faz: devolve só as colunas pedidas.
 *
 * As linhas de origem trazem `password` de propósito, para que o teste falhe se
 * a página um dia voltar a pedir a linha inteira.
 */
function findManyRespeitandoSelect(args: { select?: Record<string, boolean> }) {
    const linhas = [
        { ...comum, password: '$argon2id$hash-do-jogador' },
        { ...admin, email: 'outro-admin@exemplo.com', password: '$argon2id$hash-do-admin' }
    ]

    const campos = Object.keys(args.select ?? {})
    return linhas.map((linha) =>
        Object.fromEntries(campos.map((campo) => [campo, linha[campo as keyof typeof linha]]))
    )
}

beforeEach(() => {
    authMock.mockReset()
    findUserByEmailMock.mockReset()
    findManyMock.mockReset()
    findManyMock.mockImplementation(findManyRespeitandoSelect)
})

describe('página de usuários — autorização', () => {
    it('sem sessão, recusa e não consulta o banco', async () => {
        authMock.mockResolvedValue(null)

        await expect(Users()).rejects.toBeInstanceOf(UnauthorizedError)
        await expect(Users()).rejects.toMatchObject({ reason: 'unauthenticated' })
        expect(findManyMock).not.toHaveBeenCalled()
    })

    it('usuário comum não acessa os dados', async () => {
        authMock.mockResolvedValue({ user: { email: comum.email } })
        findUserByEmailMock.mockResolvedValue(comum)

        await expect(Users()).rejects.toMatchObject({ reason: 'forbidden' })
        expect(findManyMock).not.toHaveBeenCalled()
    })

    it('administrador revogado no banco não acessa os dados, mesmo com o token dizendo que é admin', async () => {
        // É a situação real de um rebaixamento: o JWT continua válido por até 30
        // dias com `admin: true`, mas o banco já diz o contrário.
        authMock.mockResolvedValue({ user: { email: comum.email, admin: true } })
        findUserByEmailMock.mockResolvedValue({ ...comum, admin: false })

        await expect(Users()).rejects.toMatchObject({ reason: 'forbidden' })
        expect(findManyMock).not.toHaveBeenCalled()
    })
})

describe('página de usuários — consulta e payload', () => {
    beforeEach(() => {
        authMock.mockResolvedValue({ user: { email: admin.email } })
        findUserByEmailMock.mockResolvedValue(admin)
    })

    it('pede ao banco apenas email e admin, nunca a senha', async () => {
        await Users()

        const argumentos = findManyMock.mock.calls[0][0]

        expect(argumentos.select).toEqual({ email: true, admin: true })
        expect(argumentos.select).not.toHaveProperty('password')
    })

    it('entrega ao Client Component apenas linhas sem hash de senha', async () => {
        const elemento = await Users()
        const linhas = elemento.props.usuarios as Record<string, unknown>[]

        expect(linhas).toHaveLength(2)

        for (const linha of linhas) {
            expect(Object.keys(linha).sort()).toEqual(['admin', 'email'])
            expect(linha).not.toHaveProperty('password')
        }
    })

    it('exclui o próprio administrador pelo e-mail vindo do banco, não pelo da sessão', async () => {
        // Sessão com outra caixa: o e-mail do filtro tem de ser o da linha do banco.
        authMock.mockResolvedValue({ user: { email: 'ADMIN@EXEMPLO.COM' } })

        await Users()

        expect(findManyMock.mock.calls[0][0].where).toEqual({
            email: { not: admin.email }
        })
    })
})
