import type { LookupResult } from './types'

const currencyFormatter = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
})

export const formatCurrency = (value: number) => currencyFormatter.format(value)

/** Enter nos campos de texto apenas confirma o preenchimento (sai do campo), sem enviar o formulário. */
export function handleEnterBlur(event: React.KeyboardEvent<HTMLInputElement>) {
  if (event.key === 'Enter') {
    event.preventDefault()
    event.currentTarget.blur()
  }
}

/**
 * Prazo do lado do navegador. O servidor já desiste em 8 s, mas se a função na
 * Vercel for encerrada no meio da resposta a requisição nunca termina e o
 * formulário fica carregando para sempre. Este limite garante que o jogador
 * sempre recebe ou os dados ou um aviso.
 */
const PRAZO_NO_NAVEGADOR_MS = 20000

/**
 * Chama a consulta oficial com um teto de tempo. A consulta do servidor não é
 * cancelada (não há como abortar uma server action), mas a tela deixa de
 * esperar por ela.
 */
export async function consultarComPrazo(
  id: string,
  consultar: (id: string) => Promise<LookupResult>
): Promise<LookupResult> {
  let timer: ReturnType<typeof setTimeout> | undefined

  const prazo = new Promise<LookupResult>((resolve) => {
    timer = setTimeout(
      () => resolve({ status: 'unavailable', motivo: 'a consulta demorou demais' }),
      PRAZO_NO_NAVEGADOR_MS
    )
  })

  try {
    return await Promise.race([consultar(id), prazo])
  } finally {
    clearTimeout(timer)
  }
}
