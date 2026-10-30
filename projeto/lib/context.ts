import { createContext } from "react";
import { Player, TournamentCategory, TournamentDivision } from "./types";

type TournamentContextType = {
  id: number;
  inscricao?: Player;
  /** Chave PIX do torneio (exibida para o jogador pagar a inscrição). */
  pixKey?: string | null;
  /** URL pública do QR Code PIX do torneio. */
  qrCodeUrl?: string | null;
  /** Categorias do torneio: permitem escolher a categoria sem consultar o servidor. */
  categories?: TournamentCategory[];
  /** Divisões do torneio (uma delas pode ser a absoluta). */
  divisions?: TournamentDivision[];
};

export const TournamentContext = createContext<TournamentContextType>({
  id: 0,
});
