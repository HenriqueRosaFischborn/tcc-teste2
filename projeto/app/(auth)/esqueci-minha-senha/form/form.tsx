'use client'

import Logo from "@/components/ui/logo"
import Form from "next/form"
import { useSearchParams } from "next/navigation"
import { useState } from "react"
import sendEmailAction from "./action"

/**
 * Solicitação de redefinição de senha.
 *
 * O envio depende do clique em "Enviar" — antes a página disparava o e-mail só
 * de ser aberta (um GET com `?email=` bastava para inundar a caixa de alguém).
 *
 * A resposta é sempre a mesma frase, exista ou não a conta: é o que impede usar
 * esta tela para descobrir quem tem cadastro.
 */
export default function ResetPassword() {
    const params = useSearchParams()
    const emailInicial = (params.get('email') ?? '').replace(/"/g, '').trim()

    const [email, setEmail] = useState(emailInicial)
    const [enviado, setEnviado] = useState(false)
    const [enviando, setEnviando] = useState(false)

    async function enviar(formdata: FormData) {
        setEnviando(true)

        try {
            await sendEmailAction(String(formdata.get('email') ?? ''))
        } finally {
            setEnviando(false)
            setEnviado(true)
        }
    }

    return (
        <>
            <div id='login-content'>
                <Logo width='200' />
                <h1>Atualizar senha</h1>
                <p className='obs' style={{textAlign: 'center', fontSize: '11pt'}}>
                    Quem criou a conta pelo Google ainda não tem senha: este é o caminho para definir uma.
                </p>

                {enviado ? (
                    <div className='form'>
                        <div style={{width: '100%'}}>
                            <p style={{textAlign: 'center'}}>
                                <strong>Se este e-mail estiver cadastrado, enviaremos as instruções para redefinir a senha.</strong>
                            </p>
                            <p style={{textAlign: 'center'}} className='obs'>
                                Confira também a caixa de spam. O link vale por 30 minutos.
                            </p>
                            <p style={{textAlign: 'center'}} className='auth-alt'>
                                <a href="/entrar">Voltar para o login</a>
                            </p>
                        </div>
                    </div>
                ) : (
                    <Form action={enviar} className='form'>
                        <div style={{width: '100%'}}>
                            <label htmlFor="email">Email da conta:</label>
                            <input
                                id="email"
                                type="email"
                                name="email"
                                autoComplete="email"
                                required
                                value={email}
                                onChange={(e) => setEmail(e.currentTarget.value)}
                            />
                        </div>

                        <button type="submit" className='button red' disabled={enviando}>
                            {enviando ? 'Enviando...' : 'Enviar instruções'}
                        </button>

                        <p style={{textAlign: 'center'}} className='auth-alt'>
                            <a href="/entrar">Voltar para o login</a>
                        </p>
                    </Form>
                )}
            </div>
        </>
    )
}
