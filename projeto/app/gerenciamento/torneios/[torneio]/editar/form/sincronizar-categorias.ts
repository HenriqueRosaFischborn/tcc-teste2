import type { Prisma } from '@/generated/prisma/client'

/**
 * Sincronização das categorias e divisões de um torneio **sem apagar as
 * inscrições**.
 *
 * O código anterior fazia `deleteMany` nas categorias e recriava tudo. Como
 * `incricao.uuid_cat` tem `onDelete: Cascade`, editar categorias apagava *todas*
 * as inscrições do torneio — o próprio formulário avisava o administrador disso
 * num `confirm()`.
 *
 * Aqui a regra é:
 *
 * 1. **validar antes de escrever**: toda categoria e divisão que tem inscrição
 *    precisa continuar existindo no formulário; se não continuar, a operação
 *    inteira é recusada com uma mensagem que diz o que está bloqueando;
 * 2. **atualizar em vez de recriar**: a categoria é identificada por
 *    (divisão + nome) e atualizada pelo `uuid` — que é justamente o valor
 *    referenciado por `incricao.uuid_cat`, então o vínculo sobrevive;
 * 3. **divisões** são identificadas pelo nome e atualizadas pelo `id`, então
 *    `incricao.id_division` também continua válido;
 * 4. só é apagado o que não tem inscrição nenhuma.
 *
 * Limitação conhecida: renomear uma categoria ou divisão que já tem inscrições
 * é indistinguível de excluí-la e criar outra, porque o formulário não envia o
 * `uuid`/`id` de volta. Nesse caso a edição é recusada — nunca apaga.
 */

export type CategoriaDoFormulario = {
    name: string
    value: string
    from: number
    to: number
    divisionFor?: string
}

export type DivisaoDoFormulario = {
    name: string
    isAbsolute: boolean
    genre: string
    categories?: CategoriaDoFormulario[]
}

export type ResultadoSincronizacao =
    | { ok: true, criadas: number, atualizadas: number, removidas: number }
    | { ok: false, motivo: string }

type Genero = 'masculino' | 'feminino' | 'ambos'

/** Mesma conversão do formulário; valor fora do padrão vira 0 em vez de NaN. */
function valorEmReais(valor: unknown): number {
    if (typeof valor !== 'string') {
        const numero = Number(valor)
        return Number.isFinite(numero) ? numero : 0
    }

    const numero = Number(valor.replace('R$', '').replace(/\./g, '').replace(',', '.').trim())

    return Number.isFinite(numero) ? numero : 0
}

function normalizarGenero(valor: unknown): Genero {
    if (typeof valor !== 'string') return 'ambos'

    const normalizado = valor === 'Masculino/Feminino' ? 'ambos' : valor.toLowerCase()

    if (normalizado === 'masculino' || normalizado === 'feminino' || normalizado === 'ambos') {
        return normalizado
    }

    return 'ambos'
}

/** Identidade de uma categoria dentro do torneio: divisão + nome. */
function chaveCategoria(divisao: string, nome: string) {
    return `${divisao}||${nome}`
}

