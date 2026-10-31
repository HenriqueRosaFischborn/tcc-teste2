'use server'

import { requireAdmin } from "@/lib/auth-guard"
import { Player } from "@/lib/types"
import type { Prisma } from "@/generated/prisma/client"
import db from "@/lib/db"
import { sendConfirmedMessageEmail } from "@/app/api/email/confirmed-inscription/send"
import { sendCancelledMessageEmail } from "@/app/api/email/canceled-inscription/send"

/**
 * Campos que a tela de análise de jogadores deixa o administrador alterar.
 *
 * Esta lista é a fronteira de segurança da action: o que não estiver aqui nunca
 * chega ao Prisma, mesmo que o payload traga a chave. Ficam de fora, de
 * propósito, `uuid` (chave primária), `id_usuario` (dono da inscrição) e
 * `id_torneio` (torneio da inscrição) — nenhum é editável na interface, e
 * escrevê-los moveria a inscrição de dono ou de torneio.
 *
 * `id_division` e `uuid_cat` são relacionamentos e continuam permitidos porque
 * são exatamente os dois selects da tabela (divisão e categoria).
 */
const CAMPOS_EDITAVEIS = [
    'status',
    'name',
    'city',
    'club',
    'federation',
    'titulo',
    'id_fide',
    'id_cbx',
    'rtg_fide',
    'rtg_cbx',
    'data_nasc',
    'genre',
    'id_division',
    'uuid_cat'
] as const

type CampoEditavel = typeof CAMPOS_EDITAVEIS[number]

const STATUS_VALIDOS = ['Pendente', 'Confirmada', 'Recusada'] as const

const MAX_NOME = 120
const MAX_CIDADE = 100
const MAX_CLUBE = 100
const MAX_FEDERACAO = 10
const MAX_TITULO = 30
/** Bem acima de qualquer ID FIDE/CBX ou rating real; serve de teto contra abuso. */
const MAX_NUMERO = 1_000_000_000_000

const FORMATO_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

type Falha = { ok: false, motivo: string }
type Validado<T> = { ok: true, valor: T } | Falha

/**
 * Uma inscrição que vai ser gravada.
 *
 * `categoria` e `divisao` repetem valores que já estão em `dados`, sem cast, para
 * a validação de vínculo (que precisa saber de qual torneio a linha é) não ter
 * de destrinchar o DTO do Prisma de volta.
 *
 * `divisao: null` significa "limpar a divisão" — é válido e não precisa de
 * checagem de vínculo. Ausente significa "não mexeu".
 */
type Alteracao = {
    uuid: string
    dados: Prisma.incricaoUncheckedUpdateInput
    categoria?: string
    divisao?: number | null
}

/**
 * BigInt não atravessa JSON e `null` precisa continuar `null` — o template usa
 * `—` para campo não preenchido, e `Number(null)` viraria `0`.
 *
 * Mesma ideia da função de `getInformations.ts`, mas tipada com `unknown` em vez
 * de `any`; a unificação das duas está prevista na T39.
 */
function convertBigIntToNumber(valor: unknown): unknown {
    if (typeof valor === 'bigint') {
        return Number(valor)
    }

    if (valor instanceof Date) {
        return valor
    }

    if (Array.isArray(valor)) {
        return valor.map(convertBigIntToNumber)
    }

    if (valor && typeof valor === 'object') {
        return Object.fromEntries(
            Object.entries(valor).map(([chave, conteudo]) => [chave, convertBigIntToNumber(conteudo)])
        )
    }

    return valor
}

/* ------------------------------------------------------------------ *
 * Validação de valores — executada no servidor, campo por campo
 * ------------------------------------------------------------------ */

function ehObjetoPlano(valor: unknown): valor is Record<string, unknown> {
    return !!valor && typeof valor === 'object' && !Array.isArray(valor)
}

