import { beforeEach, describe, expect, it, vi } from 'vitest'
import crypto from 'crypto'
import * as argon2 from 'argon2'

const { findUniqueMock, updateMock, deleteManyMock, transactionMock } = vi.hoisted(() => ({
    findUniqueMock: vi.fn(),
    updateMock: vi.fn(),
    deleteManyMock: vi.fn(),
    transactionMock: vi.fn()
}))

vi.mock('@/lib/db', () => ({
    default: {
        passwordresettoken: { findUnique: findUniqueMock, deleteMany: deleteManyMock },
        usuario: { update: updateMock },
        $transaction: transactionMock
    }
}))

import resetPasswordAction from '@/app/(auth)/redefinir-senha/form/action'

const TOKEN = 'token-em-claro-do-link'
const HASH_DO_TOKEN = crypto.createHash('sha256').update(TOKEN).digest('hex')
const USUARIO = 7
const SENHA = 'senhaNova123'

const estadoInicial = {}

function formulario(opcoes: { token?: string, password?: string } = {}) {
    const formdata = new FormData()

    formdata.set('token', opcoes.token ?? TOKEN)
    formdata.set('password', opcoes.password ?? SENHA)
    formdata.set('email', 'jogador@exemplo.com')

    return formdata
}

function registro(expiraEm: Date) {
    return { id: 1, token: HASH_DO_TOKEN, createdby: USUARIO, createdat: new Date(), expiresat: expiraEm }
}

beforeEach(() => {
    findUniqueMock.mockReset().mockImplementation(async ({ where }: { where: { token: string } }) =>
        where.token === HASH_DO_TOKEN ? registro(new Date(Date.now() + 10 * 60 * 1000)) : null
    )

    updateMock.mockReset().mockResolvedValue({})
    deleteManyMock.mockReset().mockResolvedValue({ count: 1 })
    transactionMock.mockReset().mockImplementation(async (operacoes: Promise<unknown>[]) => Promise.all(operacoes))
})

describe('redefinição de senha — caminho feliz', () => {
    it('grava a nova senha e responde sucesso', async () => {
        const resultado = await resetPasswordAction(estadoInicial, formulario())

        expect(resultado.message).toEqual(['Sucesso'])
        expect(updateMock).toHaveBeenCalledWith({
            where: { id: USUARIO },
            data: { password: expect.any(String) }
        })
    })

    it('consome o token — uso único', async () => {
        await resetPasswordAction(estadoInicial, formulario())

        expect(deleteManyMock).toHaveBeenCalledWith({ where: { token: HASH_DO_TOKEN } })
        expect(transactionMock).toHaveBeenCalledTimes(1)
    })

    it('a senha gravada é um hash argon2 válido — login funciona depois', async () => {
        await resetPasswordAction(estadoInicial, formulario({ password: SENHA }))

        const hash = updateMock.mock.calls[0][0].data.password

        expect(hash).not.toBe(SENHA)
        await expect(argon2.verify(hash, SENHA)).resolves.toBe(true)
        await expect(argon2.verify(hash, 'outraSenha123')).resolves.toBe(false)
    })

    it('não devolve a senha nem o token para o navegador', async () => {
        const resultado = await resetPasswordAction(estadoInicial, formulario())

        const serializado = JSON.stringify(resultado)

        expect(resultado.values).toBeUndefined()
        expect(serializado).not.toContain(SENHA)
        expect(serializado).not.toContain(TOKEN)
    })
})

describe('redefinição de senha — token recusado', () => {
    it('token que não existe (nunca existiu ou já foi usado) é recusado', async () => {
        const resultado = await resetPasswordAction(estadoInicial, formulario({ token: 'outro-token' }))

        expect(resultado.message?.[0]).toMatch(/inválido ou já foi usado/i)
        expect(updateMock).not.toHaveBeenCalled()
        expect(transactionMock).not.toHaveBeenCalled()
    })

    it('token expirado é recusado sem gravar nada', async () => {
        findUniqueMock.mockResolvedValue(registro(new Date(Date.now() - 60 * 1000)))

        const resultado = await resetPasswordAction(estadoInicial, formulario())

        expect(resultado.message?.[0]).toMatch(/expirou/i)
        expect(updateMock).not.toHaveBeenCalled()
        expect(transactionMock).not.toHaveBeenCalled()
    })

    it('token vazio é recusado', async () => {
        const resultado = await resetPasswordAction(estadoInicial, formulario({ token: '' }))

        expect(resultado.message?.[0]).toMatch(/inválido/i)
        expect(findUniqueMock).not.toHaveBeenCalled()
    })
})

describe('redefinição de senha — senha recusada', () => {
    it('senha curta é recusada antes de consultar o token', async () => {
        const resultado = await resetPasswordAction(estadoInicial, formulario({ password: 'curta' }))

        expect(resultado.message?.[0]).toMatch(/pelo menos 8 caracteres/i)
        expect(findUniqueMock).not.toHaveBeenCalled()
        expect(updateMock).not.toHaveBeenCalled()
    })

    it('senha vazia marca o campo e não grava', async () => {
        const resultado = await resetPasswordAction(estadoInicial, formulario({ password: '' }))

        expect(resultado.emptyFields).toEqual(['password'])
        expect(updateMock).not.toHaveBeenCalled()
    })

    it('a senha recusada também não volta no estado do formulário', async () => {
        const resultado = await resetPasswordAction(estadoInicial, formulario({ password: 'curta' }))

        expect(JSON.stringify(resultado)).not.toContain('curta')
    })
})

describe('redefinição de senha — falha de banco', () => {
    it('erro na transação não deixa a senha trocada nem afirma sucesso', async () => {
        transactionMock.mockRejectedValue(new Error('banco fora'))

        const resultado = await resetPasswordAction(estadoInicial, formulario())

        expect(resultado.message?.[0]).not.toBe('Sucesso')
        expect(resultado.values).toBeUndefined()
    })
})
