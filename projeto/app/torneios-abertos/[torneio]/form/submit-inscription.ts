'use server'

import { sendNewInscription } from '@/app/api/email/new-inscription/send'
import { sendRequestedMessageEmail } from '@/app/api/email/inscription-solicited/send'
import { auth } from '@/auth'
import classifyTime from '@/lib/classifyTime'
import db from '@/lib/db'
import {
  normalizarGenero,
  validarCategoria,
  validarDivisao,
  validarTorneioAberto
} from '@/lib/regras-inscricao'
import { validarComprovante } from '@/lib/comprovante'
import { buscarInscricaoDuplicada } from '@/lib/inscricao-duplicada'
import { getSupabaseAdmin } from '@/lib/supabase'
import type { Player } from '@/lib/types'
import { verifyCbxId, verifyFideId } from './verify-player'
import type { InscriptionState, LookupResult, OfficialPlayer } from './types'

const BIRTH_DATE_PATTERN = /^(\d{2})\/(\d{2})\/(\d{4})$/

const GENERIC_ERROR = 'Não foi possível concluir a inscrição. Tente novamente.'

/** Converte um campo do formulário em número inteiro (ou null quando vazio/inválido). */
function toInteger(value: FormDataEntryValue | null): number | null {
  if (typeof value !== 'string' || value.trim() === '') return null

  const parsed = Number(value)

  return Number.isInteger(parsed) ? parsed : null
}

function toText(value: FormDataEntryValue | null): string {
  return typeof value === 'string' ? value.trim() : ''
}

/**
 * Busca o jogador nas bases oficiais.
 *
 * Devolve `null` tanto para "não existe" quanto para "site fora do ar" — nos
 * dois casos a inscrição segue com o nome digitado, em vez de ser bloqueada.
 */
async function buscarJogadorOficial(
  verificar: (id: string) => Promise<LookupResult>,
  id: number | null
): Promise<OfficialPlayer | null> {
  if (id === null) return null

  const resultado = await verificar(String(id))

  return resultado.status === 'found' ? resultado.player : null
}

/**
 * Aqui o dado oficial só enriquece o cadastro (nome, rating, federação) e o
 * árbitro completa o que faltar, então vale desistir cedo em vez de segurar o
 * jogador na tela de envio esperando um site oficial que não vai responder.
 */
const PRAZO_CONSULTA_NO_ENVIO_MS = 5000

async function uploadReceipt(file: File, tournamentId: bigint, userId: number, inscriptionUuid: string): Promise<boolean> {
  const path = `comprovantes/${tournamentId}/${userId}/${inscriptionUuid}`

  try {
    const supabaseAdmin = await getSupabaseAdmin()
    const { error } = await supabaseAdmin.storage
      .from('publics')
      .upload(path, file, { upsert: true, contentType: file.type })

    if (error) {
      console.error('Falha ao enviar o comprovante:', error)
      return false
    }

    return true
  } catch (error) {
    console.error('Falha ao enviar o comprovante:', error)
    return false
  }
}

