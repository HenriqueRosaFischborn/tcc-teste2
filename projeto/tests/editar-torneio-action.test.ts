import { beforeEach, describe, expect, it, vi } from 'vitest'

const { requireAdminMock, transactionMock, tempoFindFirstMock, txMock } = vi.hoisted(() => ({
    requireAdminMock: vi.fn(),
    transactionMock: vi.fn(),
    tempoFindFirstMock: vi.fn(),
    txMock: {
        torneio: { update: vi.fn() },
        emails: { deleteMany: vi.fn(), createMany: vi.fn() },
        categoria: {
            findMany: vi.fn(),
            update: vi.fn(),
            create: vi.fn(),
            deleteMany: vi.fn()
        },
        divisoes: {
            findMany: vi.fn(),
            update: vi.fn(),
            create: vi.fn(),
            deleteMany: vi.fn()
        }
    }
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

vi.mock('@/lib/db', () => ({
    default: {
        tempo: { findFirst: tempoFindFirstMock },
        $transaction: transactionMock
    }
}))

import addTournmentForm from '@/app/gerenciamento/torneios/[torneio]/editar/form/action'

const ID_TORNEIO = 9
const DIV_SUB12 = BigInt(11)

const categoriasDoBanco = [
    {
        uuid: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
        name: 'Sub-12',
        value: 50,
        min_y: 2010,
        max_y: 2013,
        default_division: DIV_SUB12,
        divisoes: { name: 'Sub-12' },
        _count: { incricao: 2 }
    }
]

const divisoesDoBanco = [
    { id: DIV_SUB12, name: 'Sub-12', isAbsolute: false, genre: 'ambos', _count: { incricao: 2 } }
]

const divisionsJson = JSON.stringify([
    {
        name: 'Sub-12',
        isAbsolute: false,
        genre: 'Masculino/Feminino',
        categories: [{ name: 'Sub-12', value: 'R$ 50,00', from: 2010, to: 2013, divisionFor: 'Sub-12' }]
    }
])

const initialValue = { message: '' }

function formulario(opcoes: { divisions?: string, difference?: string } = {}) {
    const formdata = new FormData()

    formdata.set('fileFolder', new File([], ''))
    formdata.set('fileReg', new File([], ''))
    formdata.set('fileQr', new File([], ''))
    formdata.set('title', 'Torneio de Teste')
    formdata.set('timeAnalog', '5+0')
    formdata.set('timeDigital', '5+0')
    formdata.set('local', 'Araranguá')
    formdata.set('localLink', '')
    formdata.append('borndate', '01/01/2026')
    formdata.append('borndate', '02/01/2026')
    formdata.append('hour', '09:00')
    formdata.append('hour', '10:00')
    formdata.set('chave-pix', '')
    formdata.set('link-chess-results', '')
    formdata.set('defaultTournment', JSON.stringify({ id: ID_TORNEIO }))
    formdata.set('emails', JSON.stringify([]))
    formdata.set('divisions', opcoes.divisions ?? divisionsJson)
    formdata.set('difference', opcoes.difference ?? 'true')

    return formdata
}

beforeEach(() => {
    requireAdminMock.mockReset().mockResolvedValue({ id: 1, email: 'admin@exemplo.com', admin: true, socio: false })
    tempoFindFirstMock.mockReset().mockResolvedValue({ id: BigInt(1) })
    transactionMock.mockReset().mockImplementation(async (callback: (tx: unknown) => Promise<unknown>) => callback(txMock))

    for (const grupo of Object.values(txMock)) {
        for (const funcao of Object.values(grupo)) {
            (funcao as ReturnType<typeof vi.fn>).mockReset().mockResolvedValue({ count: 0 })
        }
    }

    txMock.categoria.findMany.mockResolvedValue(categoriasDoBanco)
    txMock.divisoes.findMany.mockResolvedValue(divisoesDoBanco)
})

describe('T09 — edição de torneio não apaga inscrições', () => {
    it('recusa a edição cuja sincronização removeria categoria com inscrições', async () => {
        const semCategorias = JSON.stringify([
            { name: 'Sub-12', isAbsolute: false, genre: 'Masculino/Feminino', categories: [] }
        ])

        const resultado = await addTournmentForm(initialValue, formulario({ divisions: semCategorias }))

        expect(resultado.message).toMatch(/Sub-12/)
        expect(resultado.message).toMatch(/não é possível excluir/i)

        // O essencial: nada foi gravado. Nem a categoria, nem o torneio, nem os e-mails.
        expect(txMock.categoria.deleteMany).not.toHaveBeenCalled()
        expect(txMock.divisoes.deleteMany).not.toHaveBeenCalled()
        expect(txMock.torneio.update).not.toHaveBeenCalled()
        expect(txMock.emails.deleteMany).not.toHaveBeenCalled()
    })

    it('edição legítima grava o torneio e atualiza a categoria no lugar', async () => {
        const resultado = await addTournmentForm(initialValue, formulario())

        expect(resultado).toEqual({ message: 'Sucesso' })
        expect(txMock.torneio.update).toHaveBeenCalledTimes(1)
        expect(txMock.categoria.update).toHaveBeenCalledWith(
            expect.objectContaining({ where: { uuid: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb' } })
        )
        expect(txMock.categoria.deleteMany).not.toHaveBeenCalled()
    })

    it('sem alteração de categorias, nem consulta o catálogo', async () => {
        const resultado = await addTournmentForm(
            initialValue,
            formulario({ difference: 'false' })
        )

        expect(resultado).toEqual({ message: 'Sucesso' })
        expect(txMock.categoria.findMany).not.toHaveBeenCalled()
        expect(txMock.categoria.deleteMany).not.toHaveBeenCalled()
        expect(txMock.torneio.update).toHaveBeenCalledTimes(1)
    })
})
