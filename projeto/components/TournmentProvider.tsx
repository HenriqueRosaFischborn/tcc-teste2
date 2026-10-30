'use client';

import { TournamentContext } from '@/lib/context';
import { Player } from '@/lib/types';

export default function TournamentProvider({
  children,
  id,
  inscricao,
  pixKey,
  qrCodeUrl,
}: {
  children: React.ReactNode;
  id: number;
  inscricao?: Player;
  pixKey?: string | null;
  qrCodeUrl?: string | null;
}) {
  return (
    <TournamentContext.Provider value={{ id, inscricao, pixKey, qrCodeUrl }}>
      {children}
    </TournamentContext.Provider>
  );
}
