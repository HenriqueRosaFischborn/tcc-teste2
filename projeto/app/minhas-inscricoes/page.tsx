import './unique.css'
import './responsive.css'
import { auth } from '@/auth'
import db from '@/lib/db'
import { getSupabaseAdmin } from '@/lib/supabase'
import { Player } from '@/lib/types'
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

        const inscricaoDetails: Player = {
            city: el.city,
            club: el.club ? el.club : '',
            genre: el.genre,
            data_nasc: el.data_nasc,
            uuid_cat: el.uuid_cat,
            status: el.status,
            id_usuario: el.id_usuario,
            id_fide: Number(el.id_fide),
            id_cbx: Number(el.id_cbx),
            uuid: el.uuid,
            name: el.name,
            id_division: Number(el.id_division),
            id_torneio: Number(el.id_torneio),
            rtg_fide: Number(el.rtg_fide),
            rtg_cbx: Number(el.rtg_cbx),
            categoria: {
                name: el.categoria.name,
                uuid: el.categoria.uuid,
                id_torneio: Number(el.categoria.id_torneio),
            },
            divisoes: {
                id: Number(el.divisoes.id),
                name: String(el.divisoes.name),
            },
            usuario: {
                id: el.usuario.id,
                email: el.usuario.email,
            }
        }

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
            imageUrl: folders[String(el.torneio.id)] ?? null,
            player: inscricaoDetails
        })
    }

    return (
        <div id="tournaments">
            <h1>Minhas Inscrições</h1>
            <InscriptionsList items={items} />
        </div>
    )
}
