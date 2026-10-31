import { describe, expect, it } from 'vitest'

import {
    divisaoAceitaGenero,
    normalizarGenero,
    validarCategoria,
    validarDivisao,
    validarTorneioAberto,
    type CategoriaDoTorneio,
    type DivisaoDoTorneio
} from '@/lib/regras-inscricao'

const DIV_ABSOLUTA = BigInt(3)
const DIV_SUB12_MASC = BigInt(4)
const DIV_SUB12_FEM = BigInt(5)

const UU_ABSOLUTO = 'aaaa1111-1111-4111-8111-111111111111'
const UU_SUB12_MASC = 'bbbb2222-2222-4222-8222-222222222222'
const UU_SUB12_FEM = 'cccc3333-3333-4333-8333-333333333333'

const divisoes: DivisaoDoTorneio[] = [
    { id: DIV_ABSOLUTA, name: 'Absoluto', genre: 'ambos', isAbsolute: true },
    { id: DIV_SUB12_MASC, name: 'Sub-12 Masculino', genre: 'masculino', isAbsolute: false },
    { id: DIV_SUB12_FEM, name: 'Sub-12 Feminino', genre: 'feminino', isAbsolute: false }
]

const categorias: CategoriaDoTorneio[] = [
    { uuid: UU_ABSOLUTO, name: 'Absoluto', min_y: 1900, max_y: 2100, default_division: DIV_ABSOLUTA },
    { uuid: UU_SUB12_MASC, name: 'Sub-12', min_y: 2010, max_y: 2013, default_division: DIV_SUB12_MASC },
    { uuid: UU_SUB12_FEM, name: 'Sub-12 Feminino', min_y: 2010, max_y: 2013, default_division: DIV_SUB12_FEM }
]

const UU_SUB14_MASC = 'dddd4444-4444-4444-8444-444444444444'

/** Torneio só de base, sem absoluta — é onde a regra de "mais próxima" aparece. */
const categoriasDeBase: CategoriaDoTorneio[] = [
    { uuid: UU_SUB12_MASC, name: 'Sub-12', min_y: 2010, max_y: 2013, default_division: DIV_SUB12_MASC },
    { uuid: UU_SUB14_MASC, name: 'Sub-14', min_y: 2006, max_y: 2009, default_division: DIV_SUB12_MASC }
]

describe('divisaoAceitaGenero', () => {
    it('ambos aceita os dois gêneros', () => {
        expect(divisaoAceitaGenero(divisoes[0], 'masc')).toBe(true)
        expect(divisaoAceitaGenero(divisoes[0], 'fem')).toBe(true)
    })

    it('divisão de gênero só aceita o seu', () => {
        expect(divisaoAceitaGenero(divisoes[1], 'masc')).toBe(true)
        expect(divisaoAceitaGenero(divisoes[1], 'fem')).toBe(false)
        expect(divisaoAceitaGenero(divisoes[2], 'fem')).toBe(true)
        expect(divisaoAceitaGenero(divisoes[2], 'masc')).toBe(false)
    })
})

describe('normalizarGenero', () => {
    it('aceita os dois valores do formulário e recusa o resto', () => {
        expect(normalizarGenero('masc')).toBe('masc')
        expect(normalizarGenero('fem')).toBe('fem')
        expect(normalizarGenero('outro')).toBe(null)
        expect(normalizarGenero(undefined)).toBe(null)
    })
})

describe('validarTorneioAberto', () => {
    const agora = new Date('2026-06-01T12:00:00.000Z')

    it('recusa torneio encerrado pelo árbitro', () => {
        const resultado = validarTorneioAberto(
            { date_inscri: new Date('2026-12-01T00:00:00.000Z'), inscri_closed_by_arbiter: true },
            agora
        )

        expect(resultado).toMatchObject({ ok: false })
    })

    it('recusa prazo vencido', () => {
        const resultado = validarTorneioAberto(
            { date_inscri: new Date('2026-05-01T00:00:00.000Z'), inscri_closed_by_arbiter: false },
            agora
        )

        expect(resultado.ok).toBe(false)
        expect(resultado.ok === false && resultado.motivo).toMatch(/prazo/i)
    })

    it('aceita prazo futuro e não encerrado', () => {
        const resultado = validarTorneioAberto(
            { date_inscri: new Date('2026-07-01T00:00:00.000Z'), inscri_closed_by_arbiter: false },
            agora
        )

        expect(resultado).toEqual({ ok: true })
    })
})