export async function sincronizarCategorias(
    tx: Prisma.TransactionClient,
    idTorneio: bigint,
    divisoesPedidas: DivisaoDoFormulario[]
): Promise<ResultadoSincronizacao> {
    const categoriasAtuais = await tx.categoria.findMany({
        where: { id_torneio: idTorneio },
        include: {
            divisoes: { select: { name: true } },
            _count: { select: { incricao: true } }
        }
    })

    const divisoesAtuais = await tx.divisoes.findMany({
        where: { id_torneio: idTorneio },
        include: { _count: { select: { incricao: true } } }
    })

    const divisoesDesejadas = new Set(divisoesPedidas.map((divisao) => divisao.name))
    const categoriasDesejadas = new Set<string>()

    for (const divisao of divisoesPedidas) {
        for (const categoria of divisao.categories ?? []) {
            categoriasDesejadas.add(chaveCategoria(divisao.name, String(categoria.name)))
        }
    }

    // ---- Validação: nada é escrito antes disto passar ----
    const bloqueios: string[] = []

    for (const divisao of divisoesAtuais) {
        if (divisao._count.incricao > 0 && !divisoesDesejadas.has(divisao.name)) {
            bloqueios.push(
                `a divisão "${divisao.name}" (${divisao._count.incricao} inscrição(ões))`
            )
        }
    }

    for (const categoria of categoriasAtuais) {
        const chave = chaveCategoria(categoria.divisoes.name, categoria.name)

        if (categoria._count.incricao > 0 && !categoriasDesejadas.has(chave)) {
            bloqueios.push(
                `a categoria "${categoria.name}" da divisão "${categoria.divisoes.name}" (${categoria._count.incricao} inscrição(ões))`
            )
        }
    }

    if (bloqueios.length > 0) {
        return {
            ok: false,
            motivo: `Alterações não salvas: não é possível excluir ${bloqueios.join('; ')} porque há jogadores inscritos usando. Mova essas inscrições para outra categoria ou divisão antes de excluir.`
        }
    }

    // ---- Divisões: atualiza as existentes (id preservado) e cria as novas ----
    const divisaoPorNome = new Map(divisoesAtuais.map((divisao) => [divisao.name, divisao]))
    const idDaDivisao = new Map<string, bigint>()

    for (const divisao of divisoesPedidas) {
        const genero = normalizarGenero(divisao.genre)
        const isAbsolute = Boolean(divisao.isAbsolute)
        const atual = divisaoPorNome.get(divisao.name)

        if (atual) {
            await tx.divisoes.update({
                where: { id: atual.id },
                data: { isAbsolute, genre: genero }
            })

            idDaDivisao.set(divisao.name, atual.id)
            continue
        }

        const criada = await tx.divisoes.create({
            data: {
                name: divisao.name,
                id_torneio: idTorneio,
                isAbsolute,
                genre: genero
            }
        })

        idDaDivisao.set(divisao.name, criada.id)
    }

    // ---- Categorias: `update` preserva o `uuid` que a inscrição referencia ----
    const categoriaPorChave = new Map(
        categoriasAtuais.map((categoria) => [
            chaveCategoria(categoria.divisoes.name, categoria.name),
            categoria
        ])
    )

    let criadas = 0
    let atualizadas = 0

    for (const divisao of divisoesPedidas) {
        const idDivisao = idDaDivisao.get(divisao.name)

        if (!idDivisao) {
            // Inalcançável: toda divisão pedida foi criada ou atualizada acima.
            return { ok: false, motivo: `Divisão "${divisao.name}" não pôde ser resolvida.` }
        }

        for (const categoria of divisao.categories ?? []) {
            const dados = {
                name: String(categoria.name),
                value: valorEmReais(categoria.value),
                min_y: Number(categoria.from),
                max_y: Number(categoria.to),
                default_division: idDivisao
            }

            const atual = categoriaPorChave.get(
                chaveCategoria(divisao.name, String(categoria.name))
            )

            if (atual) {
                await tx.categoria.update({ where: { uuid: atual.uuid }, data: dados })
                atualizadas++
                continue
            }

            await tx.categoria.create({ data: { ...dados, id_torneio: idTorneio } })
            criadas++
        }
    }

    // ---- Remoções: só o que a validação garantiu não ter inscrição ----
    const uuidsSobrando = categoriasAtuais
        .filter((categoria) => !categoriasDesejadas.has(
            chaveCategoria(categoria.divisoes.name, categoria.name)
        ))
        .map((categoria) => categoria.uuid)

    if (uuidsSobrando.length > 0) {
        await tx.categoria.deleteMany({ where: { uuid: { in: uuidsSobrando } } })
    }

    const idsSobrando = divisoesAtuais
        .filter((divisao) => !divisoesDesejadas.has(divisao.name))
        .map((divisao) => divisao.id)

    if (idsSobrando.length > 0) {
        await tx.divisoes.deleteMany({ where: { id: { in: idsSobrando } } })
    }

    return {
        ok: true,
        criadas,
        atualizadas,
        removidas: uuidsSobrando.length + idsSobrando.length
    }
}
