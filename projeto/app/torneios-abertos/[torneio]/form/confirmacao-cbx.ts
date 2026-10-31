import type { OfficialPlayer } from './types'

/**
 * Conferência do ID FIDE pelo cadastro da CBX.
 *
 * A FIDE recusa ou demora requisições vindas de IP de datacenter (é o caso da
 * Vercel) e, sem essa alternativa, o jogador fica sem conseguir se inscrever
 * enquanto o site oficial não responder. O perfil da CBX informa o ID FIDE do
 * jogador, então ele serve de confirmação oficial do número digitado.
 */
export type ConfirmacaoCbx =
  | { ok: true; player: OfficialPlayer }
  | { ok: false; motivo: string }

export function confirmarIdFidePelaCbx(
  idFide: string,
  jogadorCbx: OfficialPlayer
): ConfirmacaoCbx {
  const idNoCadastro = jogadorCbx.idFide?.trim() ?? ''

  if (idNoCadastro === '') {
    return { ok: false, motivo: 'O cadastro da CBX não informa ID FIDE.' }
  }

  if (idNoCadastro !== idFide.trim()) {
    return { ok: false, motivo: `O cadastro da CBX informa o ID FIDE ${idNoCadastro}.` }
  }

  // Sem a FIDE não há como confirmar gênero, federação e ratings: ficam nulos e
  // o árbitro completa na análise — o mesmo que já acontece quando o site está
  // fora do ar no momento do envio.
  return {
    ok: true,
    player: {
      name: jogadorCbx.name,
      bornYear: jogadorCbx.bornYear,
      genre: null,
      title: null,
      federation: null,
      idFide: idNoCadastro,
      ratings: { standard: null, rapid: null, blitz: null },
    },
  }
}
