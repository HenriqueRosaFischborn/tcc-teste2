import { Heading, Text, Section, Row, Column } from '@react-email/components';
import type { CSSProperties } from 'react';
import { Player } from '@/lib/types';
import { EmailLayout, cores, fontes } from './email-layout';

interface UpdatedInscriptionEmailProps {
  inscricaoAntigas: Player;
  inscricaoNovas: Player;
  torneioTitle: string;
}

// Mostra "—" quando o dado não foi preenchido (ex.: jogador sem ID FIDE)
const mostrar = (valor: unknown) =>
  valor === null || valor === undefined || valor === '' ? '—' : String(valor);

function formatarData(data: string | Date) {
  return new Date(data).toLocaleDateString('pt-BR', { timeZone: 'UTC' });
}

interface Campo {
  rotulo: string;
  antes: unknown;
  depois: unknown;
}

function Linha({ rotulo, antes, depois }: Campo) {
  const mudou = String(antes ?? '') !== String(depois ?? '');

  return (
    <Row style={mudou ? linhaAlterada : linha}>
      <Column style={colunaRotulo}>{rotulo}</Column>
      <Column style={mudou ? colunaAntesAlterada : colunaValor}>
        {mostrar(antes)}
      </Column>
      <Column style={mudou ? colunaDepoisAlterada : colunaValor}>
        {mostrar(depois)}
      </Column>
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

export default function UpdatedInscriptionEmail({
  inscricaoAntigas,
  inscricaoNovas,
  torneioTitle,
}: UpdatedInscriptionEmailProps) {
  const campos: Campo[] = [
    { rotulo: 'Nome', antes: inscricaoAntigas.name, depois: inscricaoNovas.name },
    {
      rotulo: 'Data de nascimento',
      antes: formatarData(inscricaoAntigas.data_nasc),
      depois: formatarData(inscricaoNovas.data_nasc),
    },
    {
      rotulo: 'Gênero',
      antes: inscricaoAntigas.genre ? 'Masculino' : 'Feminino',
      depois: inscricaoNovas.genre ? 'Masculino' : 'Feminino',
    },
    { rotulo: 'Categoria', antes: inscricaoAntigas.categoria.name, depois: inscricaoNovas.categoria.name },
    { rotulo: 'Cidade que representa', antes: inscricaoAntigas.city, depois: inscricaoNovas.city },
    { rotulo: 'Clube que representa', antes: inscricaoAntigas.club, depois: inscricaoNovas.club },
    { rotulo: 'ID FIDE', antes: inscricaoAntigas.id_fide, depois: inscricaoNovas.id_fide },
    { rotulo: 'ID CBX', antes: inscricaoAntigas.id_cbx, depois: inscricaoNovas.id_cbx },
    { rotulo: 'Rating FIDE', antes: inscricaoAntigas.rtg_fide, depois: inscricaoNovas.rtg_fide },
    { rotulo: 'Rating CBX', antes: inscricaoAntigas.rtg_cbx, depois: inscricaoNovas.rtg_cbx },
  ];

  return (
    <EmailLayout
      preview={`Inscrição atualizada no torneio ${torneioTitle}`}
      titulo="Inscrição atualizada"
    >
      <Text style={paragrafo}>
        A inscrição abaixo foi atualizada. As linhas destacadas mostram os campos
        que mudaram.
      </Text>

      <Section style={cartaoTorneio}>
        <Text style={nomeTorneio}>{torneioTitle}</Text>
      </Section>

      <TituloSecao>Informações atualizadas:</TituloSecao>
      <Section style={bloco}>
        <Row style={linhaCabecalho}>
          <Column style={colunaRotuloCabecalho}>Campo</Column>
          <Column style={colunaValorCabecalho}>Antes</Column>
          <Column style={colunaValorCabecalho}>Depois</Column>
        </Row>
        {campos.map((campo) => (
          <Linha key={campo.rotulo} {...campo} />
        ))}
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
  margin: 0,
  fontFamily: fontes.poppins,
  fontSize: 19,
  lineHeight: '26px',
  fontWeight: 600,
  textTransform: 'uppercase',
  color: cores.preto,
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

const linhaCabecalho: CSSProperties = {
  borderBottom: `2px solid ${cores.preto}`,
};

const colunaRotuloCabecalho: CSSProperties = {
  width: '34%',
  padding: '0 8px 8px 0',
  fontFamily: fontes.poppins,
  fontSize: 12,
  lineHeight: '18px',
  fontWeight: 600,
  textTransform: 'uppercase',
  color: cores.textoSuave,
};

const colunaValorCabecalho: CSSProperties = {
  width: '33%',
  padding: '0 8px 8px',
  fontFamily: fontes.poppins,
  fontSize: 12,
  lineHeight: '18px',
  fontWeight: 600,
  textTransform: 'uppercase',
  color: cores.textoSuave,
};

const linha: CSSProperties = {
  borderBottom: `1px solid ${cores.linha}`,
};

const linhaAlterada: CSSProperties = {
  borderBottom: `1px solid ${cores.linha}`,
  backgroundColor: cores.cartao,
};

const colunaRotulo: CSSProperties = {
  width: '34%',
  padding: '10px 8px 10px 0',
  fontFamily: fontes.poppins,
  fontSize: 13,
  lineHeight: '20px',
  color: cores.textoSuave,
  verticalAlign: 'top',
};

const colunaValor: CSSProperties = {
  width: '33%',
  padding: '10px 8px',
  fontFamily: fontes.poppins,
  fontSize: 13,
  lineHeight: '20px',
  fontWeight: 500,
  color: cores.preto,
  verticalAlign: 'top',
};

const colunaAntesAlterada: CSSProperties = {
  ...colunaValor,
  color: cores.textoSuave,
  textDecoration: 'line-through',
};

const colunaDepoisAlterada: CSSProperties = {
  ...colunaValor,
  fontWeight: 600,
  color: cores.azul,
};
