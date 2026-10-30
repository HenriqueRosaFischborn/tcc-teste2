import { createContext } from "react";
import { Player } from "./types";

type TournamentContextType = {
  id: number;
  inscricao?: Player;
  /** Chave PIX do torneio (exibida para o jogador pagar a inscrição). */
  pixKey?: string | null;
  /** URL pública do QR Code PIX do torneio. */
  qrCodeUrl?: string | null;
};

export const TournamentContext = createContext<TournamentContextType>({
  id: 0,
});
