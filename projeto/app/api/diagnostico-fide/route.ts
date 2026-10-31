import { NextResponse } from 'next/server'
import { verifyCbxId, verifyFideId } from '@/app/torneios-abertos/[torneio]/form/verify-player'
import type { LookupResult } from '@/app/torneios-abertos/[torneio]/form/types'

export const dynamic = 'force-dynamic'

/**
 * Diagnóstico das consultas oficiais feitas PELO SERVIDOR onde o sistema roda.
 *
 * Existe porque as falhas só aparecem hospedadas. Sem isso, a única pista era o
 * log da Vercel. Abra na versão publicada:
 *
 *   /api/diagnostico-fide?id=2108356            → só a FIDE
 *   /api/diagnostico-fide?id=2108356&cbx=25108  → FIDE e CBX
 *
 * `status: "found"` significa que aquela consulta funciona dali; `"unavailable"`
 * vem com o `motivo` exato, que é o mesmo que a inscrição está recebendo.
 *
 * Pode apagar esta rota depois do ajuste: ela não faz parte do sistema.
 */
async function medir(consultar: () => Promise<LookupResult>) {
  const inicio = Date.now()
  const resultado = await consultar()

  return { ...resultado, duracaoMs: Date.now() - inicio }
}

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams
  const idFide = params.get('id') ?? '2108356'
  const idCbx = params.get('cbx')

  if (!/^\d{4,9}$/.test(idFide)) {
    return NextResponse.json(
      { erro: 'Informe um ID FIDE numérico, por exemplo ?id=2108356' },
      { status: 400 }
    )
  }

  if (idCbx !== null && !/^\d{1,9}$/.test(idCbx)) {
    return NextResponse.json({ erro: 'O parâmetro ?cbx= precisa ser numérico' }, { status: 400 })
  }

  const [fide, cbx] = await Promise.all([
    medir(() => verifyFideId(idFide)),
    idCbx === null ? null : medir(() => verifyCbxId(idCbx)),
  ])

  return NextResponse.json(
    {
      onde: process.env.VERCEL
        ? `Vercel (região ${process.env.VERCEL_REGION ?? 'não informada'})`
        : 'servidor local',
      // A URL do proxy não é devolvida: ela carrega a chave da API.
      proxyConfigurado: Boolean(process.env.FIDE_PROXY?.trim()),
      resultado: fide,
      ...(cbx === null ? {} : { cbx }),
    },
    { headers: { 'cache-control': 'no-store' } }
  )
}
