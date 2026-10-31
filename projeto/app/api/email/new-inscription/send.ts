// Módulo interno de envio — NÃO é Server Action.
//
// O `'use server'` foi removido de propósito: com ele, este export virava um
// endpoint POST público capaz de disparar e-mail para os organizadores do
// torneio com dados escolhidos por quem chamasse.
//
// Quem dispara é `submitInscription`, que já é uma Server Action e monta os
// dados a partir do banco. Só deve ser importado por código de servidor.

import db from '@/lib/db';
import { Player } from '@/lib/types';
import { Resend } from 'resend';
import CancelSolicitationEmail from '../../email-elements/cancel-solicitation';
import { render } from '@react-email/components';
import NewInscriptionEmail from '../../email-elements/new-inscription';

const resend = new Resend(process.env.RESEND_API_KEY);

export async function sendNewInscription(inscricao: Player, torneioTitle: string, torneioID: number) {
    console.log('enviando email...')

    const emailsData = await db.emails.findMany({
      where: {
        id_torneio: torneioID
      },
      select: {
        email: true
      }
    })

    const emails = emailsData.map(el => el.email)
    
    const html = await render(NewInscriptionEmail({ inscricao, torneioTitle }))
    
    try {
    const { data, error } = await resend.emails.send({
      from: `CXA - Clube de Xadrez de Araranguá <newinscription@testetcc.com.br>`,
      to: emails,
      subject: 'Nova inscrição solicitada',
      html: html
    });

    console.log('resultado resend')
    console.log({ data, error })

    if (error) {
        console.log('Erro no email', error)
        return { success: false, error }
    }

    return { success: true, data }
  } catch (error) {
    return { success: false, error }
  }
}