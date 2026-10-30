'use server'

import { sendNewInscription } from '@/app/api/email/new-inscription/send'
import { sendRequestedMessageEmail } from '@/app/api/email/inscription-solicited/send'
import { auth } from '@/auth'
import classifyTime from '@/lib/classifyTime'
import db from '@/lib/db'
import { getSupabaseAdmin } from '@/lib/supabase'
import type { Player } from '@/lib/types'
import type { InscriptionState, OfficialPlayer } from './types'

const BIRTH_DATE_PATTERN = /^(\d{2})\/(\d{2})\/(\d{4})$/

const GENERIC_ERROR = 'Não foi possível concluir a inscrição. Tente novamente.'

/** Converte um campo do formulário em número inteiro (ou null quando vazio/inválido). */
function toInteger(value: FormDataEntryValue | null): number | null {
  if (typeof value !== 'string' || value.trim() === '') return null

  const parsed = Number(value)

  return Number.isInteger(parsed) ? parsed : null
}

/** Lê os dados do jogador que a tela guarda num campo oculto em JSON. */
function toOfficialPlayer(value: FormDataEntryValue | null): OfficialPlayer | null {
  if (typeof value !== 'string' || value.trim() === '') return null

  try {
    const parsed = JSON.parse(value)

    return typeof parsed?.name === 'string' ? (parsed as OfficialPlayer) : null
  } catch {
    return null
  }
}

function toText(value: FormDataEntryValue | null): string {
  return typeof value === 'string' ? value.trim() : ''
}

async function uploadReceipt(file: File, tournamentId: bigint, userId: number, inscriptionUuid: string) {
  const path = `comprovantes/${tournamentId}/${userId}/${inscriptionUuid}`

  try {
    const supabaseAdmin = await getSupabaseAdmin()
    const { error } = await supabaseAdmin.storage
      .from('publics')
      .upload(path, file, { upsert: true, contentType: file.type })

    if (error) console.error('Falha ao enviar o comprovante:', error)
  } catch (error) {
    console.error('Falha ao enviar o comprovante:', error)
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

  if (!name || !birthDate || !categoryUuid || (genre !== 'masc' && genre !== 'fem')) {
    return { status: 'error', message: 'Preencha todos os campos obrigatórios (*).' }
  }

  const category = await db.categoria.findFirst({
    where: { uuid: categoryUuid },
    include: {
      torneio: {
        select: {
          title: true,
          tempo_torneio_time_digitalTotempo: { select: { time: true, plus: true } },
        },
      },
    },
  })

  if (!category) return { status: 'error', message: GENERIC_ERROR }

  const fideId = hasIds ? toInteger(formData.get('idfide')) : null
  const cbxId = hasIds ? toInteger(formData.get('idcbx')) : null

  if (hasIds && fideId !== null) {
    const alreadyInscribed = await db.incricao.findFirst({
      where: { id_fide: fideId, id_torneio: category.id_torneio },
    })

    if (alreadyInscribed) return { status: 'duplicate' }
  }

  const session = await auth()
  const email = session?.user?.email

  if (!email) {
    return { status: 'error', message: 'Sua sessão expirou. Entre novamente para concluir a inscrição.' }
  }

  const user = await db.usuario.findUnique({ where: { email } })

  if (!user) return { status: 'error', message: GENERIC_ERROR }

  // Divisão escolhida: a absoluta tem prioridade, se o jogador a marcou.
  const divisions = await db.divisoes.findMany({ where: { id_torneio: category.id_torneio } })
  const defaultDivision = divisions.find((division) => division.id === category.default_division) ?? null
  const absoluteDivision = divisions.find((division) => division.isAbsolute) ?? null
  const chosenDivision =
    absoluteDivision && toText(formData.get('division')) === absoluteDivision.name
      ? absoluteDivision
      : defaultDivision

  if (!chosenDivision) return { status: 'error', message: GENERIC_ERROR }

  const timeClass = await classifyTime(
    Number(category.torneio.tempo_torneio_time_digitalTotempo?.time),
    Number(category.torneio.tempo_torneio_time_digitalTotempo?.plus)
  )

  const playerFide = toOfficialPlayer(formData.get('playerFide'))
  const playerCbx = toOfficialPlayer(formData.get('playerCbx'))
  // Sem tempo classificado (bullet) não existe rating correspondente.
  const ratingOf = (player: OfficialPlayer | null) =>
    player && timeClass !== 'bullet' ? player.ratings[timeClass] : null

  const [, day, month, year] = birthDate

  try {
    const inscription = await db.incricao.create({
      data: {
        uuid_cat: category.uuid,
        id_usuario: user.id,
        city,
        club: club === '' ? null : club,
        data_nasc: new Date(Number(year), Number(month) - 1, Number(day)),
        id_division: chosenDivision.id,
        id_fide: fideId,
        id_cbx: cbxId,
        genre: genre === 'masc',
        name: playerFide?.name ?? name,
        id_torneio: category.id_torneio,
        federation: playerFide?.federation ?? undefined,
        titulo: playerFide?.title ?? undefined,
        rtg_fide: ratingOf(playerFide),
        rtg_cbx: ratingOf(playerCbx),
      },
    })

    const receipt = formData.get('fileComprovante')

    if (receipt instanceof File && receipt.size > 0) {
      await uploadReceipt(receipt, category.id_torneio, user.id, inscription.uuid)
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
