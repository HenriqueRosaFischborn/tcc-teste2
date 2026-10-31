import { beforeEach, describe, expect, it, vi } from 'vitest'

const { upsertMock, findUserByEmailMock, sendEmailMock } = vi.hoisted(() => ({
    upsertMock: vi.fn(),
    findUserByEmailMock: vi.fn(),
    sendEmailMock: vi.fn()
}))

vi.mock('@/lib/db', () => ({
    default: { passwordresettoken: { upsert: upsertMock } }
}))

vi.mock('@/lib/user', () => ({ findUserByEmail: findUserByEmailMock }))

vi.mock('@/app/api/email/reset-password/send', () => ({ sendEmail: sendEmailMock }))

import sendEmailAction from '@/app/(auth)/esqueci-minha-senha/form/action'
import { resetAttempts } from '@/lib/rate-limit'

const EMAIL = 'jogador@exemplo.com'
const usuario = { id: 7, email: EMAIL, admin: false, socio: false }

beforeEach(() => {
    upsertMock.mockReset().mockResolvedValue({})
    findUserByEmailMock.mockReset().mockResolvedValue(usuario)
    sendEmailMock.mockReset().mockResolvedValue({ success: true })

    resetAttempts(`reset-senha:${EMAIL}`)
    resetAttempts('reset-senha:fantasma@exemplo.com')
})

describe('solicitação de redefinição — envio', () => {
    it('primeira solicitação cria o token e envia o e-mail', async () => {
        const resultado = await sendEmailAction(EMAIL)

        expect(resultado).toEqual({ ok: true })
        expect(upsertMock).toHaveBeenCalledTimes(1)
        expect(sendEmailMock).toHaveBeenCalledTimes(1)

        const [args] = upsertMock.mock.calls[0]
        expect(args.where).toEqual({ createdby: usuario.id })
        expect(args.create.createdby).toBe(usuario.id)
        expect(args.create.token).toMatch(/^[0-9a-f]{64}$/)
    })

    it('segunda solicitação substitui o token anterior (upsert) e envia de novo', async () => {
        await sendEmailAction(EMAIL)
        await sendEmailAction(EMAIL)

        expect(upsertMock).toHaveBeenCalledTimes(2)
        expect(sendEmailMock).toHaveBeenCalledTimes(2)

        const primeiro = upsertMock.mock.calls[0][0]
        const segundo = upsertMock.mock.calls[1][0]

        // O schema tem `createdby @unique`: a segunda solicitação precisa
        // ATUALIZAR a linha, nunca criar outra (era isso que travava tudo).
        expect(segundo.update).toBeDefined()
        expect(segundo.update.token).not.toBe(primeiro.create.token)
    })

    it('o link enviado carrega o token em claro e o banco guarda só o hash', async () => {
        await sendEmailAction(EMAIL)

        const tokenEnviado = sendEmailMock.mock.calls[0][1]
        const tokenNoBanco = upsertMock.mock.calls[0][0].create.token

        expect(tokenEnviado).not.toBe(tokenNoBanco)
        expect(tokenNoBanco).toMatch(/^[0-9a-f]{64}$/)
    })
})

describe('solicitação de redefinição — resposta genérica', () => {
    it('e-mail inexistente devolve a mesma resposta e não envia nada', async () => {
        findUserByEmailMock.mockResolvedValue(null)

        const resultado = await sendEmailAction('fantasma@exemplo.com')

        expect(resultado).toEqual({ ok: true })
        expect(upsertMock).not.toHaveBeenCalled()
        expect(sendEmailMock).not.toHaveBeenCalled()
    })

    it('a resposta é idêntica para conta existente e inexistente', async () => {
        resetAttempts(`reset-senha:${EMAIL}`)

        const existente = await sendEmailAction(EMAIL)

        findUserByEmailMock.mockResolvedValue(null)
        const inexistente = await sendEmailAction('fantasma@exemplo.com')

        expect(existente).toEqual(inexistente)
    })

    it('e-mail com formato inválido devolve a mesma resposta', async () => {
        const resultado = await sendEmailAction('nao-e-email')

        expect(resultado).toEqual({ ok: true })
        expect(upsertMock).not.toHaveBeenCalled()
    })

    it('falha no envio não vira erro visível nem denuncia a conta', async () => {
        sendEmailMock.mockRejectedValue(new Error('resend fora'))

        const resultado = await sendEmailAction(EMAIL)

        expect(resultado).toEqual({ ok: true })
    })
})

describe('solicitação de redefinição — limite de solicitações', () => {
    it('bloqueia a partir da quarta solicitação, sem mudar a resposta', async () => {
        const respostas = []

        for (let i = 0; i < 4; i++) {
            respostas.push(await sendEmailAction(EMAIL))
        }

        expect(respostas.every((r) => r.ok === true)).toBe(true)
        // 3 permitidas, a quarta barrada.
        expect(sendEmailMock).toHaveBeenCalledTimes(3)
        expect(upsertMock).toHaveBeenCalledTimes(3)
    })

    it('o limite de um e-mail não afeta outro', async () => {
        const outro = { id: 8, email: 'outro@exemplo.com', admin: false, socio: false }

        for (let i = 0; i < 4; i++) {
            await sendEmailAction(EMAIL)
        }

        findUserByEmailMock.mockResolvedValue(outro)
        resetAttempts('reset-senha:outro@exemplo.com')

        await sendEmailAction('outro@exemplo.com')

        expect(sendEmailMock).toHaveBeenCalledTimes(4)
    })
})
