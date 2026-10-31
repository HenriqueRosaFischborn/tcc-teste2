import { beforeEach, describe, expect, it, vi } from 'vitest'

const { authMock, findUserByEmailMock } = vi.hoisted(() => ({
    authMock: vi.fn(),
    findUserByEmailMock: vi.fn()
}))

// `cache` do React precisa de um render em andamento; nos testes ele vira
// passagem direta para a função original.
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

import { requireAdmin, requireUser, UnauthorizedError } from '@/lib/auth-guard'

const usuarioComum = { id: 7, email: 'jogador@exemplo.com', admin: false, socio: false }
const usuarioAdmin = { id: 1, email: 'admin@exemplo.com', admin: true, socio: true }

beforeEach(() => {
    authMock.mockReset()
    findUserByEmailMock.mockReset()
})

describe('requireUser', () => {
    it('lança quando não há sessão', async () => {
        authMock.mockResolvedValue(null)

        await expect(requireUser()).rejects.toBeInstanceOf(UnauthorizedError)
        await expect(requireUser()).rejects.toMatchObject({ reason: 'unauthenticated' })
    })

    it('lança quando a sessão existe mas o usuário não está no banco', async () => {
        authMock.mockResolvedValue({ user: { email: 'fantasma@exemplo.com' } })
        findUserByEmailMock.mockResolvedValue(null)

        await expect(requireUser()).rejects.toMatchObject({ reason: 'unauthenticated' })
    })

    it('devolve o usuário autenticado', async () => {
        authMock.mockResolvedValue({ user: { email: usuarioComum.email } })
        findUserByEmailMock.mockResolvedValue(usuarioComum)

        await expect(requireUser()).resolves.toMatchObject({
            id: usuarioComum.id,
            email: usuarioComum.email,
            admin: false
        })
    })
})

describe('requireAdmin', () => {
    it('recusa usuário comum com reason "forbidden"', async () => {
        authMock.mockResolvedValue({ user: { email: usuarioComum.email } })
        findUserByEmailMock.mockResolvedValue(usuarioComum)

        await expect(requireAdmin()).rejects.toMatchObject({ reason: 'forbidden' })
    })

    it('aceita administrador', async () => {
        authMock.mockResolvedValue({ user: { email: usuarioAdmin.email } })
        findUserByEmailMock.mockResolvedValue(usuarioAdmin)

        await expect(requireAdmin()).resolves.toMatchObject({ id: 1, admin: true })
    })

    it('lê o admin do banco, não do token da sessão', async () => {
        // Token diz que é admin; o banco diz que não é mais.
        authMock.mockResolvedValue({ user: { email: usuarioComum.email, admin: true } })
        findUserByEmailMock.mockResolvedValue({ ...usuarioComum, admin: false })

        await expect(requireAdmin()).rejects.toMatchObject({ reason: 'forbidden' })
    })
})