export async function submitInscription(
  _previousState: InscriptionState,
  formData: FormData
): Promise<InscriptionState> {
  const hasIds = formData.get('hasFide') === 'true'
  const name = toText(formData.get('name'))
  const city = toText(formData.get('city'))
  const club = toText(formData.get('club')) || toText(formData.get('team'))
  const birthDate = BIRTH_DATE_PATTERN.exec(toText(formData.get('borndate')))
  const genre = toText(formData.get('genre'))
  const categoryUuid = toText(formData.get('uuidCat'))

  // A cidade é obrigatória no banco (`incricao.city`) e vai nos emails e na
  // exportação para o ChessResults; o clube é opcional.
  if (!name || !city || !birthDate || !categoryUuid || (genre !== 'masc' && genre !== 'fem')) {
    return { status: 'error', message: 'Preencha todos os campos obrigatórios (*).' }
  }

  const genero = normalizarGenero(genre)

  if (!genero) return { status: 'error', message: 'Preencha todos os campos obrigatórios (*).' }

  const [, dia, mes, ano] = birthDate

  const category = await db.categoria.findFirst({
    where: { uuid: categoryUuid },
    include: {
      torneio: {
        select: {
          title: true,
          date_inscri: true,
          inscri_closed_by_arbiter: true,
          tempo_torneio_time_digitalTotempo: { select: { time: true, plus: true } },
        },
      },
    },
  })

  if (!category) return { status: 'error', message: GENERIC_ERROR }

  // A tela esconde o formulário quando o prazo venceu ou o árbitro encerrou, mas
  // esta action é um POST público: sem a checagem aqui, dá para inscrever em
  // torneio encerrado mandando o formulário na mão.
  const torneioAberto = validarTorneioAberto(category.torneio)

  if (!torneioAberto.ok) return { status: 'error', message: torneioAberto.motivo }

  const fideId = hasIds ? toInteger(formData.get('idfide')) : null
  const cbxId = hasIds ? toInteger(formData.get('idcbx')) : null

  // Duplicidade é por identidade do JOGADOR (ID FIDE ou CBX), não por conta —
  // uma conta pode inscrever vários jogadores no mesmo torneio. Sem nenhum dos
  // dois IDs, não há checagem: comparar por nome barraria homônimos.
  const duplicada = await buscarInscricaoDuplicada({
    idTorneio: category.id_torneio,
    identidade: { idFide: fideId, idCbx: cbxId }
  })

  if (duplicada) return { status: 'duplicate' }

  const session = await auth()
  const email = session?.user?.email

  if (!email) {
    return { status: 'error', message: 'Sua sessão expirou. Entre novamente para concluir a inscrição.' }
  }

  const user = await db.usuario.findUnique({ where: { email } })

  if (!user) return { status: 'error', message: GENERIC_ERROR }

  // Divisão escolhida: a absoluta tem prioridade, se o jogador a marcou.
  const [divisions, categorias] = await Promise.all([
    db.divisoes.findMany({ where: { id_torneio: category.id_torneio } }),
    db.categoria.findMany({
      where: { id_torneio: category.id_torneio },
      select: {
        uuid: true,
        name: true,
        min_y: true,
        max_y: true,
        default_division: true
      }
    })
  ])

  // T15 + T17: a categoria vem do cliente, então precisa ser reconferida no
  // servidor — existe no torneio, é do gênero do jogador e corresponde à idade.
  const categoriaValida = validarCategoria({
    categorias,
    divisoes: divisions,
    uuidCategoria: category.uuid,
    anoNascimento: Number(ano),
    genero
  })

  if (!categoriaValida.ok) return { status: 'error', message: categoriaValida.motivo }

  const defaultDivision = divisions.find((division) => division.id === category.default_division) ?? null
  const absoluteDivision = divisions.find((division) => division.isAbsolute) ?? null
  const chosenDivision =
    absoluteDivision && toText(formData.get('division')) === absoluteDivision.name
      ? absoluteDivision
      : defaultDivision

  if (!chosenDivision) return { status: 'error', message: GENERIC_ERROR }

  const divisaoValida = validarDivisao({
    divisoes: divisions,
    categoria: category,
    idDivisao: chosenDivision.id,
    genero
  })

  if (!divisaoValida.ok) return { status: 'error', message: divisaoValida.motivo }

  const timeClass = await classifyTime(
    Number(category.torneio.tempo_torneio_time_digitalTotempo?.time),
    Number(category.torneio.tempo_torneio_time_digitalTotempo?.plus)
  )

  // T16: os dados oficiais NÃO vêm mais do JSON que o navegador envia
  // (`playerFide`/`playerCbx`). Nome, federação, título e ratings são buscados
  // aqui, direto na FIDE e na CBX, a partir dos IDs informados.
  //
  // Se o site oficial estiver fora do ar, a inscrição NÃO é bloqueada: o nome
  // digitado é usado e os dados oficiais ficam vazios — o árbitro pode
  // completá-los depois na tela de análise. As duas consultas correm em paralelo
  // para não somar o tempo de espera.
  const [oficialFide, oficialCbx] = await Promise.all([
    buscarJogadorOficial((id) => verifyFideId(id, { prazoMs: PRAZO_CONSULTA_NO_ENVIO_MS }), fideId),
    buscarJogadorOficial((id) => verifyCbxId(id, { prazoMs: PRAZO_CONSULTA_NO_ENVIO_MS }), cbxId)
  ])

  // Sem tempo classificado (bullet) não existe rating correspondente.
  const ratingOf = (player: OfficialPlayer | null) =>
    player && timeClass !== 'bullet' ? player.ratings[timeClass] : null

  // T18: o comprovante é validado ANTES de gravar. Assim um arquivo inválido
  // não deixa inscrição criada pela metade.
  const receipt = formData.get('fileComprovante')
  const temComprovante = receipt instanceof File && receipt.size > 0

  if (temComprovante) {
    const validacao = validarComprovante(receipt)

    if (!validacao.ok) return { status: 'error', message: validacao.motivo }
  }

  try {
    const inscription = await db.incricao.create({
      data: {
        uuid_cat: category.uuid,
        id_usuario: user.id,
        city,
        club: club === '' ? null : club,
        data_nasc: new Date(Number(ano), Number(mes) - 1, Number(dia)),
        id_division: chosenDivision.id,
        id_fide: fideId,
        id_cbx: cbxId,
        genre: genero === 'masc',
        name: oficialFide?.name ?? name,
        id_torneio: category.id_torneio,
        federation: oficialFide?.federation ?? undefined,
        titulo: oficialFide?.title ?? undefined,
        rtg_fide: ratingOf(oficialFide),
        rtg_cbx: ratingOf(oficialCbx),
      },
    })

    if (temComprovante) {
      const enviou = await uploadReceipt(receipt, category.id_torneio, user.id, inscription.uuid)

      // Sem o comprovante a inscrição não serve para o árbitro conferir o
      // pagamento. Antes, a falha só ia para o log e o jogador via "inscrição
      // concluída". Agora a inscrição é desfeita — e o retorno é diferente
      // quando o próprio desfazer falha, para não dizer que desfez o que não foi.
      if (!enviou) {
        let desfeita = false

        try {
          await db.incricao.delete({ where: { uuid: inscription.uuid } })
          desfeita = true
        } catch (error) {
          console.error('Falha ao desfazer a inscrição sem comprovante:', error)
        }

        return desfeita
          ? {
              status: 'error',
              message: 'Não foi possível enviar o comprovante, então sua inscrição não foi concluída. Tente novamente.'
            }
          : {
              status: 'error',
              message: 'Não foi possível enviar o comprovante. Sua inscrição ficou registrada sem comprovante — anexe-o em "Minhas inscrições" ou avise a organização.'
            }
      }
    }

    const inscriptionForEmail: Player = {
      uuid: inscription.uuid,
      city: inscription.city,
      club: inscription.club ?? '',
      genre: inscription.genre,
      data_nasc: inscription.data_nasc,
      id_fide: Number(inscription.id_fide ?? 0),
      id_cbx: Number(inscription.id_cbx ?? 0),
      uuid_cat: inscription.uuid_cat,
      status: inscription.status,
      id_usuario: inscription.id_usuario,
      name: inscription.name,
      id_division: Number(inscription.id_division ?? 0),
      id_torneio: Number(inscription.id_torneio),
      rtg_fide: Number(inscription.rtg_fide ?? 0),
      rtg_cbx: Number(inscription.rtg_cbx ?? 0),
      federation: inscription.federation ?? undefined,
      titulo: inscription.titulo ?? undefined,
      categoria: {
        name: category.name,
        uuid: category.uuid,
        id_torneio: Number(category.id_torneio),
        min_y: category.min_y,
      },
      divisoes: {
        name: chosenDivision.name,
        id: Number(chosenDivision.id),
      },
      usuario: {
        id: user.id,
        email: user.email,
      },
    }

    // Um email com problema não pode desfazer a inscrição já registrada.
    await Promise.allSettled([
      sendNewInscription(inscriptionForEmail, category.torneio.title, Number(category.id_torneio)),
      sendRequestedMessageEmail(inscriptionForEmail, category.torneio.title),
    ])

    return { status: 'success' }
  } catch (error) {
    console.error('Erro ao registrar a inscrição:', error)

    return { status: 'error', message: GENERIC_ERROR }
  }
}
