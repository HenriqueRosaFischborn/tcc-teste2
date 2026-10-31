'use server'

import { requireAdmin } from "@/lib/auth-guard"
import { findUserByEmail } from "@/lib/user"
import db from "@/lib/db"

export type ChangeFunctionResult = {
    ok: boolean
    message?: string
}

/**
 * Define a função de um usuário: administrador ou usuário comum.
 *
 * A autorização é reconferida no banco a cada chamada — esta action é um
 * endpoint público e não pode depender de quem renderizou a tela.
 *
 * O valor desejado chega pronto do cliente em vez de ser derivado do estado
 * atual do banco: assim duas abas abertas, ou uma tela desatualizada, não
 * invertem a função por engano.
 */
export async function changeFunction(email: string, admin: boolean): Promise<ChangeFunctionResult> {
    await requireAdmin()

    if (typeof email !== 'string' || email.trim() === '' || typeof admin !== 'boolean') {
        return { ok: false, message: 'Dados inválidos.' }
    }

    const alvo = await findUserByEmail(email)

    if (!alvo) {
        return { ok: false, message: 'Usuário não encontrado.' }
    }

    // Idempotente: repetir a função que ele já tem não é erro.
    if (alvo.admin === admin) {
        return { ok: true }
    }

    if (!admin) {
        const administradores = await db.usuario.count({ where: { admin: true } })

        // O sistema nunca pode ficar sem administrador: sem isso ninguém mais
        // consegue gerenciar torneios nem usuários.
        //
        // PENDÊNCIA T43 (própria, separada da T10): a contagem e o update não
        // são atômicos, então dois administradores que se rebaixem exatamente ao
        // mesmo tempo podem passar os dois pela checagem e zerar os admins.
        // Fechar com transação interativa em isolationLevel Serializable,
        // tratando o erro de serialização (Prisma P2034).
        if (administradores <= 1) {
            return {
                ok: false,
                message: 'Este é o último administrador. Promova outro usuário antes de rebaixá-lo.'
            }
        }
    }

    await db.usuario.update({
        where: { id: alvo.id },
        data: { admin }
    })

    return { ok: true }
}
