'use server'

import db from "@/lib/db"
import { findUserByEmail } from "@/lib/user"
import { verifyEmail } from "../../cadastro/form/verify-types"
import crypto from 'crypto'
import { sendEmail } from "@/app/api/email/reset-password/send"


export default async function sendEmailAction(email: string) {
    const verify = await verifyEmail(email)
    
    if (email.trim() == '' || !verify) {
       console.log('deu ruim')
        return false 
    }

    const user = await findUserByEmail(email)

    if (!user) {
        return false
    }

    const dateExpire = new Date(Date.now() + 10 * 60 * 1000)

    const token = crypto.randomBytes(32).toString('hex') //vai para o email
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex') //vai para o banco

    const alreadyExist = await db.passwordresettoken.findFirst({
        where: {
            createdby: user.id
        }
    })
    const dateNow = new Date(Date.now())

    try {
        if (alreadyExist && alreadyExist.expiresat > dateNow) {
            console.log('O link para redefinição de senha já foi enviado para o seu email')
        } else {

            await db.passwordresettoken.create({
                data: {
                    createdby: user.id,
                    expiresat: dateExpire,
                    token: tokenHash
                }
            })
            console.log('enviar email')
    
            await sendEmail(email, token)
        }
        
    } catch {
        console.log('erro no db')
        return false
    }

    return true
}