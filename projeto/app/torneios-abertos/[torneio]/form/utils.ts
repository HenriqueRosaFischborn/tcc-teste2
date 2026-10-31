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
 * Traduz a falha de transporte em algo que o jogador consiga resolver.
 *
 * O caso mais comum na versão publicada não é o site oficial cair: é a aba do
 * navegador ter sido aberta antes do último deploy. O Next.js chama a server
 * action por um hash que muda a cada build, então a página velha pede uma ação
 * que não existe mais e recebe "Server Action ... was not found on the server".
 * Recarregar resolve — e é isso que o aviso precisa dizer, em vez do texto
 * técnico do framework.
 */
export function motivoDaFalha(error: unknown): string {
  const mensagem = error instanceof Error ? error.message : String(error)

  if (/server action/i.test(mensagem) || /not found on the server/i.test(mensagem)) {
    return 'página desatualizada — recarregue com Ctrl+Shift+R'
  }

  return mensagem.slice(0, 120) || 'falha ao chamar o servidor'
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
