/**
 * Requisitos mínimos da nova senha, verificados no servidor.
 *
 * Módulo puro: sem banco, sem `'use server'`. O formulário pode ter as suas
 * próprias dicas, mas quem decide é esta função.
 */

export const TAMANHO_MINIMO_SENHA = 8
export const TAMANHO_MAXIMO_SENHA = 128

export type ResultadoSenha = { ok: true } | { ok: false, motivo: string }

export function validarSenha(senha: unknown): ResultadoSenha {
    if (typeof senha !== 'string' || senha === '') {
        return { ok: false, motivo: 'Informe a nova senha.' }
    }

    if (senha.trim() === '') {
        return { ok: false, motivo: 'A senha não pode ser só espaços.' }
    }

    if (senha.length < TAMANHO_MINIMO_SENHA) {
        return { ok: false, motivo: `A senha precisa ter pelo menos ${TAMANHO_MINIMO_SENHA} caracteres.` }
    }

    if (senha.length > TAMANHO_MAXIMO_SENHA) {
        return { ok: false, motivo: `A senha pode ter no máximo ${TAMANHO_MAXIMO_SENHA} caracteres.` }
    }

    return { ok: true }
}