describe('validarCategoria — idade', () => {
    it('aceita categoria cuja faixa cobre o ano', () => {
        expect(validarCategoria({
            categorias, divisoes, uuidCategoria: UU_SUB12_MASC, anoNascimento: 2012, genero: 'masc'
        })).toEqual({ ok: true })
    })

    it('recusa categoria que não existe no torneio', () => {
        const resultado = validarCategoria({
            categorias, divisoes, uuidCategoria: 'inexistente', anoNascimento: 2012, genero: 'masc'
        })

        expect(resultado.ok).toBe(false)
        expect(resultado.ok === false && resultado.motivo).toMatch(/não pertence a este torneio/i)
    })

    it('recusa categoria fora da idade quando outra cobre o ano', () => {
        // 2012 está na faixa da Sub-12; escolher a Sub-12 Feminino é inválido
        // para gênero masculino, então aqui usamos o Absoluto com faixa estreita.
        const comFaixaEstreita: CategoriaDoTorneio[] = [
            { uuid: UU_ABSOLUTO, name: 'Absoluto', min_y: 2010, max_y: 2013, default_division: DIV_ABSOLUTA },
            { uuid: UU_SUB12_MASC, name: 'Sub-12', min_y: 2014, max_y: 2016, default_division: DIV_SUB12_MASC }
        ]

        const resultado = validarCategoria({
            categorias: comFaixaEstreita,
            divisoes,
            uuidCategoria: UU_SUB12_MASC,
            anoNascimento: 2012,
            genero: 'masc'
        })

        expect(resultado).toEqual({
            ok: false,
            motivo: expect.stringMatching(/não corresponde à idade/i)
        })
    })

    it('aceita a categoria mais próxima quando nenhuma faixa cobre a idade', () => {
        // Torneio só de base, sem categoria absoluta. Jogador nascido em 1990 é
        // mais velho que todas: a regra manda para a de menor `min_y` (Sub-14).
        expect(validarCategoria({
            categorias: categoriasDeBase,
            divisoes,
            uuidCategoria: UU_SUB14_MASC,
            anoNascimento: 1990,
            genero: 'masc'
        })).toEqual({ ok: true })
    })

    it('jogador mais novo que todas as faixas vai para a de maior `max_y`', () => {
        expect(validarCategoria({
            categorias: categoriasDeBase,
            divisoes,
            uuidCategoria: UU_SUB12_MASC,
            anoNascimento: 2020,
            genero: 'masc'
        })).toEqual({ ok: true })
    })

    it('recusa a outra categoria quando a regra manda para a mais próxima', () => {
        const resultado = validarCategoria({
            categorias: categoriasDeBase,
            divisoes,
            uuidCategoria: UU_SUB14_MASC,
            anoNascimento: 2020,
            genero: 'masc'
        })

        expect(resultado.ok).toBe(false)
    })

    it('recusa data de nascimento inválida', () => {
        expect(validarCategoria({
            categorias, divisoes, uuidCategoria: UU_ABSOLUTO, anoNascimento: Number.NaN, genero: 'masc'
        }).ok).toBe(false)

        expect(validarCategoria({
            categorias, divisoes, uuidCategoria: UU_ABSOLUTO, anoNascimento: 1800, genero: 'masc'
        }).ok).toBe(false)
    })
})

describe('validarCategoria — gênero', () => {
    it('recusa categoria de divisão feminina para jogador masculino', () => {
        const resultado = validarCategoria({
            categorias, divisoes, uuidCategoria: UU_SUB12_FEM, anoNascimento: 2012, genero: 'masc'
        })

        expect(resultado.ok).toBe(false)
        expect(resultado.ok === false && resultado.motivo).toMatch(/gênero/i)
    })

    it('aceita categoria de divisão feminina para jogadora', () => {
        expect(validarCategoria({
            categorias, divisoes, uuidCategoria: UU_SUB12_FEM, anoNascimento: 2012, genero: 'fem'
        })).toEqual({ ok: true })
    })

    it('categoria absoluta (divisão ambos) aceita os dois gêneros', () => {
        expect(validarCategoria({
            categorias, divisoes, uuidCategoria: UU_ABSOLUTO, anoNascimento: 1995, genero: 'fem'
        })).toEqual({ ok: true })
    })

    it('recusa categoria sem divisão configurada', () => {
        const semDivisao: CategoriaDoTorneio[] = [
            { uuid: UU_ABSOLUTO, name: 'Órfã', min_y: 1900, max_y: 2100, default_division: BigInt(999) }
        ]

        const resultado = validarCategoria({
            categorias: semDivisao, divisoes, uuidCategoria: UU_ABSOLUTO, anoNascimento: 1995, genero: 'masc'
        })

        expect(resultado.ok).toBe(false)
        expect(resultado.ok === false && resultado.motivo).toMatch(/sem divisão/i)
    })
})

describe('validarDivisao', () => {
    const categoriaSub12 = categorias[1]

    it('aceita a divisão padrão da categoria', () => {
        expect(validarDivisao({
            divisoes, categoria: categoriaSub12, idDivisao: DIV_SUB12_MASC, genero: 'masc'
        })).toEqual({ ok: true })
    })

    it('aceita a divisão absoluta', () => {
        expect(validarDivisao({
            divisoes, categoria: categoriaSub12, idDivisao: DIV_ABSOLUTA, genero: 'masc'
        })).toEqual({ ok: true })
    })

    it('recusa divisão que não pertence ao torneio', () => {
        const resultado = validarDivisao({
            divisoes, categoria: categoriaSub12, idDivisao: BigInt(123), genero: 'masc'
        })

        expect(resultado.ok).toBe(false)
        expect(resultado.ok === false && resultado.motivo).toMatch(/não pertence/i)
    })

    it('recusa divisão que não é a da categoria nem a absoluta', () => {
        // Divisão feminina do torneio não é a padrão da categoria nem a absoluta.
        const resultado = validarDivisao({
            divisoes, categoria: categoriaSub12, idDivisao: DIV_SUB12_FEM, genero: 'fem'
        })

        expect(resultado.ok).toBe(false)
        expect(resultado.ok === false && resultado.motivo).toMatch(/nem a divisão absoluta/i)
    })

    it('recusa divisão absoluta de gênero incompatível', () => {
        const divisoesComAbsolutaFem: DivisaoDoTorneio[] = [
            { id: DIV_ABSOLUTA, name: 'Absoluto', genre: 'feminino', isAbsolute: true },
            { id: DIV_SUB12_MASC, name: 'Sub-12 Masculino', genre: 'masculino', isAbsolute: false }
        ]

        const resultado = validarDivisao({
            divisoes: divisoesComAbsolutaFem,
            categoria: categoriaSub12,
            idDivisao: DIV_ABSOLUTA,
            genero: 'masc'
        })

        expect(resultado.ok).toBe(false)
        expect(resultado.ok === false && resultado.motivo).toMatch(/gênero/i)
    })
})
