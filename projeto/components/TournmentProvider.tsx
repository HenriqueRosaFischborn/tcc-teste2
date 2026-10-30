'use client';

import { TournamentContext } from '@/lib/context';
import { Player, TournamentCategory, TournamentDivision } from '@/lib/types';

export default function TournamentProvider({
  children,
  id,
  inscricao,
  pixKey,
  qrCodeUrl,
  categories,
  divisions,
}: {
  children: React.ReactNode;
  id: number;
  inscricao?: Player;
  pixKey?: string | null;
  qrCodeUrl?: string | null;
  categories?: TournamentCategory[];
  divisions?: TournamentDivision[];
}) {
  return (
    <TournamentContext.Provider
      value={{ id, inscricao, pixKey, qrCodeUrl, categories, divisions }}
    >
      {children}
    </TournamentContext.Provider>
  );
}
