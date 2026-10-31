import { beforeEach, describe, expect, it, vi } from 'vitest'

const { findFirstMock } = vi.hoisted(() => ({ findFirstMock: vi.fn() }))

vi.mock('@/lib/db', () => ({
    default: { incricao: { findFirst: findFirstMock } }
}))

import { buscarInscricaoDuplicada, idNumerico } from '@/lib/inscricao-duplicada'

const TORNEIO = BigInt(18)

beforeEach(() => {
    findFirstMock.mockReset().mockResolvedValue(null)
})

/** O `where` que a consulta recebeu. */
function whereEnviado() {
    return findFirstMock.mock.calls[0][0].where as Record<string, unknown>
}

describe('idNumerico', () => {
    it('converte texto numérico e recusa o resto', () => {
        expect(idNumerico('12345')).toBe(12345)
        expect(idNumerico('')).toBe(null)
        expect(idNumerico('   ')).toBe(null)
        expect(idNumerico('abc')).toBe(null)
        expect(idNumerico('12.5')).toBe(null)
        expect(idNumerico('0')).toBe(null)
        expect(idNumerico(undefined)).toBe(null)
    })
})

describe('buscarInscricaoDuplicada — identidade do jogador', () => {
    it('jogador sem nenhum ID não é bloqueado e nem consulta o banco', async () => {
        const resultado = await buscarInscricaoDuplicada({
            idTorneio: TORNEIO,
            identidade: { idFide: null, idCbx: null }
        })

        expect(resultado).toBe(null)
        expect(findFirstMock).not.toHaveBeenCalled()
    })

    it('compara pelo ID FIDE quando ele existe', async () => {
        await buscarInscricaoDuplicada({
            idTorneio: TORNEIO,
            identidade: { idFide: 123, idCbx: null }
        })

        expect(whereEnviado()).toEqual({
            id_torneio: TORNEIO,
            OR: [{ id_fide: 123 }]
        })
    })

    it('compara pelo ID CBX quando é o único disponível', async () => {
        await buscarInscricaoDuplicada({
            idTorneio: TORNEIO,
            identidade: { idFide: null, idCbx: 456 }
        })

        expect(whereEnviado()).toEqual({
            id_torneio: TORNEIO,
            OR: [{ id_cbx: 456 }]
        })
    })

    it('compara pelos dois quando os dois existem', async () => {
        await buscarInscricaoDuplicada({
            idTorneio: TORNEIO,
            identidade: { idFide: 123, idCbx: 456 }
        })

        expect(whereEnviado().OR).toEqual([{ id_fide: 123 }, { id_cbx: 456 }])
    })

    it('a conta responsável nunca entra na comparação', async () => {
        await buscarInscricaoDuplicada({
            idTorneio: TORNEIO,
            identidade: { idFide: 123, idCbx: 456 }
        })

        expect(whereEnviado()).not.toHaveProperty('id_usuario')
    })

    it('na edição, ignora a própria inscrição', async () => {
        await buscarInscricaoDuplicada({
            idTorneio: TORNEIO,
            identidade: { idFide: 123, idCbx: null },
            ignorarUuid: 'uuid-atual'
        })

        expect(whereEnviado().uuid).toEqual({ not: 'uuid-atual' })
    })

    it('devolve a inscrição encontrada', async () => {
        findFirstMock.mockResolvedValue({ uuid: 'outro-uuid', name: 'Fulano' })

        const resultado = await buscarInscricaoDuplicada({
            idTorneio: TORNEIO,
            identidade: { idFide: 123, idCbx: null }
        })

        expect(resultado).toEqual({ uuid: 'outro-uuid', name: 'Fulano' })
    })
})
