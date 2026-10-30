import {
  Html,
  Head,
  Preview,
  Body,
  Container,
  Section,
  Row,
  Column,
  Img,
  Link,
  Text,
  Heading,
} from '@react-email/components';
import type { CSSProperties, ReactNode } from 'react';

export const NOME_CLUBE = 'Clube de Xadrez de Araranguá';

// URL pública do site, sem barra no final (ex.: https://cxararangua.com.br).
// Precisa ser uma URL acessível na internet para a logo e os links funcionarem no email.
export const SITE_URL = (process.env.NEXT_PUBLIC_APP_URL ?? '').replace(/\/$/, '');

// Coloque o arquivo da logo em /public/logo.png
export const LOGO_URL = `${SITE_URL}/logo.png`;

// Substitua este bloco pelo seu LINKS já corrigido
export const LINKS = {
  inicio: `${SITE_URL}/`,
  nossaHistoria: `${SITE_URL}/nossa-historia`,
  torneiosAbertos: `${SITE_URL}/torneios`,
  historicoEventos: `${SITE_URL}/historico`,
  entrar: `${SITE_URL}/login`,
  minhasInscricoes: `${SITE_URL}/minhas-inscricoes`,
  instagram: 'https://instagram.com/cxararangua',
  threads: 'https://www.threads.net/@cxararangua',
  facebook: 'https://facebook.com/cxararangua',
  email: 'mailto:frankbeckerassessoria@gmail.com'
};

export const cores = {
  azul: '#046d9e',
  vermelho: '#f61717',
  preto: '#000000',
  branco: '#ffffff',
  fundo: '#eef1f4',
  cartao: '#f3f8fb',
  textoSuave: '#4b5157',
  linha: '#e1e6ea',
  rodapeTexto: '#c4cbd1',
  rodapeSuave: '#8b949b',
};

export const fontes = {
  poppins: 'Poppins, "Segoe UI", Arial, sans-serif',
};

interface EmailLayoutProps {
  /** Texto de pré-visualização exibido ao lado do assunto na caixa de entrada */
  preview: string;
  /** Título exibido na faixa preta, abaixo do cabeçalho */
  titulo: string;
  children: ReactNode;
}

export function EmailLayout({ preview, titulo, children }: EmailLayoutProps) {
  return (
    <Html lang="pt-BR">
      <Head>
        <link
          href="https://fonts.googleapis.com/css2?family=Poppins:wght@400;500;600;700&display=swap"
          rel="stylesheet"
        />
      </Head>
      <Preview>{preview}</Preview>
      <Body style={body}>
        <Container style={container}>
          {/* Cabeçalho azul com a logo */}
          <Section style={cabecalho}>
            <Row>
              <Column style={colunaLogoCabecalho}>
                <Link href={LINKS.inicio}>
                  <Img
                    src={LOGO_URL}
                    width="38"
                    alt={NOME_CLUBE}
                    style={{ display: 'block' }}
                  />
                </Link>
              </Column>
              <Column style={{ verticalAlign: 'middle' }}>
                <Text style={nomeClube}>{NOME_CLUBE}</Text>
              </Column>
            </Row>
          </Section>

          {/* Faixa preta com o título, como o hero do site */}
          <Section style={hero}>
            <Heading as="h1" style={tituloHero}>
              {titulo}
            </Heading>
          </Section>
          <Row style={{ width: '100%' }}>
            <Column style={{ ...faixa, width: '64%', backgroundColor: cores.azul }}>
              &nbsp;
            </Column>
            <Column style={{ ...faixa, width: '36%', backgroundColor: cores.vermelho }}>
              &nbsp;
            </Column>
          </Row>

          {/* Conteúdo de cada email */}
          <Section style={conteudo}>{children}</Section>

          {/* Rodapé preto */}
          <Section style={rodape}>
            <Row>
              <Column style={colunaLogoRodape}>
                <Img src={LOGO_URL} width="64" alt={NOME_CLUBE} style={{ display: 'block' }} />
              </Column>
              <Column style={colunaLinks}>
                <Link href={LINKS.nossaHistoria} style={linkRodape}>
                  Nossa História
                </Link>
                <Link href={LINKS.torneiosAbertos} style={linkRodape}>
                  Torneios Abertos
                </Link>
                <Link href={LINKS.historicoEventos} style={linkRodape}>
                  Histórico de Eventos
                </Link>
                <Link href={LINKS.entrar} style={linkRodape}>
                  Entrar
                </Link>
              </Column>
              <Column style={colunaLinks}>
                <Link href={LINKS.instagram} style={linkRodape}>
                  Instagram @cxararangua
                </Link>
                <Link href={LINKS.email} style={linkRodape}>
                  Email frankbeckerassessoria@gmail.com
                </Link>
              </Column>
            </Row>
            <Text style={copyright}>
              © Clube de Xadrez Araranguá, {new Date().getFullYear()}. Todos os direitos
              reservados.
            </Text>
            <Text style={avisoAutomatico}>
              Esta é uma mensagem automática enviada pelo sistema de inscrições.
            </Text>
          </Section>
        </Container>
      </Body>
    </Html>
  );
}

const body: CSSProperties = {
  margin: 0,
  padding: '24px 12px',
  backgroundColor: cores.fundo,
  fontFamily: fontes.poppins,
  color: cores.preto,
};

const container: CSSProperties = {
  width: '100%',
  maxWidth: 600,
  margin: '0 auto',
  backgroundColor: cores.branco,
  borderRadius: 6,
  overflow: 'hidden',
};

const cabecalho: CSSProperties = {
  backgroundColor: cores.azul,
  padding: '11px 20px',
};

const colunaLogoCabecalho: CSSProperties = {
  width: 60,
  verticalAlign: 'middle',
};

const nomeClube: CSSProperties = {
  margin: 0,
  fontFamily: fontes.poppins,
  fontSize: 20,
  lineHeight: '32px',
  fontWeight: 400,
  color: cores.branco,
};

const hero: CSSProperties = {
  backgroundColor: cores.preto,
  padding: '15px 24px',
  textAlign: 'center',
};

const tituloHero: CSSProperties = {
  margin: 0,
  fontFamily: fontes.poppins,
  fontSize: 28,
  lineHeight: '36px',
  fontWeight: 400,
  color: cores.branco,
};

const faixa: CSSProperties = {
  height: 5,
  lineHeight: '5px',
  fontSize: 0,
};

const conteudo: CSSProperties = {
  padding: '32px 32px 16px',
};

const rodape: CSSProperties = {
  backgroundColor: cores.preto,
  padding: '28px 32px 24px',
};

const colunaLogoRodape: CSSProperties = {
  width: 84,
  verticalAlign: 'top',
};

const colunaLinks: CSSProperties = {
  verticalAlign: 'top',
  paddingRight: 8,
};

const linkRodape: CSSProperties = {
  display: 'block',
  margin: '0 0 8px',
  fontFamily: fontes.poppins,
  fontSize: 13,
  lineHeight: '20px',
  color: cores.rodapeTexto,
  textDecoration: 'none',
};

const copyright: CSSProperties = {
  margin: '20px 0 0',
  fontFamily: fontes.poppins,
  fontSize: 12,
  lineHeight: '18px',
  textAlign: 'center',
  color: cores.rodapeSuave,
};

const avisoAutomatico: CSSProperties = {
  margin: '4px 0 0',
  fontFamily: fontes.poppins,
  fontSize: 11,
  lineHeight: '16px',
  textAlign: 'center',
  color: cores.rodapeSuave,
};
