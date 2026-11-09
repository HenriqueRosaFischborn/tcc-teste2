export const runtime = 'nodejs'

import { Resend } from 'resend';
import ResetMessageEmail from '../../email-elements/reset-password';
import { render } from '@react-email/components';

const resend = new Resend(process.env.RESEND_API_KEY);

export async function sendEmail(email: string, token: string) {
  console.log(email)
  
  
  try {
    const html = await render(ResetMessageEmail({ email, token }))
    
    const { data, error } = await resend.emails.send({
      from: `CXA Clube de Xadrez Araranguá <resetpassword@testetcc.com.br>`,
      to: [email],
      subject: 'Redefinir senha',
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