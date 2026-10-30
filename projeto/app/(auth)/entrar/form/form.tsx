'use client'

import { FormState } from "@/lib/types"
import Form from "next/form"
import { useActionState, useEffect, useState } from "react"
import loginAction from "./action"
import verifyEmailForgotPassword from "./verify-forgot-password"
import { useSearchParams } from "next/navigation"

/**
 * Mensagens para os erros que o Auth.js devolve na URL quando o login com o
 * Google não chega ao fim (por exemplo, quando o usuário cancela).
 */
const oauthErrors: Record<string, string> = {
    AccessDenied: '*O acesso pelo Google foi cancelado. Tente novamente.',
    OAuthAccountNotLinked: '*Este email já está cadastrado de outra forma. Entre com sua senha.',
    OAuthCallbackError: '*Não foi possível concluir o login com o Google. Tente novamente.',
    OAuthSignInError: '*Não foi possível iniciar o login com o Google. Tente novamente.',
    Configuration: '*O login com o Google não está configurado corretamente. Avise o administrador.',
    Verification: '*Não foi possível verificar o email da conta. Tente novamente.',
}

export default function LoginForm() {
    const initialState: FormState = {}
    const [state, formAction] = useActionState(loginAction, initialState)
    const [emailError, setEmailError] = useState('')


    const params = useSearchParams()
    const urlBack = params.get('urlBack')

    const errorCode = params.get('error')
    const oauthError = errorCode
        ? oauthErrors[errorCode] ?? '*Não foi possível concluir o login. Tente novamente.'
        : ''

    useEffect(() => {
        if (state.message && typeof state.message[0] == 'string' && state.message[0] === 'Sucesso') {

            if (urlBack) {
                window.location.href = urlBack
            } else {
                window.location.href = '/'
            }

        }

        if (state.emptyFields?.includes('email')) {
            setEmailError('*Este campo é obrigatório')
        } else if (state.message?.includes('Email inválido')) {
            setEmailError('*Email inválido')
        } else if (state.message?.includes('Senha ou usuário incorretos')) {
            setEmailError('*Senha ou usuário incorretos')
        }
    }, [state])




    async function forgotPassword() {
        const emailInput = document.querySelector('#email')

        if (emailInput instanceof HTMLInputElement) {


            const email = emailInput.value.trim()



            const verify = await verifyEmailForgotPassword(email)

            if (verify) {
                setEmailError('*Este não é um email válido ou de usuário existente')
            } else {
                setEmailError('')
                window.location.href = `/esqueci-minha-senha?email=${encodeURIComponent(email)}`
            }
        }
    }

    return (
        <>
            <Form action={formAction} className='form' style={{justifyContent: 'center'}}>
                {oauthError && (
                    <p className='error' style={{width: '100%', textAlign: 'center'}}>{oauthError}</p>
                )}

                <div style={{width: '100%'}} >
                    <label htmlFor="email">Email:</label>
                    <input id="email" type="email" name='email' autoComplete="email" inputMode="email" defaultValue={state.values && state.values[0] ? state.values[0].email : ''}/>
                    {emailError && <p className="error">{emailError}</p>}
                </div>

                <div style={{width: '100%'}} >
                    <label htmlFor="password">Senha:</label>
                    <input id="password" type="password" name='password' autoComplete="current-password" defaultValue={state.values && state.values[0] ? state.values[0].password : ''}/>
                    {state.emptyFields?.includes('password') ? (<p className="error">*Este campo é obrigatório</p>) : ('')}
                    {(!state.emptyFields?.includes('password') && state.message?.includes('Senha ou usuário incorretos')) ? (<p className="error">*Senha ou usuário incorretos</p>) : ('')}
                    <button style={{textAlign: 'start', cursor: 'pointer'}} id='forgot-my-password' onClick={() => forgotPassword()} type="button">Esqueci minha senha</button>
                </div>

                <div style={{alignItems: 'center', width: '100%'}}>
                    <button style={{textAlign: 'center'}} className='button red'>Entrar</button>
                </div>
            </Form>
        </>
    )
}
