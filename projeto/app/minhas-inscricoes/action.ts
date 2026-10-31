'use server'

import { sendCancelSolicitation } from "@/app/api/email/cancel-solicitation/send"
import { requireUser, UnauthorizedError, type SessionUser } from "@/lib/auth-guard"
import db from "@/lib/db"
import { allowAttempt } from "@/lib/rate-limit"
import type { Player } from "@/lib/types"

export type CancelSolicitationResult = {
    ok: boolean
    message?: string
}

/** Quantas solicitações o mesmo jogador pode disparar dentro da janela. */
const LIMITE_SOLICITACOES = 3
const JANELA_MS = 10 * 60 * 1000

/**
 * Envia ao árbitro a solicitação de cancelamento de uma inscrição.
 *
 * A única coisa que vem do navegador é o uuid da inscrição. Destinatários,
 * dados pessoais e conteúdo do e-mail são lidos do banco depois de confirmado
 * que a inscrição pertence a quem está chamando — nada do que o cliente envia
 * entra no e-mail.
 *
 * Continua sem alterar o status da inscrição: o cancelamento é manual, feito
 * pelo árbitro. Essa é a regra de negócio atual e ela não mudou aqui.
 */
export async function requestCancellation(inscricaoUuid: string): Promise<CancelSolicitationResult> {
    let user: SessionUser

    try {
        user = await requireUser()
    } catch (error) {
        if (error instanceof UnauthorizedError) {
            return {
                ok: false,
                message: 'Sessão expirada. Entre novamente para solicitar o cancelamento.'
            }
        }

        throw error
    }

    if (typeof inscricaoUuid !== 'string' || inscricaoUuid.trim() === '') {
        return { ok: false, message: 'Inscrição inválida.' }
    }

    // A posse participa da consulta: um uuid de outra pessoa não devolve linha.
    const inscricao = await db.incricao.findFirst({
        where: {
            uuid: inscricaoUuid,
            id_usuario: user.id
        },
        include: {
            categoria: {
                select: {
                    name: true,
                    uuid: true,
                    id_torneio: true,
                    min_y: true
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
                    id: true,
                    title: true
                }
            }
        }
    })

    if (!inscricao) {
        return { ok: false, message: 'Inscrição não encontrada.' }
    }

    // Conta só as solicitações que passaram pela checagem de posse.
    if (!allowAttempt(`cancelamento:${user.id}`, LIMITE_SOLICITACOES, JANELA_MS)) {
        return {
            ok: false,
            message: 'Você já solicitou o cancelamento há pouco tempo. Aguarde alguns minutos antes de tentar de novo.'
        }
    }

    const player: Player = {
        uuid: inscricao.uuid,
        city: inscricao.city,
        club: inscricao.club ?? '',
        genre: inscricao.genre,
        data_nasc: inscricao.data_nasc,
        id_fide: Number(inscricao.id_fide ?? 0),
        id_cbx: Number(inscricao.id_cbx ?? 0),
        uuid_cat: inscricao.uuid_cat,
        status: inscricao.status,
        id_usuario: inscricao.id_usuario,
        name: inscricao.name,
        id_division: Number(inscricao.id_division ?? 0),
        id_torneio: Number(inscricao.id_torneio),
        rtg_fide: Number(inscricao.rtg_fide ?? 0),
        rtg_cbx: Number(inscricao.rtg_cbx ?? 0),
        federation: inscricao.federation ?? undefined,
        titulo: inscricao.titulo ?? undefined,
        categoria: {
            name: inscricao.categoria.name,
            uuid: inscricao.categoria.uuid,
            id_torneio: Number(inscricao.categoria.id_torneio),
            min_y: inscricao.categoria.min_y ?? undefined
        },
        divisoes: {
            name: inscricao.divisoes ? inscricao.divisoes.name : '',
            id: inscricao.divisoes ? Number(inscricao.divisoes.id) : 0
        },
        usuario: {
            id: inscricao.usuario.id,
            email: inscricao.usuario.email
        }
    }

    const resultado = await sendCancelSolicitation(
        player,
        inscricao.torneio.title,
        Number(inscricao.torneio.id)
    )

    if (!resultado.success) {
        return {
            ok: false,
            message: 'Não foi possível enviar a solicitação agora. Tente novamente em instantes.'
        }
    }

    return { ok: true }
}
