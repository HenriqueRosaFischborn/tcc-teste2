'use server'

import { FormState } from "@/lib/types"
import { verifyEmail, verifyTypes } from "./verify-types"
import  *  as  argon2  from  "argon2"
import  db  from "@/lib/db"
import { findUserByEmail } from "@/lib/user"
import { signIn } from "@/auth"



export default async function registerAction(preState: FormState, formdata: FormData): Promise<FormState> {
    let error = false
    const message = []
    const data = Object.fromEntries(formdata.entries()) as Record<string, string>
    
    
    const dataArray = Object.entries(data).filter(
        ([key]) => !key.startsWith('$')
    )
    
    const resData = Object.fromEntries(dataArray)


    if (!(await verifyTypes(resData))) {
        error = true
        console.log('erro desconhecido')
        message.push('Erro desconhecido')
    }
    
    const emptyFields =  dataArray.filter((el) => {
        if (el[1].trim() == '') {
            return true
        }
    }).map(el => el[0])

    if (emptyFields.length !== 0) {
        error = true
        message.push('Este campo é obrigatório')   
    }

    if (!(await verifyEmail(resData.email))) {
        error = true
        message.push('Email inválido')
    }

    const user = await findUserByEmail(resData.email)

    if (user) {
       error = true
       message.push('Este email já existe')
    }

    if (error) {
        return {
            message: message,
            emptyFields: emptyFields,
            values: [resData]
        }
    }

    const hash = await argon2.hash(resData.password)
    
    try {
        await db.usuario.create({
            data: {
                email: resData.email,
                password: hash
            }
        })
    } catch {
        return {
            message: ['Erro desconhecido'],
            values: [resData]
        }
    }

    try {
        await signIn('credentials', {
            email: resData.email,
            password: resData.password,
            redirect: false
        })

    } catch(e: unknown) {
        if (typeof e == 'object' && e !== null && 'type' in e && e.type == 'CredentialsSignin') {
            error = true
            message.push('Senha ou usuário incorretos')
        } else {
            error = true
            message.push('Erro desconhecido')
        }
    }

    return {
        message: ['Sucesso'],
        values: [resData]
    }
}