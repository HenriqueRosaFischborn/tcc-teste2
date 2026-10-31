/**
 * Verificação de inscrição duplicada por **identidade do jogador**.
 *
 * Regra do sistema: **uma mesma conta pode inscrever vários jogadores**, inclusive
 * no mesmo torneio. O que não pode existir é o mesmo jogador duas vezes no mesmo
 * torneio — e "mesmo jogador" é definido pelo ID FIDE ou pelo ID CBX, nunca pelo
 * nome nem pela conta.
 *
 * Jogador sem nenhum dos dois IDs nunca é bloqueado: comparar por nome barraria
 * homônimos e erraria em grafias diferentes.
 *
 * Não existe `@@unique` no banco (decisão do dono: a conta pode ter várias
 * inscrições, então a chave não pode ser `[id_usuario, id_torneio]`). Sem uma
 * restrição de banco, duas requisições simultâneas do mesmo jogador podem passar
 * as duas pela checagem — risco residual conhecido.
 */
import db from './db'

export type IdentidadeJogador = {
    idFide: number | null
    idCbx: number | null
}

export type InscricaoDuplicada = {
    uuid: string
    name: string
}

/** Converte um campo de ID em inteiro positivo, ou `null` quando vazio/inválido. */
export function idNumerico(valor: unknown): number | null {
    if (typeof valor !== 'string' || valor.trim() === '') return null

    const numero = Number(valor)

    return Number.isInteger(numero) && numero > 0 ? numero : null
}

export async function buscarInscricaoDuplicada(params: {
    idTorneio: bigint
    identidade: IdentidadeJogador
    /** Inscrição em edição — ela não pode ser comparada com si mesma. */
    ignorarUuid?: string
}): Promise<InscricaoDuplicada | null> {
    const { idTorneio, identidade, ignorarUuid } = params

    const mesmasPessoas: ({ id_fide: number } | { id_cbx: number })[] = []

    if (identidade.idFide !== null) {
        mesmasPessoas.push({ id_fide: identidade.idFide })
    }

    if (identidade.idCbx !== null) {
        mesmasPessoas.push({ id_cbx: identidade.idCbx })
    }

    // Sem nenhum identificador não há como afirmar que é a mesma pessoa.
    if (mesmasPessoas.length === 0) {
        return null
    }

    const encontrada = await db.incricao.findFirst({
        where: {
            id_torneio: idTorneio,
            OR: mesmasPessoas,
            ...(ignorarUuid ? { uuid: { not: ignorarUuid } } : {})
        },
        select: { uuid: true, name: true }
    })

    return encontrada ?? null
}
