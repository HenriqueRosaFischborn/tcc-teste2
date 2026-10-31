'use server'

import db from "@/lib/db"
import { validarSenha } from "@/lib/password"
import { FormState } from "@/lib/types"
import crypto from 'crypto'
import * as argon2 from "argon2"

const LINK_INVALIDO = 'Este link de redefinição é inválido ou já foi usado. Solicite um novo.'
const LINK_EXPIRADO = 'Este link de redefinição expirou. Solicite um novo.'

/**
 * Troca a senha a partir do token do link.
 *
 * Nunca devolve o que o usuário digitou: nem a senha, nem o token. O estado de
 * formulário vai para o navegador, então `values` aqui seria vazamento.
 */
export default async function resetPasswordAction(prevSate: FormState, formdata: FormData): Promise<FormState> {
    const senha = formdata.get('password')
    const tokenBruto = String(formdata.get('token') ?? '')

    if (typeof senha !== 'string' || senha.trim() === '') {
        return {
            message: ['Informe a nova senha.'],
            emptyFields: ['password']
        }
    }

    const senhaValida = validarSenha(senha)

    if (!senhaValida.ok) {
        return {
            message: [senhaValida.motivo],
            emptyFields: []
        }
    }

    if (tokenBruto.trim() === '') {
        return { message: [LINK_INVALIDO], emptyFields: [] }
    }

    const tokenHash = crypto.createHash('sha256').update(tokenBruto).digest('hex')

    let registro

    try {
        registro = await db.passwordresettoken.findUnique({ where: { token: tokenHash } })
    } catch (error) {
        console.error('Erro ao consultar o token de redefinição:', error)
        return { message: [LINK_INVALIDO], emptyFields: [] }
    }

    // Token inexistente = nunca existiu ou já foi consumido.
    if (!registro) {
        return { message: [LINK_INVALIDO], emptyFields: [] }
    }

    if (registro.expiresat.getTime() < Date.now()) {
        return { message: [LINK_EXPIRADO], emptyFields: [] }
    }

    const hash = await argon2.hash(senha)

    try {
        // Grava a senha e consome o token na mesma transação: o token vale uma
        // vez só, mesmo se duas abas tentarem usar o mesmo link.
        await db.$transaction([
            db.usuario.update({
                where: { id: registro.createdby },
                data: { password: hash }
            }),
            db.passwordresettoken.deleteMany({
                where: { token: tokenHash }
            })
        ])
    } catch (error) {
        console.error('Erro ao redefinir a senha:', error)
        return { message: ['Não foi possível redefinir a senha agora. Tente novamente.'], emptyFields: [] }
    }

    return { message: ['Sucesso'], emptyFields: [] }
}