function texto(valor: unknown, campo: string, maximo: number, exigeConteudo: boolean): Validado<string> {
    if (typeof valor !== 'string') {
        return { ok: false, motivo: `${campo}: precisa ser texto` }
    }

    if (valor.length > maximo) {
        return { ok: false, motivo: `${campo}: passa de ${maximo} caracteres` }
    }

    if (exigeConteudo && valor.trim() === '') {
        return { ok: false, motivo: `${campo}: não pode ficar vazio` }
    }

    return { ok: true, valor }
}

function textoOuNulo(valor: unknown, campo: string, maximo: number): Validado<string | null> {
    if (valor === null) {
        return { ok: true, valor: null }
    }

    return texto(valor, campo, maximo, false)
}

function inteiroOuNulo(valor: unknown, campo: string): Validado<number | null> {
    if (valor === null) {
        return { ok: true, valor: null }
    }

    if (typeof valor !== 'number' || !Number.isInteger(valor) || valor < 0 || valor > MAX_NUMERO) {
        return { ok: false, motivo: `${campo}: precisa ser inteiro entre 0 e ${MAX_NUMERO}` }
    }

    return { ok: true, valor }
}

function dataNascimento(valor: unknown): Validado<Date> {
    if (typeof valor !== 'string' && typeof valor !== 'number') {
        return { ok: false, motivo: 'data_nasc: formato não reconhecido' }
    }

    const data = new Date(valor)

    if (Number.isNaN(data.getTime())) {
        return { ok: false, motivo: 'data_nasc: data inválida' }
    }

    // Antes de 1900 ou no futuro não é data de nascimento de jogador.
    if (data.getUTCFullYear() < 1900 || data.getTime() > Date.now()) {
        return { ok: false, motivo: 'data_nasc: fora do intervalo aceito' }
    }

    return { ok: true, valor: data }
}

function categoriaUuid(valor: unknown): Validado<string> {
    if (typeof valor !== 'string' || !FORMATO_UUID.test(valor)) {
        return { ok: false, motivo: 'uuid_cat: não é um UUID' }
    }

    return { ok: true, valor }
}

/* ------------------------------------------------------------------ *
 * Montagem do objeto de escrita
 * ------------------------------------------------------------------ */

/**
 * Monta o `data` do UPDATE a partir dos campos permitidos.
 *
 * Só as chaves de `CAMPOS_EDITAVEIS` são consideradas — o resto do payload é
 * ignorado, não importa o que venha. Cada valor passa por validação de tipo e de
 * faixa antes de entrar no objeto.
 *
 * O tipo `Prisma.incricaoUncheckedUpdateInput` aqui é só o formato do DTO: ele
 * **não** valida nada em runtime. Quem barra valor inválido é o código acima.
 * Não existe cast — o objeto é construído campo a campo, já no tipo esperado.
 *
 * Devolve falha (e nada é gravado) se qualquer campo alterado tiver valor
 * inválido: gravar metade de uma edição seria pior do que recusá-la.
 */
