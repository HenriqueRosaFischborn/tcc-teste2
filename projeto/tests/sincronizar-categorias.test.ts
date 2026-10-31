import { beforeEach, describe, expect, it, vi } from 'vitest'

import {
    sincronizarCategorias,
    type DivisaoDoFormulario
} from '@/app/gerenciamento/torneios/[torneio]/editar/form/sincronizar-categorias'

const ID_TORNEIO = BigInt(9)

const DIV_ABSOLUTO = BigInt(10)
const DIV_SUB12 = BigInt(11)
const DIV_NOVA = BigInt(50)

const UUID_CAT_ABSOLUTO = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
const UUID_CAT_SUB12 = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'

/** Divisões que já existem no banco: a Sub-12 tem 2 inscrições. */
function divisoesDoBanco() {
    return [
        { id: DIV_ABSOLUTO, name: 'Absoluto', isAbsolute: true, genre: 'ambos', _count: { incricao: 0 } },
        { id: DIV_SUB12, name: 'Sub-12', isAbsolute: false, genre: 'ambos', _count: { incricao: 2 } }
    ]
}

/** Categorias que já existem: a Sub-12 tem 2 inscrições, a Absoluta nenhuma. */
function categoriasDoBanco() {
    return [
        {
            uuid: UUID_CAT_ABSOLUTO,
            name: 'Absoluto',
            value: 80,
            min_y: 1900,
            max_y: 2100,
            default_division: DIV_ABSOLUTO,
            divisoes: { name: 'Absoluto' },
            _count: { incricao: 0 }
        },
        {
            uuid: UUID_CAT_SUB12,
            name: 'Sub-12',
            value: 50,
            min_y: 2010,
            max_y: 2013,
            default_division: DIV_SUB12,
            divisoes: { name: 'Sub-12' },
            _count: { incricao: 2 }
        }
    ]
}

type Tx = ReturnType<typeof criarTx>

function criarTx() {
    return {
        categoria: {
            findMany: vi.fn(),
            update: vi.fn().mockResolvedValue({}),
            create: vi.fn().mockResolvedValue({}),
            deleteMany: vi.fn().mockResolvedValue({ count: 0 })
        },
        divisoes: {
            findMany: vi.fn(),
            update: vi.fn().mockResolvedValue({}),
            create: vi.fn().mockResolvedValue({ id: DIV_NOVA }),
            deleteMany: vi.fn().mockResolvedValue({ count: 0 })
        }
    }
}

function semear(tx: Tx, opcoes: { categorias?: unknown[], divisoes?: unknown[] } = {}) {
    tx.categoria.findMany.mockResolvedValue(opcoes.categorias ?? categoriasDoBanco())
    tx.divisoes.findMany.mockResolvedValue(opcoes.divisoes ?? divisoesDoBanco())
}

/** Payload padrão: mantém as duas divisões e as duas categorias. */
function formularioPadrao(): DivisaoDoFormulario[] {
    return [
        {
            name: 'Absoluto',
            isAbsolute: true,
            genre: 'Masculino/Feminino',
            categories: [{ name: 'Absoluto', value: 'R$ 80,00', from: 1900, to: 2100, divisionFor: 'Absoluto' }]
        },
        {
            name: 'Sub-12',
            isAbsolute: false,
            genre: 'Masculino/Feminino',
            categories: [{ name: 'Sub-12', value: 'R$ 50,00', from: 2010, to: 2013, divisionFor: 'Sub-12' }]
        }
    ]
}

/** Confere que nenhuma escrita aconteceu. */
function nadaFoiEscrito(tx: Tx) {
    expect(tx.categoria.update).not.toHaveBeenCalled()
    expect(tx.categoria.create).not.toHaveBeenCalled()
    expect(tx.categoria.deleteMany).not.toHaveBeenCalled()
    expect(tx.divisoes.update).not.toHaveBeenCalled()
    expect(tx.divisoes.create).not.toHaveBeenCalled()
    expect(tx.divisoes.deleteMany).not.toHaveBeenCalled()
}

let tx: Tx

beforeEach(() => {
    tx = criarTx()
    semear(tx)
})

