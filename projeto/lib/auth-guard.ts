import 'server-only'

import { cache } from 'react'
import { auth } from '@/auth'
import { findUserByEmail } from './user'

/**
 * Verificação de sessão para uso dentro do servidor (Server Actions, Server
 * Components e Route Handlers).
 *
 * Este arquivo é a fronteira de autorização da aplicação: `proxy.ts` protege
 * apenas a navegação por path, e Server Actions são endpoints POST públicos.
 * Toda action que muda ou lê dado privado deve começar por `requireUser()` ou
 * `requireAdmin()`.
 *
 * IMPORTANTE: não adicione `'use server'` aqui. Esse marcador transformaria
 * cada export em uma Server Action pública, que é exatamente o problema que
 * este módulo existe para evitar. Também não importe este arquivo em Client
 * Components.
 */

/** Usuário autenticado, com os campos que as regras de negócio usam. */
export type SessionUser = {
    id: number
    email: string
    admin: boolean
    socio: boolean
}

export type UnauthorizedReason = 'unauthenticated' | 'forbidden'

/**
 * Erro lançado quando a sessão não existe ou não tem o nível exigido.
 *
 * Lançar (em vez de retornar um resultado) mantém o caminho de falha óbvio: é
 * impossível esquecer de checar o retorno. Quem precisa de uma mensagem amiga
 * ao usuário captura o erro e checa `reason`.
 */
export class UnauthorizedError extends Error {
    readonly reason: UnauthorizedReason

    constructor(reason: UnauthorizedReason) {
        super(
            reason === 'unauthenticated'
                ? 'É necessário estar autenticado para esta operação.'
                : 'Esta operação é restrita a administradores.'
        )

        this.name = 'UnauthorizedError'
        this.reason = reason
    }
}

/**
 * Lê a sessão e resolve a linha do usuário no banco.
 *
 * O banco é a fonte da verdade, e não o JWT: a flag `admin` fica congelada no
 * token por até 30 dias, então um administrador rebaixado continuaria com
 * acesso se confiássemos apenas em `session.user.admin`.
 *
 * A busca é feita com `findUserByEmail`, que ignora a caixa das letras — é a
 * mesma função usada no login, então a sessão sempre resolve para o usuário
 * que a criou.
 *
 * `cache` memoriza o resultado dentro da mesma requisição: várias chamadas de
 * `requireAdmin` no mesmo fluxo geram uma única consulta.
 */
const getCurrentUser = cache(async (): Promise<SessionUser | null> => {
    const session = await auth()
    const email = session?.user?.email

    if (!email) {
        return null
    }

    const user = await findUserByEmail(email)

    if (!user) {
        return null
    }

    return {
        id: user.id,
        email: user.email,
        admin: user.admin,
        socio: user.socio
    }
})

/** Exige um usuário autenticado e devolve os dados dele. */
export async function requireUser(): Promise<SessionUser> {
    const user = await getCurrentUser()

    if (!user) {
        throw new UnauthorizedError('unauthenticated')
    }

    return user
}

/** Exige um administrador (reconferido no banco) e devolve os dados dele. */
export async function requireAdmin(): Promise<SessionUser> {
    const user = await getCurrentUser()

    if (!user) {
        throw new UnauthorizedError('unauthenticated')
    }

    if (!user.admin) {
        throw new UnauthorizedError('forbidden')
    }

    return user
}
