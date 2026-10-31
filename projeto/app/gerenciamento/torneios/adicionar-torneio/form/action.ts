'use server'

import { requireAdmin, UnauthorizedError } from "@/lib/auth-guard"
import db from "@/lib/db"
import { getSupabaseAdmin } from "@/lib/supabase"
import { NewTournment } from "@/lib/types"

export default async function addTournmentForm(prev: NewTournment, formdata: FormData): Promise<NewTournment> {
    // A action é pública: sem administrador, ela nem começa.
    try {
        await requireAdmin()
    } catch (error) {
        if (error instanceof UnauthorizedError) {
            return { message: 'Sessão expirada ou sem permissão' }
        }

        throw error
    }

    
  
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
    

    const tournment = await db.torneio.create({
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

    const fileFolder = formdata.get('fileFolder') as File
    const fileFolderPath = fileFolder.size != 0 ? `folders/${tournment.id}` : ''
    if (fileFolder.size != 0) {
        
        const supabaseAdmin = await getSupabaseAdmin()
        const {error} = await supabaseAdmin.storage.from('publics').upload(fileFolderPath, fileFolder, {
            upsert: true,
            contentType: fileFolder.type
        })
    }

    const fileReg = formdata.get('fileReg') as File
    const fileRegPath = fileReg.size != 0 ? `regulamentos/${tournment.id}` : ''
    if (fileReg.size != 0) {
        
        const supabaseAdmin = await getSupabaseAdmin()
        const {error} = await supabaseAdmin.storage.from('publics').upload(fileRegPath, fileReg, {
            upsert: true,
            contentType: fileReg.type
        })
    }

    const fileQr = formdata.get('fileQr') as File
    const fileQrPath = fileQr.size != 0 ? `qrCodes/${tournment.id}` : ''
    if (fileQr.size != 0) {
        const supabaseAdmin = await getSupabaseAdmin()
        const {error} = await supabaseAdmin.storage.from('publics').upload(fileQrPath, fileQr, {
            upsert: true,
            contentType: fileQr.type
        })
    }

    const emails = JSON.parse(String(formdata.get('emails'))) as string[]

    for (let i = 0 ; i < emails.length ; i++) {
        await db.emails.create({
            data: {
                id_torneio: tournment.id,
                email: emails[i]
            }
        })
    }

    const divisions = JSON.parse(String(formdata.get('divisions')))
    
    console.dir(divisions, { depth: null })


    for (let i = 0 ; i < divisions.length ; i++) {
        const div = await db.divisoes.create({
            data: {
                name: divisions[i].name,
                id_torneio: tournment.id,
                isAbsolute: divisions[i].isAbsolute,
                genre: divisions[i].genre == 'Masculino/Feminino' ? 'ambos' : divisions[i].genre.toLowerCase()
            }
        })


        const categories = divisions[i].categories
    
        for (let i2 = 0 ; i2 < categories.length ; i2++) {
            const value = Number(categories[i2].value.replace('R$', '').replace(/\./g, '').replace(',', '.').trim())
            
            await db.categoria.create({
                data: {
                    name: categories[i2].name as string,
                    id_torneio: tournment.id,
                    value: value as number,
                    min_y: categories[i2].from as number,
                    max_y: categories[i2].to as number,
                    default_division: div.id
                }
            })
        }

    }
    
    


    

    return {message: 'Sucesso'}
}