describe('T09 — edição legítima preserva as inscrições', () => {
    it('atualiza a categoria existente pelo uuid, sem apagar nem recriar', async () => {
        const formulario = formularioPadrao()
        formulario[1].categories![0].value = 'R$ 70,00'

        const resultado = await sincronizarCategorias(tx as never, ID_TORNEIO, formulario)

        expect(resultado).toMatchObject({ ok: true, criadas: 0 })

        // A Sub-12 (que tem inscrições) foi atualizada no lugar, mesmo uuid.
        expect(tx.categoria.update).toHaveBeenCalledWith({
            where: { uuid: UUID_CAT_SUB12 },
            data: expect.objectContaining({ value: 70, default_division: DIV_SUB12 })
        })

        expect(tx.categoria.deleteMany).not.toHaveBeenCalled()
        expect(tx.divisoes.deleteMany).not.toHaveBeenCalled()
        expect(tx.categoria.create).not.toHaveBeenCalled()
    })

    it('atualiza a divisão existente pelo id, preservando o vínculo da inscrição', async () => {
        await sincronizarCategorias(tx as never, ID_TORNEIO, formularioPadrao())

        expect(tx.divisoes.update).toHaveBeenCalledWith({
            where: { id: DIV_SUB12 },
            data: { isAbsolute: false, genre: 'ambos' }
        })
        expect(tx.divisoes.create).not.toHaveBeenCalled()
    })

    it('converte o valor em reais como o formulário faz', async () => {
        const formulario = formularioPadrao()
        formulario[0].categories![0].value = 'R$ 1.234,50'

        await sincronizarCategorias(tx as never, ID_TORNEIO, formulario)

        expect(tx.categoria.update).toHaveBeenCalledWith({
            where: { uuid: UUID_CAT_ABSOLUTO },
            data: expect.objectContaining({ value: 1234.5 })
        })
    })

    it('normaliza o gênero da divisão', async () => {
        const formulario = formularioPadrao()
        formulario[0].genre = 'Feminino'

        await sincronizarCategorias(tx as never, ID_TORNEIO, formulario)

        expect(tx.divisoes.update).toHaveBeenCalledWith(
            expect.objectContaining({ data: expect.objectContaining({ genre: 'feminino' }) })
        )
    })

    it('cria categoria nova apontando para a divisão certa', async () => {
        const formulario = formularioPadrao()
        formulario[1].categories!.push({
            name: 'Sub-10',
            value: 'R$ 40,00',
            from: 2014,
            to: 2016,
            divisionFor: 'Sub-12'
        })

        const resultado = await sincronizarCategorias(tx as never, ID_TORNEIO, formulario)

        expect(resultado).toMatchObject({ ok: true, criadas: 1 })
        expect(tx.categoria.create).toHaveBeenCalledWith({
            data: expect.objectContaining({ name: 'Sub-10', default_division: DIV_SUB12, id_torneio: ID_TORNEIO })
        })
    })

    it('cria divisão nova e usa o id devolvido', async () => {
        const formulario = formularioPadrao()
        formulario.push({
            name: 'Sub-16',
            isAbsolute: false,
            genre: 'Masculino',
            categories: [{ name: 'Sub-16', value: 'R$ 60,00', from: 2006, to: 2009, divisionFor: 'Sub-16' }]
        })

        await sincronizarCategorias(tx as never, ID_TORNEIO, formulario)

        expect(tx.divisoes.create).toHaveBeenCalledWith({
            data: { name: 'Sub-16', id_torneio: ID_TORNEIO, isAbsolute: false, genre: 'masculino' }
        })
        expect(tx.categoria.create).toHaveBeenCalledWith({
            data: expect.objectContaining({ name: 'Sub-16', default_division: DIV_NOVA })
        })
    })

    it('remove categoria sem inscrição', async () => {
        const formulario = formularioPadrao()
        formulario[0].categories = []

        const resultado = await sincronizarCategorias(tx as never, ID_TORNEIO, formulario)

        expect(resultado).toMatchObject({ ok: true })
        expect(tx.categoria.deleteMany).toHaveBeenCalledWith({
            where: { uuid: { in: [UUID_CAT_ABSOLUTO] } }
        })
    })
})

describe('T09 — exclusão de categoria/divisão com inscrição é recusada', () => {
    it('recusa remover categoria com inscrições e não escreve nada', async () => {
        const formulario = formularioPadrao()
        formulario[1].categories = []

        const resultado = await sincronizarCategorias(tx as never, ID_TORNEIO, formulario)

        expect(resultado.ok).toBe(false)
        expect(resultado.ok === false && resultado.motivo).toMatch(/Sub-12/)
        expect(resultado.ok === false && resultado.motivo).toMatch(/2 inscrição/)
        nadaFoiEscrito(tx)
    })

    it('recusa remover divisão com inscrições e não escreve nada', async () => {
        const formulario = formularioPadrao()
        formulario.pop()

        const resultado = await sincronizarCategorias(tx as never, ID_TORNEIO, formulario)

        expect(resultado.ok).toBe(false)
        expect(resultado.ok === false && resultado.motivo).toMatch(/Sub-12/)
        nadaFoiEscrito(tx)
    })

    it('recusa renomear categoria com inscrições (não dá para distinguir de excluir)', async () => {
        const formulario = formularioPadrao()
        formulario[1].categories![0].name = 'Sub-12 Renomeada'

        const resultado = await sincronizarCategorias(tx as never, ID_TORNEIO, formulario)

        expect(resultado.ok).toBe(false)
        nadaFoiEscrito(tx)
    })

    it('recusa quando a divisão some mas a categoria com inscrição fica', async () => {
        const formulario = formularioPadrao()
        formulario.pop()

        const resultado = await sincronizarCategorias(tx as never, ID_TORNEIO, formulario)

        expect(resultado.ok).toBe(false)
        nadaFoiEscrito(tx)
    })
})

describe('T09 — caso base sem inscrições', () => {
    it('recria tudo sem bloqueio quando ninguém está inscrito', async () => {
        semear(tx, {
            divisoes: [
                { id: DIV_ABSOLUTO, name: 'Absoluto', isAbsolute: true, genre: 'ambos', _count: { incricao: 0 } }
            ],
            categorias: [
                {
                    uuid: UUID_CAT_ABSOLUTO,
                    name: 'Absoluto',
                    value: 80,
                    min_y: 1900,
                    max_y: 2100,
                    default_division: DIV_ABSOLUTO,
                    divisoes: { name: 'Absoluto' },
                    _count: { incricao: 0 }
                }
            ]
        })

        const resultado = await sincronizarCategorias(tx as never, ID_TORNEIO, [
            {
                name: 'Absoluto',
                isAbsolute: true,
                genre: 'Masculino/Feminino',
                categories: [
                    { name: 'Absoluto', value: 'R$ 90,00', from: 1900, to: 2100, divisionFor: 'Absoluto' }
                ]
            }
        ])

        expect(resultado).toMatchObject({ ok: true })
        expect(tx.categoria.update).toHaveBeenCalledTimes(1)
        expect(tx.categoria.deleteMany).not.toHaveBeenCalled()
    })
})