function montarDados(
    atual: Record<string, unknown>,
    anterior: Record<string, unknown>
): { ok: true, dados: Prisma.incricaoUncheckedUpdateInput, categoria?: string, divisao?: number | null } | Falha {
    const dados: Prisma.incricaoUncheckedUpdateInput = {}

    // Repetidos fora de `dados` para a validação de vínculo, sem cast.
    let categoria: string | undefined
    let divisao: number | null | undefined

    /** Só entram na conta os campos que o cliente realmente mudou. */
    const mudou = (campo: CampoEditavel) => {
        const antes = anterior[campo]
        const agora = atual[campo]

        return ehObjetoPlano(antes) || Array.isArray(antes)
            ? JSON.stringify(antes) !== JSON.stringify(agora)
            : antes !== agora
    }

    if (mudou('status')) {
        const status = STATUS_VALIDOS.find((permitido) => permitido === atual.status)

        if (!status) {
            return { ok: false, motivo: 'status: fora dos valores permitidos' }
        }

        dados.status = status
    }

    if (mudou('name')) {
        const r = texto(atual.name, 'name', MAX_NOME, true)
        if (!r.ok) return r
        dados.name = r.valor
    }

    if (mudou('city')) {
        const r = texto(atual.city, 'city', MAX_CIDADE, false)
        if (!r.ok) return r
        dados.city = r.valor
    }

    if (mudou('club')) {
        const r = textoOuNulo(atual.club, 'club', MAX_CLUBE)
        if (!r.ok) return r
        dados.club = r.valor
    }

    if (mudou('federation')) {
        const r = texto(atual.federation, 'federation', MAX_FEDERACAO, false)
        if (!r.ok) return r
        dados.federation = r.valor
    }

    if (mudou('titulo')) {
        const r = textoOuNulo(atual.titulo, 'titulo', MAX_TITULO)
        if (!r.ok) return r
        dados.titulo = r.valor
    }

    if (mudou('id_fide')) {
        const r = inteiroOuNulo(atual.id_fide, 'id_fide')
        if (!r.ok) return r
        dados.id_fide = r.valor
    }

    if (mudou('id_cbx')) {
        const r = inteiroOuNulo(atual.id_cbx, 'id_cbx')
        if (!r.ok) return r
        dados.id_cbx = r.valor
    }

    if (mudou('rtg_fide')) {
        const r = inteiroOuNulo(atual.rtg_fide, 'rtg_fide')
        if (!r.ok) return r
        dados.rtg_fide = r.valor
    }

    if (mudou('rtg_cbx')) {
        const r = inteiroOuNulo(atual.rtg_cbx, 'rtg_cbx')
        if (!r.ok) return r
        dados.rtg_cbx = r.valor
    }

    if (mudou('data_nasc')) {
        const r = dataNascimento(atual.data_nasc)
        if (!r.ok) return r
        dados.data_nasc = r.valor
    }

    if (mudou('genre')) {
        if (typeof atual.genre !== 'boolean') {
            return { ok: false, motivo: 'genre: precisa ser booleano' }
        }

        dados.genre = atual.genre
    }

    if (mudou('id_division')) {
        const r = inteiroOuNulo(atual.id_division, 'id_division')
        if (!r.ok) return r
        dados.id_division = r.valor
        divisao = r.valor
    }

    if (mudou('uuid_cat')) {
        const r = categoriaUuid(atual.uuid_cat)
        if (!r.ok) return r
        dados.uuid_cat = r.valor
        categoria = r.valor
    }

    // Rede de segurança para quem editar esta função depois: se algum campo for
    // atribuído a `dados` sem estar em `CAMPOS_EDITAVEIS`, a gravação é recusada
    // em vez de abrir uma coluna nova sem revisão.
    const foraDaLista = Object.keys(dados).find(
        (campo) => !CAMPOS_EDITAVEIS.includes(campo as CampoEditavel)
    )

    if (foraDaLista) {
        return { ok: false, motivo: `${foraDaLista}: campo não permitido` }
    }

    return { ok: true, dados, categoria, divisao }
}

class VinculoInvalidoError extends Error {}

/**
 * Confere que a categoria e a divisão escolhidas pertencem ao torneio da
 * inscrição.
 *
 * `montarDados` garante o formato (`uuid_cat` é UUID, `id_division` é inteiro),
 * mas nenhum dos dois sabe de qual torneio a linha é. Sem esta checagem, um
 * payload poderia apontar uma inscrição do torneio A para uma categoria do
 * torneio B: a FK só exige que a categoria exista, não que seja do mesmo
 * torneio.
 *
 * Roda **dentro** da transação e com o mesmo client (`tx`): conferir fora dela
 * abriria uma janela entre a leitura e a escrita. Divergência vira exceção, que
 * reverte a transação inteira.
 */
