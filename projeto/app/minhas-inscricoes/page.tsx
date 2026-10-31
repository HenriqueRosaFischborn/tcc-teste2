import './unique.css'
import './responsive.css'
import { auth } from '@/auth'
import db from '@/lib/db'
import { getSupabaseAdmin } from '@/lib/supabase'
import InscriptionsList, { InscriptionItem } from './inscriptions-list'

export default async function MyInscriptions() {
    const dateNow = new Date()
    const session = await auth()

    const inscri = await db.incricao.findMany({
        where: {
            usuario: {
                email: session?.user.email
            }
        },
        include: {
            usuario: {
                select: {
                    id: true,
                    email: true
                }
            },
            torneio: {
                select: {
                    id: true,
                    title: true,
                    date_inscri: true,
                    inscri_closed_by_arbiter: true
                }
            },
            categoria: {
                select: {
                    name: true,
                    uuid: true,
                    id_torneio: true,
                    value: true
                }
            },
            divisoes: {
                select: {
                    id: true,
                    name: true
                }
            }
        }
    })

    const supabaseAdmin = await getSupabaseAdmin()

    const torneiosUnicos = Array.from(
        new Map(inscri.map(item => [item.torneio.id, item.torneio])).values()
    )

    // Uma única listagem da pasta basta para saber quais torneios têm cartaz.
    const { data: torneioFolders, error: foldersError } = await supabaseAdmin.storage
        .from("publics")
        .list("folders")

    const folders: { [key: string]: string } = {}

    if (!foldersError) {
        const existentes = new Set((torneioFolders ?? []).map(folder => folder.name))

        for (const torneio of torneiosUnicos) {
            if (!existentes.has(String(torneio.id))) continue

            folders[String(torneio.id)] = supabaseAdmin.storage
                .from("publics")
                .getPublicUrl(`folders/${torneio.id}`)
                .data.publicUrl
        }
    }

    const items: InscriptionItem[] = []

    for (const el of inscri) {
        // Inscrições sem divisão definida não são exibidas.
        if (!el.divisoes) continue

        const dateInscri = el.torneio.date_inscri.toLocaleDateString('pt-BR')
        const timeInscri = el.torneio.date_inscri.toLocaleTimeString('pt-BR', {
            hour: '2-digit',
            minute: '2-digit'
        })

        items.push({
            uuid: el.uuid,
            tournamentId: Number(el.torneio.id),
            tournamentTitle: el.torneio.title,
            status: el.status,
            open: el.torneio.date_inscri > dateNow && el.torneio.inscri_closed_by_arbiter === false,
            deadlineISO: el.torneio.date_inscri.toISOString(),
            deadlineDate: dateInscri,
            deadlineTime: timeInscri,
            name: el.name,
            birthDate: el.data_nasc.toLocaleDateString('pt-BR'),
            email: el.usuario.email,
            categoryName: el.categoria.name,
            categoryValue: new Intl.NumberFormat('pt-BR', {
                style: 'currency',
                currency: 'BRL'
            }).format(Number(el.categoria.value)),
            imageUrl: folders[String(el.torneio.id)] ?? null
        })
    }

    return (
        <div id="tournaments">
            <h1>Minhas Inscrições</h1>
            <InscriptionsList items={items} />
        </div>
    )
}
