import { beforeEach, describe, expect, it, vi } from 'vitest'

const { requireUserMock, findFirstMock, sendMock } = vi.hoisted(() => ({
    requireUserMock: vi.fn(),
    findFirstMock: vi.fn(),
    sendMock: vi.fn()
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
    default: { incricao: { findFirst: findFirstMock } }
}))

vi.mock('@/app/api/email/cancel-solicitation/send', () => ({
    sendCancelSolicitation: sendMock
}))

import { UnauthorizedError } from '@/lib/auth-guard'
import { requestCancellation } from '@/app/minhas-inscricoes/action'
import { resetAttempts } from '@/lib/rate-limit'

const jogador = { id: 7, email: 'jogador@exemplo.com', admin: false, socio: false }

/** Linha como o Prisma devolveria, já com relação incluída. */
const inscricaoDoBanco = {
    uuid: 'uuid-da-inscricao',
    city: 'Araranguá',
    club: 'CXA',
    genre: true,
    data_nasc: new Date('2010-05-04T00:00:00.000Z'),
    id_fide: BigInt(123456),
    id_cbx: BigInt(654321),
    uuid_cat: 'uuid-da-categoria',
    status: 'Pendente',
    id_usuario: 7,
    name: 'Nome Vindo do Banco',
    id_division: BigInt(2),
    id_torneio: BigInt(11),
    rtg_fide: BigInt(1800),
    rtg_cbx: BigInt(1750),
    federation: 'BRA',
    titulo: null,
    categoria: { name: 'Sub-16', uuid: 'uuid-da-categoria', id_torneio: BigInt(11), min_y: 2008 },
    divisoes: { name: 'Absoluto', id: BigInt(2) },
    usuario: { id: 7, email: 'jogador@exemplo.com' },
    torneio: { id: BigInt(11), title: 'Copa CXA' }
}

beforeEach(() => {
    requireUserMock.mockReset()
    findFirstMock.mockReset()
    sendMock.mockReset()
    resetAttempts(`cancelamento:${jogador.id}`)
})

describe('requestCancellation — autorização', () => {
    it('sem sessão: recusa e não envia e-mail', async () => {
        requireUserMock.mockRejectedValue(new UnauthorizedError('unauthenticated'))

        const resultado = await requestCancellation('uuid-da-inscricao')

        expect(resultado.ok).toBe(false)
        expect(sendMock).not.toHaveBeenCalled()
        expect(findFirstMock).not.toHaveBeenCalled()
    })

    it('inscrição de outra pessoa: recusa e não envia e-mail', async () => {
        requireUserMock.mockResolvedValue(jogador)
        // A consulta já filtra por id_usuario; para outro dono, não há linha.
        findFirstMock.mockResolvedValue(null)

        const resultado = await requestCancellation('uuid-de-outra-pessoa')

        expect(resultado.ok).toBe(false)
        expect(resultado.message).toMatch(/não encontrada/i)
        expect(sendMock).not.toHaveBeenCalled()
    })

    it('a posse participa da consulta ao banco', async () => {
        requireUserMock.mockResolvedValue(jogador)
        findFirstMock.mockResolvedValue(inscricaoDoBanco)
        sendMock.mockResolvedValue({ success: true })

        await requestCancellation('uuid-da-inscricao')

        expect(findFirstMock).toHaveBeenCalledWith(
            expect.objectContaining({
                where: { uuid: 'uuid-da-inscricao', id_usuario: jogador.id }
            })
        )
    })

    it('uuid vazio: recusa sem consultar o banco', async () => {
        requireUserMock.mockResolvedValue(jogador)

        const resultado = await requestCancellation('   ')

        expect(resultado.ok).toBe(false)
        expect(findFirstMock).not.toHaveBeenCalled()
        expect(sendMock).not.toHaveBeenCalled()
    })
})

describe('requestCancellation — usuário legítimo', () => {
    it('envia com dados vindos do banco e devolve ok', async () => {
        requireUserMock.mockResolvedValue(jogador)
        findFirstMock.mockResolvedValue(inscricaoDoBanco)
        sendMock.mockResolvedValue({ success: true })

        const resultado = await requestCancellation('uuid-da-inscricao')

        expect(resultado).toEqual({ ok: true })
        expect(sendMock).toHaveBeenCalledTimes(1)

        const [player, titulo, torneioId] = sendMock.mock.calls[0]

        // Conteúdo do e-mail sai do banco, não de entrada do navegador.
        expect(player.name).toBe('Nome Vindo do Banco')
        expect(player.usuario.email).toBe('jogador@exemplo.com')
        expect(titulo).toBe('Copa CXA')
        expect(torneioId).toBe(11)
    })

    it('o status da inscrição não é alterado (regra de negócio preservada)', async () => {
        requireUserMock.mockResolvedValue(jogador)
        findFirstMock.mockResolvedValue(inscricaoDoBanco)
        sendMock.mockResolvedValue({ success: true })

        await requestCancellation('uuid-da-inscricao')

        const [player] = sendMock.mock.calls[0]

        // O envio continua recebendo o status que estava no banco: nada aqui
        // cancela a inscrição, quem faz isso é o árbitro.
        expect(player.status).toBe('Pendente')
    })

    it('falha do provedor de e-mail vira mensagem, não exceção', async () => {
        requireUserMock.mockResolvedValue(jogador)
        findFirstMock.mockResolvedValue(inscricaoDoBanco)
        sendMock.mockResolvedValue({ success: false, error: new Error('resend fora') })

        const resultado = await requestCancellation('uuid-da-inscricao')

        expect(resultado.ok).toBe(false)
        expect(resultado.message).toMatch(/não foi possível enviar/i)
    })
})

describe('requestCancellation — limite de disparos', () => {
    it('bloqueia a quarta solicitação seguida do mesmo jogador', async () => {
        requireUserMock.mockResolvedValue(jogador)
        findFirstMock.mockResolvedValue(inscricaoDoBanco)
        sendMock.mockResolvedValue({ success: true })

        for (let i = 0; i < 3; i++) {
            const permitida = await requestCancellation('uuid-da-inscricao')
            expect(permitida.ok).toBe(true)
        }

        const bloqueada = await requestCancellation('uuid-da-inscricao')

        expect(bloqueada.ok).toBe(false)
        expect(bloqueada.message).toMatch(/aguarde alguns minutos/i)
        expect(sendMock).toHaveBeenCalledTimes(3)
    })
})