async function validarVinculos(tx: Prisma.TransactionClient, alteracoes: Alteracao[]) {
    const comCategoria = alteracoes.filter((alteracao) => typeof alteracao.categoria === 'string')
    // `divisao === null` é limpar o campo: válido e sem vínculo a conferir.
    const comDivisao = alteracoes.filter((alteracao) => typeof alteracao.divisao === 'number')

    if (comCategoria.length === 0 && comDivisao.length === 0) {
        return
    }

    const uuids = [...new Set([...comCategoria, ...comDivisao].map((alteracao) => alteracao.uuid))]

    const inscricoes = await tx.incricao.findMany({
        where: { uuid: { in: uuids } },
        select: { uuid: true, id_torneio: true }
    })

    const torneioDaInscricao = new Map(inscricoes.map((inscricao) => [inscricao.uuid, inscricao.id_torneio]))

    for (const uuid of uuids) {
        if (!torneioDaInscricao.has(uuid)) {
            throw new VinculoInvalidoError(`inscrição ${uuid} não encontrada`)
        }
    }

    if (comCategoria.length > 0) {
        const uuidsCategoria = [...new Set(comCategoria.map((alteracao) => alteracao.categoria as string))]

        const categorias = await tx.categoria.findMany({
            where: { uuid: { in: uuidsCategoria } },
            select: { uuid: true, id_torneio: true }
        })

        const torneioDaCategoria = new Map(categorias.map((categoria) => [categoria.uuid, categoria.id_torneio]))

        for (const alteracao of comCategoria) {
            const categoria = alteracao.categoria as string
            const torneio = torneioDaCategoria.get(categoria)

            if (torneio === undefined) {
                throw new VinculoInvalidoError(`categoria ${categoria} não existe`)
            }

            if (torneio !== torneioDaInscricao.get(alteracao.uuid)) {
                throw new VinculoInvalidoError(
                    `categoria ${categoria} não pertence ao torneio da inscrição ${alteracao.uuid}`
                )
            }
        }
    }

    if (comDivisao.length > 0) {
        const ids = [...new Set(comDivisao.map((alteracao) => alteracao.divisao as number))]

        const divisoes = await tx.divisoes.findMany({
            where: { id: { in: ids.map((id) => BigInt(id)) } },
            select: { id: true, id_torneio: true }
        })

        const torneioDaDivisao = new Map(divisoes.map((divisao) => [divisao.id.toString(), divisao.id_torneio]))

        for (const alteracao of comDivisao) {
            const divisao = alteracao.divisao as number
            const torneio = torneioDaDivisao.get(String(divisao))

            if (torneio === undefined) {
                throw new VinculoInvalidoError(`divisão ${divisao} não existe`)
            }

            if (torneio !== torneioDaInscricao.get(alteracao.uuid)) {
                throw new VinculoInvalidoError(
                    `divisão ${divisao} não pertence ao torneio da inscrição ${alteracao.uuid}`
                )
            }
        }
    }
}

/**
 * Relê a inscrição **do banco** para montar o e-mail de status.
 *
 * O destinatário e o conteúdo não podem vir do que o navegador enviou: o
 * formulário manda um JSON com a inscrição inteira, e um payload adulterado
 * escolheria para quem o clube manda e-mail. Aqui a fonte é a linha recém-gravada.
 */
async function inscricaoParaEmail(uuid: string): Promise<{ inscricao: Player, torneio: string } | null> {
    const registro = await db.incricao.findUnique({
        where: { uuid },
        include: {
            categoria: {
                select: {
                    name: true,
                    uuid: true,
                    id_torneio: true
                }
            },
            divisoes: {
                select: {
                    name: true,
                    id: true
                }
            },
            usuario: {
                select: {
                    id: true,
                    email: true
                }
            },
            torneio: {
                select: {
                    title: true
                }
            }
        }
    })

    if (!registro) {
        return null
    }

    const { torneio, ...dados } = registro

    return {
        inscricao: convertBigIntToNumber(dados) as Player,
        torneio: torneio.title
    }
}

