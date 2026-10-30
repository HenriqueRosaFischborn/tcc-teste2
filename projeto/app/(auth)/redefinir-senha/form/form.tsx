'use client'

import Logo from "@/components/ui/logo"
import Form from "next/form"
import { useSearchParams } from "next/navigation"
import { useActionState, useEffect } from "react"
import resetPasswordAction from "./action"
import { FormState } from "@/lib/types"


export default function ResetPassword() {
    const initialValue: FormState = {}
    const [state, formAction] = useActionState(resetPasswordAction, initialValue)


    const params = useSearchParams()

    const email = params.get('email') ?? ''
    const token = params.get('token') ?? ''

    const success = Boolean(state.message && typeof state.message[0] == 'string' && state.message[0] === 'Sucesso')

    useEffect(() => {
        if (success) {
            window.location.href = '/entrar'
        }
    }, [success])

    return (
        <>
            <div id='login-content'>
                <Logo width='200' />
                <h1>Redefinir senha</h1>
                <Form action={formAction} className='form'>
                    <input type="hidden" name="email" value={email} readOnly/>
                    <input type="hidden" name="token" value={token} readOnly/>

                    <div style={{width: '100%'}}>
                        <p><strong>Email:</strong></p>
                        <p style={{color: 'var(--mainred)'}}><strong>{email}</strong></p>
                    </div>

                    <div style={{width: '100%'}} >
                        <label htmlFor="password">Nova Senha:</label>
                        <input id="password" type="password" name='password' autoComplete="new-password" defaultValue={state.values && state.values[0] ? state.values[0].password : ''}/>
                        {state.emptyFields?.includes('password') ? (<p className="error">*Este campo é obrigatório</p>) : ('')}
                    </div>

                    <div style={{alignItems: 'center', width: '100%', justifyContent: 'center'}}>
                        <button type="submit" style={{textAlign: 'center'}} className='button red'>Atualizar senha</button>
                        {(state.message?.includes('Erro desconhecido') || state.emptyFields?.includes('email')) ? (<p className="error">*Redefinição não permitida</p>) : ('')}
                    </div>
                </Form>
            </div>
        </>
    )
}
