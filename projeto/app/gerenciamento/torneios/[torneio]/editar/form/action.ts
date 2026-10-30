'use server'

import db from "@/lib/db"
import { getSupabaseAdmin } from "@/lib/supabase"
import { NewTournment } from "@/lib/types"

type Categorie = {
    name: string,
    value: string,
    from: number,
    to: number,
    divisionFor: string
}

type Division = {
    name: string,
    isAbsolute: boolean,
    genre: string,
    categories?: Categorie[]
}

export default async function addTournmentForm(prev: NewTournment, formdata: FormData): Promise<NewTournment> {
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

    const tournment = await db.torneio.update({
        where: {
            id: Number(defaultTournment.id)
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

    const emails = JSON.parse(String(formdata.get('emails'))) as string[]

    await db.emails.deleteMany({
        where: {
            id_torneio: tournment.id
        }
    })

    await db.emails.createMany({
        data: emails.map(email => ({
            id_torneio: tournment.id,
            email
        }))
    })

    const divisions = JSON.parse(String(formdata.get('divisions')))
    
    console.dir(divisions, { depth: null })

    const difference = formdata.get('difference') === "true"

    if (difference) {
        // Deleta categorias antigas
        await db.categoria.deleteMany({
            where: {
                id_torneio: tournment.id
            }
        })
    
        // Deleta divisões antigas
        await db.divisoes.deleteMany({
            where: {
                id_torneio: tournment.id
            }
        })
    
        
        // Cria divisões
        await db.divisoes.createMany({
            data: divisions.map((div: Division )=> ({
                name: div.name,
                id_torneio: tournment.id,
                isAbsolute: div.isAbsolute,
                genre: div.genre === 'Masculino/Feminino'
                    ? 'ambos'
                    : div.genre.toLowerCase()
            }))
        })
    
        // Busca divisões criadas
        const createdDivisions = await db.divisoes.findMany({
            where: {
                id_torneio: tournment.id
            }
        })
    
        // Cria categorias relacionando pelo nome da divisão
        const categoriesData = divisions.flatMap((div: Division) => {
            const createdDiv = createdDivisions.find(
                d => d.name === div.name
            )
    
            if (!div.categories) return
    
            return div.categories.map((category: Categorie) => ({
                name: category.name as string,
                id_torneio: tournment.id,
                value: Number(
                    category.value
                        .replace('R$', '')
                        .replace(/\./g, '')
                        .replace(',', '.')
                        .trim()
                ),
                min_y: category.from as number,
                max_y: category.to as number,
                default_division: createdDiv!.id
            }))
        })
    
        // Cria categorias
        await db.categoria.createMany({
            data: categoriesData
        })
    }

    return {message: 'Sucesso'}
}