export default async function updateDataBase(prev: {message: string}, formdata: FormData) {
    // Grava campos de inscrições a partir do que o cliente envia: sem
    // administrador, o erro é lançado e nada é escrito.
    await requireAdmin()

    let defaultIncri: unknown
    let nowIncri: unknown

    try {
        defaultIncri = JSON.parse(String(formdata.get('defaultInscri')))
        nowIncri = JSON.parse(String(formdata.get('nowInscri')))
    } catch {
        return { message: 'Erro' }
    }

    if (!ehObjetoPlano(nowIncri) || !ehObjetoPlano(defaultIncri)) {
        return { message: 'Erro' }
    }

    const alteracoes: Alteracao[] = []

    // Quem mudou de status e vai precisar de e-mail. O envio acontece só depois
    // da gravação, para não avisar o jogador de algo que não foi salvo.
    const mudaramDeStatus = new Set<string>()

    for (const uuid of Object.keys(nowIncri)) {
        const atual = nowIncri[uuid]
        const anterior = ehObjetoPlano(defaultIncri[uuid]) ? defaultIncri[uuid] as Record<string, unknown> : {}

        if (!FORMATO_UUID.test(uuid) || !ehObjetoPlano(atual)) {
            console.error('updateDataBase: inscrição malformada no payload', { uuid })
            return { message: 'Erro' }
        }

        const resultado = montarDados(atual, anterior)

        if (!resultado.ok) {
            console.error('updateDataBase: valor recusado', { uuid, motivo: resultado.motivo })
            return { message: 'Erro' }
        }

        // Só campos editáveis podem produzir diferença; se nada sobrou, não há o
        // que gravar (antes era feito um UPDATE vazio).
        if (Object.keys(resultado.dados).length === 0) {
            continue
        }

        alteracoes.push({ uuid, dados: resultado.dados, categoria: resultado.categoria, divisao: resultado.divisao })

        const novoStatus = resultado.dados.status

        if (novoStatus === 'Confirmada' || novoStatus === 'Recusada') {
            mudaramDeStatus.add(uuid)
        }
    }

    // Nada mudou: resposta normal, sem abrir transação.
    if (alteracoes.length === 0) {
        return { message: 'Alterações salvas' }
    }

    // Uma transação para tudo: ou todas as inscrições são gravadas, ou nenhuma.
    //
    // Isso corrige o problema que a T08 só havia atenuado. Antes, uma falha na
    // terceira gravação deixava as duas primeiras commitadas e a action
    // respondia "Erro" — e, como o retorno acontecia antes dos e-mails, nenhum
    // jogador era avisado, inclusive os que já estavam confirmados no banco.
    //
    // É transação interativa (callback) e não a de array porque a validação de
    // vínculo precisa ler antes de decidir. Isolation level padrão (read
    // committed): Serializable exigiria tratar P2034 com retry, e o conflito
    // real aqui é improvável — a leitura e a escrita ficam na mesma transação.
    try {
        await db.$transaction(async (tx) => {
            await validarVinculos(tx, alteracoes)

            for (const alteracao of alteracoes) {
                await tx.incricao.update({
                    where: {
                        uuid: alteracao.uuid
                    },
                    data: alteracao.dados
                })
            }
        })
    } catch (error) {
        if (error instanceof VinculoInvalidoError) {
            console.error('updateDataBase: vínculo recusado', { motivo: error.message })
        } else {
            console.error('Erro ao gravar alterações de inscrição (transação revertida):', error)
        }

        return { message: 'Erro' }
    }

    // Só depois do commit: o e-mail descreve o que está no banco agora.
    for (const uuid of mudaramDeStatus) {
        const dados = await inscricaoParaEmail(uuid)

        if (!dados) {
            continue
        }

        if (dados.inscricao.status === 'Confirmada') {
            await sendConfirmedMessageEmail(dados.inscricao, dados.torneio)
        } else {
            await sendCancelledMessageEmail(dados.inscricao, dados.torneio)
        }
    }

    return { message: 'Alterações salvas' }
}
