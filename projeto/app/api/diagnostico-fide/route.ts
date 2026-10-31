import { NextResponse } from 'next/server'
import { verifyFideId } from '@/app/torneios-abertos/[torneio]/form/verify-player'

export const dynamic = 'force-dynamic'

/**
 * Diagnóstico da consulta à FIDE feita PELO SERVIDOR onde o sistema está rodando.
 *
 * Existe porque a falha só aparece hospedada: no localhost a consulta sai de um
 * IP residencial e a FIDE responde; na Vercel ela sai de um IP de nuvem que a
 * FIDE não atende. Sem isso, a única pista era o log da Vercel.
 *
 * Abra `/api/diagnostico-fide?id=44731736` na versão publicada e compare:
 *  - `resultado.status: "found"` → a consulta funciona dali;
 *  - `"unavailable"` + `motivo` → é o que a inscrição também está recebendo;
 *  - `proxyConfigurado: false` → falta definir `FIDE_PROXY` no projeto.
 *
 * Pode apagar esta rota depois do ajuste: ela não faz parte do sistema.
 */
export async function GET(request: Request) {
  const id = new URL(request.url).searchParams.get('id') ?? '44731736'

  if (!/^\d{4,9}$/.test(id)) {
    return NextResponse.json(
      { erro: 'Informe um ID FIDE numérico, por exemplo ?id=44731736' },
      { status: 400 }
    )
  }

  const inicio = Date.now()
  const resultado = await verifyFideId(id)

  return NextResponse.json(
    {
      onde: process.env.VERCEL
        ? `Vercel (região ${process.env.VERCEL_REGION ?? 'não informada'})`
        : 'servidor local',
      // A URL do proxy não é devolvida: ela carrega a chave da API.
      proxyConfigurado: Boolean(process.env.FIDE_PROXY?.trim()),
      duracaoMs: Date.now() - inicio,
      resultado,
    },
    { headers: { 'cache-control': 'no-store' } }
  )
}
