'use client'

import Form from "next/form"

import registerAction from "./action"
import { FormState } from "@/lib/types"
import { useActionState, useEffect, useState } from "react"


export default function RegisterForm() {
    const initialState: FormState = {}
    const [state, formAction] = useActionState(registerAction, initialState)
    const [emailError, setEmailError] = useState<string>()

    useEffect(() => {
        if (state.message && typeof state.message[0] == 'string' && state.message[0] === 'Sucesso') {
            window.location.href = '/'
        }

        if (state.emptyFields?.includes('email')) {
            setEmailError('*Este campo é obrigatório')
        } else if (state.message?.includes('Email inválido')) {
            setEmailError('*Email inválido')
        } else if (state.message?.includes('Este email já existe')) {
            setEmailError('*Este email já está cadastrado. Entre com a senha ou pelo Google.')
        }
    }, [state])

    return(
        <>
            <Form action={formAction} className='form' style={{justifyContent: 'center'}}>
                <div style={{width: '100%'}} >
                    <label htmlFor="email">Email:</label>
                    <input id="email" type="email" name='email' autoComplete="email" inputMode="email" defaultValue={state.values && state.values[0] ? state.values[0].email : ''}/>
                    {emailError && <p className="error">{emailError}</p>}


                </div>

                <div style={{width: '100%'}}>
                    <label htmlFor="password">Senha:</label>
                    <input id="password" type="password" name='password' autoComplete="new-password" defaultValue={state.values && state.values[0] ? state.values[0].password : ''}/>
                    {state.emptyFields?.includes('password') ? (<p className="error">*Este campo é obrigatório</p>) : ('')}
                </div>

                <div style={{alignItems: 'center', width: '100%'}}>
                    <button style={{textAlign: 'center'}} className='button red' type="submit">Cadastrar</button>
                </div>
            </Form>


        </>
    )
}
