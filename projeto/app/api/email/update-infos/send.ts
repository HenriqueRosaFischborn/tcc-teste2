export const runtime = 'nodejs'

import { Resend } from 'resend';
import ResetMessageEmail from '../../email-elements/reset-password';
import { render } from '@react-email/components';
import { Player } from '@/lib/types';
import UpdatedInscriptionEmail from '../../email-elements/updated-inscription';
import db from '@/lib/db';

const resend = new Resend(process.env.RESEND_API_KEY);

export async function sendUpdateInscriptionEmail(inscricaoAntigas: Player, inscricaoNovas: Player, torneioTitle: string, torneioID: number) {
  
  
  
  try {
    const html = await render(UpdatedInscriptionEmail({ inscricaoAntigas, inscricaoNovas, torneioTitle }))

    const emailsData = await db.emails.findMany({
      where: {
        id_torneio: torneioID
      },
      select: {
        email: true
      }
    })

    const emails = emailsData.map(el => el.email)
    
    const { data, error } = await resend.emails.send({
      from: `CXA Clube de Xadrez Araranguá <updateinscription@testetcc.com.br>`,
      to: emails,
      subject: 'As informações de uma inscrição foram atualizadas',
      html: html
    });

    if (error) {
      return Response.json({ error }, { status: 500 });
    }

    return Response.json(data);
  } catch (error) {
    return Response.json({ error }, { status: 500 });
  }
}