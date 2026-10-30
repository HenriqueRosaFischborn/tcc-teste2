import { Text, Section, Button, Link } from '@react-email/components';
import type { CSSProperties } from 'react';
import { EmailLayout, SITE_URL, cores, fontes } from './email-layout';

interface ResetMessageEmailProps {
  email: string;
  token: string;
}

export default function ResetMessageEmail({ email, token }: ResetMessageEmailProps) {
  const link = `${SITE_URL}/redefinir-senha?token=${encodeURIComponent(
    token,
  )}&email=${encodeURIComponent(email)}`;

  return (
    <EmailLayout
      preview="Recebemos sua solicitação para redefinir a senha"
      titulo="Redefinir senha"
    >
      <Text style={paragrafo}>Olá,</Text>
      <Text style={paragrafo}>
        Recebemos a solicitação para redefinir a senha da sua conta no Clube de
        Xadrez de Araranguá. Para escolher uma nova senha, clique no botão abaixo.
      </Text>

      <Section style={areaBotao}>
        <Button href={link} style={botao}>
          Redefinir senha
        </Button>
      </Section>

      <Section style={cartaoLink}>
        <Text style={textoCartao}>
          Se o botão não funcionar, copie e cole este endereço no seu navegador:
        </Text>
        <Link href={link} style={linkLongo}>
          {link}
        </Link>
      </Section>

      <Text style={aviso}>
        Se você não solicitou a redefinição, ignore este email. Sua senha continua a
        mesma e nenhuma alteração será feita.
      </Text>
    </EmailLayout>
  );
}

const paragrafo: CSSProperties = {
  margin: '0 0 16px',
  fontFamily: fontes.poppins,
  fontSize: 15,
  fontWeight: 500,
  lineHeight: '25px',
  color: cores.textoSuave,
};

const areaBotao: CSSProperties = {
  margin: '24px 0 28px',
  textAlign: 'center',
};

const botao: CSSProperties = {
  display: 'inline-block',
  padding: '13px 32px',
  backgroundColor: cores.azul,
  borderRadius: 4,
  fontFamily: fontes.poppins,
  fontSize: 15,
  lineHeight: '22px',
  fontWeight: 600,
  color: cores.branco,
  textDecoration: 'none',
};

const cartaoLink: CSSProperties = {
  margin: '0 0 24px',
  padding: '16px 20px',
  backgroundColor: cores.cartao,
  borderLeft: `5px solid ${cores.azul}`,
  borderRadius: 4,
};

const textoCartao: CSSProperties = {
  margin: '0 0 8px',
  fontFamily: fontes.poppins,
  fontWeight: 500,
  fontSize: 13,
  lineHeight: '20px',
  color: cores.textoSuave,
};

const linkLongo: CSSProperties = {
  fontFamily: fontes.poppins,
  fontSize: 12,
  lineHeight: '18px',
  color: cores.azul,
  wordBreak: 'break-all',
};

const aviso: CSSProperties = {
  margin: '0 0 16px',
  fontFamily: fontes.poppins,
  fontSize: 13,
  lineHeight: '21px',
  color: cores.textoSuave,
};
