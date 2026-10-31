import { beforeEach, describe, expect, it, vi } from 'vitest'

const { requireAdminMock, findUserByEmailMock, countMock, updateMock } = vi.hoisted(() => ({
    requireAdminMock: vi.fn(),
    findUserByEmailMock: vi.fn(),
    countMock: vi.fn(),
    updateMock: vi.fn()
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

    return { requireAdmin: requireAdminMock, UnauthorizedError }
})

vi.mock('@/lib/user', () => ({
    findUserByEmail: findUserByEmailMock
}))

vi.mock('@/lib/db', () => ({
    default: { usuario: { count: countMock, update: updateMock } }
}))

import { changeFunction } from '@/app/gerenciamento/usuarios/changeFunction'
import { UnauthorizedError } from '@/lib/auth-guard'

const admin = { id: 1, email: 'admin@exemplo.com', admin: true, socio: true }
const outroAdmin = { id: 2, email: 'outro@exemplo.com', admin: true, socio: true }
const comum = { id: 7, email: 'jogador@exemplo.com', admin: false, socio: false }

beforeEach(() => {
    requireAdminMock.mockReset()
    findUserByEmailMock.mockReset()
    countMock.mockReset()
    updateMock.mockReset()
})

describe('changeFunction — autorização', () => {
    it('sem administrador, lança e não grava', async () => {
        requireAdminMock.mockRejectedValue(new UnauthorizedError('forbidden'))

        await expect(changeFunction(comum.email, true)).rejects.toBeInstanceOf(UnauthorizedError)
        expect(updateMock).not.toHaveBeenCalled()
    })

    it('promove um usuário comum', async () => {
        requireAdminMock.mockResolvedValue(admin)
        findUserByEmailMock.mockResolvedValue(comum)

        const resultado = await changeFunction(comum.email, true)

        expect(resultado).toEqual({ ok: true })
        expect(updateMock).toHaveBeenCalledWith({ where: { id: comum.id }, data: { admin: true } })
    })
})

describe('changeFunction — regra do último administrador', () => {
    it('recusa rebaixar o único administrador', async () => {
        requireAdminMock.mockResolvedValue(admin)
        findUserByEmailMock.mockResolvedValue(outroAdmin)
        countMock.mockResolvedValue(1)

        const resultado = await changeFunction(outroAdmin.email, false)

        expect(resultado.ok).toBe(false)
        expect(resultado.message).toMatch(/último administrador/i)
        expect(updateMock).not.toHaveBeenCalled()
    })

    it('permite rebaixar quando existe mais de um administrador', async () => {
        requireAdminMock.mockResolvedValue(admin)
        findUserByEmailMock.mockResolvedValue(outroAdmin)
        countMock.mockResolvedValue(2)

        const resultado = await changeFunction(outroAdmin.email, false)

        expect(resultado).toEqual({ ok: true })
        expect(updateMock).toHaveBeenCalledWith({ where: { id: outroAdmin.id }, data: { admin: false } })
    })
})

describe('changeFunction — entradas inválidas', () => {
    it('e-mail inexistente não grava', async () => {
        requireAdminMock.mockResolvedValue(admin)
        findUserByEmailMock.mockResolvedValue(null)

        const resultado = await changeFunction('ninguem@exemplo.com', true)

        expect(resultado.ok).toBe(false)
        expect(updateMock).not.toHaveBeenCalled()
    })

    it('repetir a função atual é idempotente e não consulta a contagem', async () => {
        requireAdminMock.mockResolvedValue(admin)
        findUserByEmailMock.mockResolvedValue(comum)

        const resultado = await changeFunction(comum.email, false)

        expect(resultado).toEqual({ ok: true })
        expect(countMock).not.toHaveBeenCalled()
        expect(updateMock).not.toHaveBeenCalled()
    })
})
