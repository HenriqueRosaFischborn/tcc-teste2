'use server'

import { requireAdmin } from "@/lib/auth-guard"
import db from "@/lib/db"
import { getSupabaseAdmin } from "@/lib/supabase"

async function deleteById(folder: string, id: number) {
    const supabaseAdmin = await getSupabaseAdmin()

    const basePath = folder

    const { data, error } = await supabaseAdmin.storage
        .from("publics")
        .list(basePath, {
            limit: 1000
        })

    if (error) {
        throw new Error(error.message)
    }

    if (!data) return

    const item = data.find(file => file.name === String(id) || file.name.startsWith(`${id}.`))

    if (!item) {
        console.log(`Nada encontrado em ${folder}/${id}`)
        return
    }


    const fullPath = `${basePath}/${item.name}`


    // É arquivo
    if (item.metadata) {

        const { error } = await supabaseAdmin.storage
            .from("publics")
            .remove([fullPath])

        if (error) {
            throw new Error(error.message)
        }

        console.log("Arquivo deletado:", fullPath)
        return
    }


    // É pasta
    async function getAllFiles(path: string): Promise<string[]> {

        const { data, error } = await supabaseAdmin.storage
            .from("publics")
            .list(path, {
                limit: 1000
            })

        if (error) {
            throw new Error(error.message)
        }

        if (!data) return []

        const files: string[] = []

        for (const item of data) {

            const childPath = `${path}/${item.name}`

            if (item.metadata) {
                files.push(childPath)
            } else {
                files.push(...await getAllFiles(childPath))
            }
        }

        return files
    }


    const files = await getAllFiles(fullPath)

    console.log("Arquivos encontrados:", files)


    if (files.length > 0) {

        const { error } = await supabaseAdmin.storage
            .from("publics")
            .remove(files)

        if (error) {
            throw new Error(error.message)
        }
    }


    console.log("Pasta deletada:", fullPath)
}



export async function deleteTournment(id: number) {
    // Exclusão apaga o torneio, as inscrições (cascade) e os arquivos no
    // storage. Sem administrador, o erro é lançado e a operação não começa.
    await requireAdmin()

    const folders = [
        "regulamentos",
        "qrCodes",
        "folders",
        "comprovantes"
    ]


    for (const folder of folders) {
        await deleteById(folder, id)
    }


    // Exclusão do torneio: as inscrições saem explicitamente, na mesma
    // transação, ANTES do torneio.
    //
    // Depender só do cascade deixaria a exclusão à mercê da ordem em que o
    // Postgres processa as FKs: `incricao` referencia `categoria` e `torneio`,
    // e a categoria do torneio também é apagada em cascata. Quando a FK de
    // `incricao.uuid_cat` deixar de ser Cascade (migração preparada na T09),
    // apagar o torneio sem apagar as inscrições antes passaria a falhar.
    await db.$transaction([
        db.incricao.deleteMany({ where: { id_torneio: BigInt(id) } }),
        db.torneio.delete({ where: { id } })
    ])
}