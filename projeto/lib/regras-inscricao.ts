/**
 * Regras de elegibilidade da inscrição, compartilhadas pelo cadastro e pela
 * edição. Módulo puro: sem banco, sem `'use server'`, sem `server-only`.
 *
 * As regras reproduzem o que o sistema já faz em dois lugares:
 *
 * - `app/torneios-abertos/[torneio]/form/select-category.ts` (inscrição nova):
 *   1) categoria cuja faixa cobre o ano de nascimento; 2) senão a mais próxima
 *   abaixo; 3) senão a mais próxima acima; sempre filtrando pela divisão da
 *   categoria ser do gênero do jogador ou `ambos`.
 * - `app/minhas-inscricoes/.../search-cat.ts` (edição): mesmo encadeamento.
 *
 * Os dois divergem apenas no desempate **dentro** da faixa (um escolhe o
 * intervalo mais estreito, o outro a ordem do banco). Por isso a validação aqui
 * é por propriedade e não por igualdade de uuid: aceita qualquer categoria que
 * satisfaça a regra, recusando apenas o que está fora dela.
 */

export type GeneroJogador = 'masc' | 'fem'

export type CategoriaDoTorneio = {
    uuid: string
    name: string
    min_y: number
    max_y: number
    default_division: bigint
}

export type DivisaoDoTorneio = {
    id: bigint
    name: string
    genre: string
    isAbsolute: boolean
}

export type Resultado = { ok: true } | { ok: false, motivo: string }

const GENERO_DA_DIVISAO: Record<GeneroJogador, string> = {
    masc: 'masculino',
    fem: 'feminino'
}

export function normalizarGenero(valor: unknown): GeneroJogador | null {
    return valor === 'masc' || valor === 'fem' ? valor : null
}

/** A divisão aceita o gênero do jogador? (`ambos` aceita os dois.) */
export function divisaoAceitaGenero(divisao: DivisaoDoTorneio, genero: GeneroJogador) {
    return divisao.genre === 'ambos' || divisao.genre === GENERO_DA_DIVISAO[genero]
}

function divisaoDaCategoria(
    categoria: CategoriaDoTorneio,
    divisoes: DivisaoDoTorneio[]
): DivisaoDoTorneio | undefined {
    return divisoes.find((divisao) => divisao.id === categoria.default_division)
}

function ehElegivel(
    categoria: CategoriaDoTorneio,
    divisoes: DivisaoDoTorneio[],
    genero: GeneroJogador
): boolean {
    const divisao = divisaoDaCategoria(categoria, divisoes)

    return divisao ? divisaoAceitaGenero(divisao, genero) : false
}

/**
 * A categoria escolhida pode ser usada por este jogador?
 *
 * Além da faixa de anos e do gênero, respeita a regra de "categoria mais
 * próxima" que o sistema já aplica quando o ano do jogador não cai em nenhuma
 * faixa (ex.: adulto em torneio só de categorias de base).
 */
export function validarCategoria(params: {
    categorias: CategoriaDoTorneio[]
    divisoes: DivisaoDoTorneio[]
    uuidCategoria: string
    anoNascimento: number
    genero: GeneroJogador
}): Resultado {
    const { categorias, divisoes, uuidCategoria, anoNascimento, genero } = params

    const categoria = categorias.find((item) => item.uuid === uuidCategoria)

    if (!categoria) {
        return { ok: false, motivo: 'A categoria escolhida não pertence a este torneio. Recarregue a página e tente de novo.' }
    }

    if (!Number.isInteger(anoNascimento) || anoNascimento < 1900 || anoNascimento > new Date().getFullYear()) {
        return { ok: false, motivo: 'Data de nascimento inválida.' }
    }

    const divisao = divisaoDaCategoria(categoria, divisoes)

    if (!divisao) {
        return { ok: false, motivo: 'Esta categoria está sem divisão configurada. Procure a organização do torneio.' }
    }

    if (!divisaoAceitaGenero(divisao, genero)) {
        return {
            ok: false,
            motivo: `A categoria "${categoria.name}" não é do gênero selecionado.`
        }
    }

    // Dentro da faixa da própria categoria: aceita.
    if (categoria.min_y <= anoNascimento && categoria.max_y >= anoNascimento) {
        return { ok: true }
    }

    const elegiveis = categorias.filter((item) => ehElegivel(item, divisoes, genero))

    // Se alguma categoria elegível cobre o ano do jogador, ele não pode escolher
    // outra que não cubra.
    const algumaCobre = elegiveis.some(
        (item) => item.min_y <= anoNascimento && item.max_y >= anoNascimento
    )

    if (algumaCobre) {
        return {
            ok: false,
            motivo: `A categoria "${categoria.name}" não corresponde à idade informada.`
        }
    }

    // Fora de todas as faixas: vale a mais próxima, como o sistema já faz.
    const maisProximaAbaixo = [...elegiveis]
        .filter((item) => item.max_y < anoNascimento)
        .sort((a, b) => b.max_y - a.max_y)[0]

    const maisProximaAcima = [...elegiveis]
        .filter((item) => item.min_y > anoNascimento)
        .sort((a, b) => a.min_y - b.min_y)[0]

    const esperada = maisProximaAbaixo ?? maisProximaAcima

    if (!esperada || esperada.uuid !== categoria.uuid) {
        return {
            ok: false,
            motivo: `A categoria "${categoria.name}" não corresponde à idade informada.`
        }
    }

    return { ok: true }
}

/**
 * A divisão escolhida pode ser usada?
 *
 * Só duas são legítimas: a divisão padrão da categoria e a divisão absoluta do
 * torneio — é exatamente o que o formulário oferece.
 */
export function validarDivisao(params: {
    divisoes: DivisaoDoTorneio[]
    categoria: CategoriaDoTorneio
    idDivisao: bigint
    genero: GeneroJogador
}): Resultado {
    const { divisoes, categoria, idDivisao, genero } = params

    const divisao = divisoes.find((item) => item.id === idDivisao)

    if (!divisao) {
        return { ok: false, motivo: 'A divisão escolhida não pertence a este torneio.' }
    }

    const absoluta = divisoes.find((item) => item.isAbsolute)
    const ehPadrao = idDivisao === categoria.default_division
    const ehAbsoluta = absoluta !== undefined && absoluta.id === idDivisao

    if (!ehPadrao && !ehAbsoluta) {
        return {
            ok: false,
            motivo: 'A divisão escolhida não é a da categoria nem a divisão absoluta do torneio.'
        }
    }

    if (!divisaoAceitaGenero(divisao, genero)) {
        return { ok: false, motivo: `A divisão "${divisao.name}" não é do gênero selecionado.` }
    }

    return { ok: true }
}

/**
 * O torneio está aceitando inscrições?
 *
 * Usado **apenas** no cadastro de inscrição nova. A edição de uma inscrição
 * existente não é bloqueada pelo prazo: o jogador precisa continuar podendo
 * corrigir dados de uma inscrição já feita.
 */
export function validarTorneioAberto(
    torneio: { date_inscri: Date, inscri_closed_by_arbiter: boolean },
    agora: Date = new Date()
): Resultado {
    if (torneio.inscri_closed_by_arbiter) {
        return { ok: false, motivo: 'As inscrições deste torneio foram encerradas pelo árbitro.' }
    }

    if (torneio.date_inscri.getTime() < agora.getTime()) {
        return { ok: false, motivo: 'O prazo de inscrições deste torneio terminou.' }
    }

    return { ok: true }
}
