'use client'

import Logo from "@/components/ui/logo"
import { useSearchParams } from "next/navigation"
import { useEffect, useState } from "react"
import sendEmailAction from "./action"


export default function ResetPassword() {
    const params = useSearchParams()
    const email = (params.get('email') ?? '').replace(/"/g, '').trim()

    const [emailError, setMailError] = useState(false)
    const [message, setMessage] = useState(false)

    useEffect(() => {
        // Sem email não há o que enviar; evita o disparo em dobro que o estado
        // anterior provocava a cada nova renderização.
        if (!email) {
            setMailError(true)
            setMessage(true)
            return
        }

        let active = true

        async function action() {
            const res = await sendEmailAction(email)

            if (active) {
                setMailError(!res)
                setMessage(true)
            }
        }

        action()

        return () => {
            active = false
        }
    }, [email])

    return (
        <>
            <div id='login-content'>
                <Logo width='200' />
                <h1>Atualizar senha</h1>
                <p className='obs' style={{textAlign: 'center', fontSize: '11pt'}}>
                    Quem criou a conta pelo Google ainda não tem senha: este é o caminho para definir uma.
                </p>
                <div className='form'>
                    <div style={{width: '100%'}}>
                        <p style={{textAlign: 'center'}} hidden={emailError || !message}>
                            <strong>Um email para redefinição de senha foi enviado para: </strong> <br />
                            <strong style={{color: 'var(--mainred)'}}>{email}</strong>
                        </p>
                        <p style={{textAlign: 'center'}} hidden={!emailError || !message}>
                            <strong>Email de usuário inválido</strong>
                        </p>

                        <p style={{textAlign: 'center'}} className='auth-alt' hidden={!message}>
                            <a href="/entrar">Voltar para o login</a>
                        </p>
                    </div>
                </div>
            </div>
        </>
    )
}
