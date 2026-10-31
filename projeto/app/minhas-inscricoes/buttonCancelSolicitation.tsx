'use client'

import { requestCancellation } from './action'

/**
 * Pede ao servidor o envio da solicitação de cancelamento.
 *
 * Manda apenas o uuid da inscrição: o servidor confere a posse, busca os dados
 * no banco e monta o e-mail. Nada de dados pessoais vindo do navegador.
 */
export default function ButtonCancelSolicitation({ inscricaoUuid }: { inscricaoUuid: string }) {
    async function solicitar() {
        const confirmado = confirm(
            'Tem certeza que deseja solicitar cancelamento dessa inscrição? Um email será enviado ao árbitro deste torneio para que haja o seu cancelamento, depois de clicar em "ok" não é necessário solicitar novamente'
        )

        if (!confirmado) return

        try {
            const { ok, message } = await requestCancellation(inscricaoUuid)

            if (!ok) {
                alert(message ?? 'Não foi possível enviar a solicitação.')
                return
            }

            alert('Solicitação enviada')
        } catch {
            alert('Não foi possível enviar a solicitação agora. Tente novamente em instantes.')
        }
    }

    return (
        <>
            <button onClick={solicitar} className="button black">Solicitar cancelamento da inscrição</button>
        </>
    )
}
