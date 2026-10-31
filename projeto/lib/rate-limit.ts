/**
 * Limitador de taxa simples, em memória.
 *
 * Serve para conter abuso proporcional — por exemplo, um usuário disparando
 * vários e-mails em sequência para os organizadores de um torneio. Não é
 * proteção forte contra ataque distribuído: cada instância do servidor tem seu
 * próprio mapa, e o contador zera quando a instância é reciclada. Em serverless
 * isso significa limite por instância, não global.
 *
 * Se um dia isso precisar valer de verdade entre instâncias, trocar por uma
 * tabela no banco ou por um serviço de cache compartilhado.
 */

type Tentativas = {
    contagem: number
    expiraEm: number
}

const tentativas = new Map<string, Tentativas>()

/**
 * Registra uma tentativa para `chave` e diz se ela é permitida.
 *
 * A primeira tentativa dentro da janela sempre passa; a partir daí, só até
 * `limite` tentativas a cada `janelaMs`.
 */
export function allowAttempt(chave: string, limite: number, janelaMs: number): boolean {
    const agora = Date.now()
    const atual = tentativas.get(chave)

    if (!atual || atual.expiraEm <= agora) {
        tentativas.set(chave, { contagem: 1, expiraEm: agora + janelaMs })
        return true
    }

    if (atual.contagem >= limite) {
        return false
    }

    atual.contagem += 1
    return true
}

/** Zera a contagem de uma chave. Usado principalmente em testes. */
export function resetAttempts(chave: string) {
    tentativas.delete(chave)
}
