import { Heading, Text, Section, Row, Column } from '@react-email/components';
import type { CSSProperties } from 'react';
import { Player } from '@/lib/types';
import { EmailLayout, cores, fontes } from './email-layout';

interface NewInscriptionEmailProps {
  inscricao: Player;
  torneioTitle: string;
}

// Mostra "—" quando o dado não foi preenchido (ex.: jogador sem ID FIDE)
const mostrar = (valor: unknown) =>
  valor === null || valor === undefined || valor === '' ? '—' : String(valor);

function Linha({ rotulo, valor }: { rotulo: string; valor: unknown }) {
  return (
    <Row style={linha}>
      <Column style={colunaRotulo}>{rotulo}</Column>
      <Column style={colunaValor}>{mostrar(valor)}</Column>
    </Row>
  );
}

function TituloSecao({ children }: { children: string }) {
  return (
    <>
      <Heading as="h2" style={tituloSecao}>
        {children}
      </Heading>
      <Section style={barraSecao}>&nbsp;</Section>
    </>
  );
}

export default function NewInscriptionEmail({
  inscricao,
  torneioTitle,
}: NewInscriptionEmailProps) {
  const dataNasc = new Date(inscricao.data_nasc).toLocaleDateString('pt-BR', {
    timeZone: 'UTC',
  });

  return (
    <EmailLayout
      preview={`Nova inscrição no torneio ${torneioTitle}`}
      titulo="Nova inscrição solicitada"
    >
      <Text style={paragrafo}>
        Uma nova inscrição foi realizada. Confira os dados abaixo.
      </Text>

      <Section style={cartaoTorneio}>
        <Text style={nomeTorneio}>{torneioTitle}</Text>
        <Text style={pilulaCategoria}>Categoria: {inscricao.categoria.name}</Text>
      </Section>

      <TituloSecao>Dados da inscrição</TituloSecao>
      <Section style={bloco}>
        <Linha rotulo="Nome" valor={inscricao.name} />
        <Linha rotulo="Data de nascimento" valor={dataNasc} />
        <Linha rotulo="Gênero" valor={inscricao.genre ? 'Masculino' : 'Feminino'} />
        <Linha rotulo="Cidade que representa" valor={inscricao.city} />
        <Linha rotulo="Clube que representa" valor={inscricao.club} />
        <Linha rotulo="ID FIDE" valor={inscricao.id_fide} />
        <Linha rotulo="ID CBX" valor={inscricao.id_cbx} />
        <Linha rotulo="Rating FIDE" valor={inscricao.rtg_fide} />
        <Linha rotulo="Rating CBX" valor={inscricao.rtg_cbx} />
      </Section>
    </EmailLayout>
  );
}

const paragrafo: CSSProperties = {
  margin: '0 0 24px',
  fontFamily: fontes.poppins,
  fontSize: 15,
  lineHeight: '25px',
  fontWeight: 500,
  color: cores.textoSuave,
};

const cartaoTorneio: CSSProperties = {
  margin: '0 0 32px',
  padding: '20px 22px',
  backgroundColor: cores.cartao,
  borderLeft: `5px solid ${cores.azul}`,
  borderRadius: 4,
};

const nomeTorneio: CSSProperties = {
  margin: '0 0 12px',
  fontFamily: fontes.poppins,
  fontSize: 19,
  lineHeight: '26px',
  fontWeight: 600,
  textTransform: 'uppercase',
  color: cores.preto,
};

const pilulaCategoria: CSSProperties = {
  display: 'inline-block',
  margin: 0,
  padding: '5px 14px',
  backgroundColor: cores.azul,
  borderRadius: 4,
  fontFamily: fontes.poppins,
  fontSize: 13,
  lineHeight: '20px',
  fontWeight: 500,
  color: cores.branco,
};

const tituloSecao: CSSProperties = {
  margin: '0 0 6px',
  fontFamily: fontes.poppins,
  fontSize: 18,
  lineHeight: '26px',
  fontWeight: 600,
  color: cores.preto,
};

const barraSecao: CSSProperties = {
  width: 40,
  height: 3,
  lineHeight: '3px',
  fontSize: 0,
  margin: '0 0 8px',
  backgroundColor: cores.vermelho,
};

const bloco: CSSProperties = {
  margin: '0 0 16px',
};

const linha: CSSProperties = {
  borderBottom: `1px solid ${cores.linha}`,
};

const colunaRotulo: CSSProperties = {
  width: '45%',
  padding: '11px 8px 11px 0',
  fontFamily: fontes.poppins,
  fontSize: 14,
  lineHeight: '21px',
  color: cores.textoSuave,
  verticalAlign: 'top',
};

const colunaValor: CSSProperties = {
  padding: '11px 0',
  fontFamily: fontes.poppins,
  fontSize: 14,
  lineHeight: '21px',
  fontWeight: 500,
  color: cores.preto,
  verticalAlign: 'top',
};
