'use server'

import { requireAdmin, UnauthorizedError } from "@/lib/auth-guard"
import db from "@/lib/db"
import { getSupabaseAdmin } from "@/lib/supabase"
import { NewTournment } from "@/lib/types"
import { sincronizarCategorias, type DivisaoDoFormulario } from "./sincronizar-categorias"

export default async function addTournmentForm(prev: NewTournment, formdata: FormData): Promise<NewTournment> {
    // A action é pública e este arquivo envia uploads antes de gravar, então a
    // checagem precisa vir antes de qualquer efeito colateral.
    try {
        await requireAdmin()
    } catch (error) {
        if (error instanceof UnauthorizedError) {
            return { message: 'Sessão expirada ou sem permissão' }
        }

        throw error
    }

    const fileFolder = formdata.get('fileFolder') as File
    const fileFolderPath = fileFolder.size != 0 ? `folders/${formdata.get('title')}` : ''
    if (fileFolder.size != 0) {
        
        const supabaseAdmin = await getSupabaseAdmin()
        const {error} = await supabaseAdmin.storage.from('publics').upload(fileFolderPath, fileFolder, {
            upsert: true,
            contentType: fileFolder.type
        })
    }

    const fileReg = formdata.get('fileReg') as File
    const fileRegPath = fileReg.size != 0 ? `regulamentos/${formdata.get('title')}` : ''
    if (fileReg.size != 0) {
        
        const supabaseAdmin = await getSupabaseAdmin()
        const {error} = await supabaseAdmin.storage.from('publics').upload(fileRegPath, fileReg, {
            upsert: true,
            contentType: fileFolder.type
        })
    }

    const fileQr = formdata.get('fileQr') as File
    const fileQrPath = fileQr.size != 0 ? `qrCodes/${formdata.get('title')}` : ''
    if (fileQr.size != 0) {
        const supabaseAdmin = await getSupabaseAdmin()
        const {error} = await supabaseAdmin.storage.from('publics').upload(fileQrPath, fileQr, {
            upsert: true,
            contentType: fileFolder.type
        })
    }
    
    
    
    console.log(formdata)
  
    const dataTimeAnalog = String(formdata.get('timeAnalog')).split('+').map(Number)
    const dataTimeDigital = String(formdata.get('timeDigital')).split('+').map(Number)
    
    const timeAnalog = await db.tempo.findFirst({
        where: {
            time: dataTimeAnalog[0],
            plus: dataTimeAnalog[1]
        },
        select: {
            id: true
        }
    }).then(res => {if (res) return Number(res.id)})

    const timeDigital = await db.tempo.findFirst({
        where: {
            time: dataTimeDigital[0],
            plus: dataTimeDigital[1]
        },
        select: {
            id: true
        }
    }).then(res => {if (res) return Number(res.id)})
    
    const dataDates = formdata.getAll('borndate') as string[]
    const dataHours = formdata.getAll('hour') as string[]


    const [d_e, m_e, y_e] = dataDates[0].split('/').map(Number)
    const [h_e, mi_e] = dataHours[0].split(':').map(Number)

    const [d_i, m_i, y_i] = dataDates[1].split('/').map(Number)
    const [h_i, mi_i] = dataHours[1].split(':').map(Number)

    const date_e = new Date(y_e, m_e - 1, d_e, h_e, mi_e)
    const date_i = new Date(y_i, m_i - 1, d_i, h_i, mi_i)
    

    const defaultTournment = JSON.parse(String(formdata.get('defaultTournment')))

    if (!(defaultTournment && defaultTournment.id)) return {message: 'Fracasso'}

    const idTorneio = Number(defaultTournment.id)

    if (!Number.isInteger(idTorneio)) return {message: 'Fracasso'}

    const emails = JSON.parse(String(formdata.get('emails'))) as string[]

    const divisions = JSON.parse(String(formdata.get('divisions'))) as DivisaoDoFormulario[]

    if (!Array.isArray(divisions)) return {message: 'Fracasso'}

    const difference = formdata.get('difference') === "true"

    // Tudo o que grava acontece numa transação só, e a sincronização de
    // categorias/divisões vem PRIMEIRO porque ela pode recusar a edição (quando
    // alguém tenta excluir categoria/divisão que tem inscrição). Se recusar,
    // nem o torneio nem os e-mails mudam.
    //
    // Antes da T09, este bloco apagava todas as categorias e recriava — o que,
    // pelo `onDelete: Cascade` de `incricao.uuid_cat`, apagava **todas as
    // inscrições do torneio**.
    const resultado = await db.$transaction(async (tx) => {
        if (difference) {
            const sincronizacao = await sincronizarCategorias(tx, BigInt(idTorneio), divisions)

            if (!sincronizacao.ok) {
                return { ok: false as const, motivo: sincronizacao.motivo }
            }
        }

        await tx.torneio.update({
            where: {
                id: idTorneio
            },
            data: {
                title: formdata.get('title') as string,
                time_analog: timeAnalog,
                time_digital: timeDigital,
                local: formdata.get('local') as string,
                local_link: formdata.get('localLink') as string,
                date_event: date_e,
                date_inscri: date_i,
                chave_pix: formdata.get('chave-pix') as string,
                link_chessresults: formdata.get('link-chess-results') as string
            }
        })

        await tx.emails.deleteMany({
            where: {
                id_torneio: BigInt(idTorneio)
            }
        })

        await tx.emails.createMany({
            data: emails.map(email => ({
                id_torneio: BigInt(idTorneio),
                email
            }))
        })

        return { ok: true as const }
    })

    if (!resultado.ok) return { message: resultado.motivo }

    return {message: 'Sucesso'}
}