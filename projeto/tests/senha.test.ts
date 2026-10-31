import { describe, expect, it } from 'vitest'

import { validarSenha, TAMANHO_MAXIMO_SENHA, TAMANHO_MINIMO_SENHA } from '@/lib/password'

describe('validarSenha', () => {
    it('aceita senha com o tamanho mínimo', () => {
        expect(validarSenha('a'.repeat(TAMANHO_MINIMO_SENHA))).toEqual({ ok: true })
    })

    it('recusa senha curta', () => {
        const resultado = validarSenha('a'.repeat(TAMANHO_MINIMO_SENHA - 1))

        expect(resultado.ok).toBe(false)
        expect(resultado.ok === false && resultado.motivo).toMatch(/pelo menos 8 caracteres/i)
    })

    it('recusa vazio e só espaços', () => {
        expect(validarSenha('').ok).toBe(false)
        expect(validarSenha('        ').ok).toBe(false)
        expect(validarSenha(undefined).ok).toBe(false)
    })

    it('recusa senha acima do máximo', () => {
        expect(validarSenha('a'.repeat(TAMANHO_MAXIMO_SENHA + 1)).ok).toBe(false)
    })

    it('aceita senha longa dentro do máximo', () => {
        expect(validarSenha('a'.repeat(TAMANHO_MAXIMO_SENHA))).toEqual({ ok: true })
    })
})
