'use server'

import { FormState } from "@/lib/types";
import { verifyEmail, verifyTypes } from "../../cadastro/form/verify-types";
import { signIn } from "@/auth";

export default async function loginAction(prevState: FormState, formdata: FormData): Promise<FormState> {
    const message = []
    let error = false

    const data = Object.fromEntries(formdata) as Record<string, string>
    
    
    
    const dataArray = Object.entries(data).filter(
        ([key]) => !key.startsWith('$')
    )
      
    const resData = Object.fromEntries(dataArray)
    
    if (!(await verifyTypes(resData))) {
        error = true
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
        message.push('E-mail inválido')
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

    if (error) {
        return {
            message: message,
            emptyFields: emptyFields,
            values: [resData]
        }
    }

    return {
        message: ['Sucesso'],
        values: [resData]
    }
}

//console