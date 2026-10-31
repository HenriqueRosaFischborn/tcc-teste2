'use server'

import db from "@/lib/db"
import { allowAttempt } from "@/lib/rate-limit"
import { findUserByEmail } from "@/lib/user"
import { verifyEmail } from "../../cadastro/form/verify-types"
import crypto from 'crypto'
import { sendEmail } from "@/app/api/email/reset-password/send"

/** Validade do link. Curto o bastante para um link vazado não durar, longo o
 *  bastante para a pessoa abrir o e-mail com calma. */
const VALIDADE_MS = 30 * 60 * 1000

/** Quantas solicitações por e-mail dentro da janela. */
const LIMITE_SOLICITACOES = 3
const JANELA_MS = 10 * 60 * 1000

/**
 * Resposta única para todos os casos.
 *
 * A tela mostra exatamente esta frase sempre — existe, não existe, foi
 * limitado, falhou o envio. É o que impede usar a recuperação de senha para
 * descobrir quem tem conta no site.
 */
export type ResultadoSolicitacao = { ok: true }

export default async function sendEmailAction(email: string): Promise<ResultadoSolicitacao> {
    const alvo = typeof email === 'string' ? email.replace(/"/g, '').trim() : ''

    if (alvo === '' || !(await verifyEmail(alvo))) {
        return { ok: true }
    }

    // Limite por e-mail: segura quem fica clicando e preserva a cota do Resend.
    // Entra na conta mesmo quando o e-mail não existe — senão o próprio limite
    // viraria um sinal de existência.
    if (!allowAttempt(`reset-senha:${alvo.toLowerCase()}`, LIMITE_SOLICITACOES, JANELA_MS)) {
        console.warn('Recuperação de senha: limite de solicitações atingido para', alvo)
        return { ok: true }
    }

    const user = await findUserByEmail(alvo)

    if (!user) {
        return { ok: true }
    }

    const token = crypto.randomBytes(32).toString('hex') // vai para o e-mail
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex') // vai para o banco
    const expiresat = new Date(Date.now() + VALIDADE_MS)

    try {
        // `createdby` é @unique no schema: só cabe uma linha por usuário. Um
        // `create` falharia na segunda solicitação (e para sempre, se o token
        // antigo tivesse expirado). O upsert troca o token da linha existente —
        // o link anterior deixa de funcionar, que é o comportamento desejado.
        await db.passwordresettoken.upsert({
            where: { createdby: user.id },
            create: { createdby: user.id, token: tokenHash, expiresat },
            update: { token: tokenHash, expiresat, createdat: new Date() }
        })

        await sendEmail(user.email, token)
    } catch (error) {
        // A resposta continua genérica: um erro aqui não pode virar sinal de
        // que a conta existe.
        console.error('Falha ao preparar a redefinição de senha:', error)
    }

    return { ok: true }
}
