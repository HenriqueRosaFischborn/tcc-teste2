export const runtime = 'nodejs'

import { Player } from '@/lib/types';
import { Resend } from 'resend';
import ConfirmedMessageEmail from '../../email-elements/confirmed-message';
import { render } from '@react-email/components';
import RequestedInscriptionEmail from '../../email-elements/requested-inscription';


const resend = new Resend(process.env.RESEND_API_KEY);

export async function sendRequestedMessageEmail(inscricao: Player, torneioTitle: string) {
  console.log('enviando email...')

  try {
    const html = await render(RequestedInscriptionEmail({ inscricao, torneioTitle }))

    const { data, error } = await resend.emails.send({
      from: 'CXA Clube de Xadrez Araranguá <confirmedmessage@testetcc.com.br>',
      to: [inscricao.usuario.email],
      subject: 'Inscrição solicitada',
      html: html
    });

    console.log('resultado resend', { data, error })

    if (error) {
      console.error('Erro retornado pelo Resend:', error)
      return { success: false, error }
    }

    return { success: true, data }
  } catch (error) {
    console.error('Erro ao montar/enviar email:', error)
    return { success: false, error }
  }
}