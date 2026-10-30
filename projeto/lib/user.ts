
import crypto from "crypto"
import db from "./db"
import * as argon2 from "argon2"



export default async function findUserByCredentials(email: string, password: string) {

    const user = await findUserByEmail(email)

    if (!user) {
        return null
    } else {

        const verify = await argon2.verify(user.password, password)

        if (verify) {
            return {id: String(user.id), email: user.email, admin: user.admin}
        } else {
            return null
        }
    }
}

/**
 * Busca o usuário pelo email sem diferenciar maiúsculas de minúsculas — o Google
 * devolve o email da conta e o cadastro manual pode ter sido feito com outra caixa.
 */
export async function findUserByEmail(email: string) {
    return db.usuario.findFirst({
        where: {
            email: {
                equals: email,
                mode: 'insensitive'
            }
        }
    })
}

/**
 * Garante que exista um usuário para o email que veio do login com o Google.
 *
 * A conta é criada com uma senha aleatória que ninguém conhece, então o login
 * por senha continua indisponível até o usuário definir uma pela recuperação
 * de senha. Assim nenhuma coluna do banco precisa mudar.
 */
export async function ensureUserByEmail(email: string) {
    const existing = await findUserByEmail(email)

    if (existing) {
        return existing
    }

    const randomPassword = await argon2.hash(crypto.randomBytes(32).toString('hex'))

    try {
        return await db.usuario.create({
            data: {
                email: email,
                password: randomPassword
            }
        })
    } catch {
        // duas requisições simultâneas: a outra criou o usuário antes desta
        return findUserByEmail(email)
    }
}
