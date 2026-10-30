import './unique.css'
import './responsive.css'
import { getSupabaseAdmin } from '@/lib/supabase'
import db from '@/lib/db'
import classifyTime from '@/lib/classifyTime'
import TournamentsList, { type TournamentListItem } from './tournaments-list'

const capitalize = (value: string) => value.charAt(0).toUpperCase() + value.slice(1)

const formatTime = (time: number, plus: number) => `${time} + ${plus}`

export default async function OpenTournments() {
    const dateNow = new Date()

    const [tournments, supabaseAdmin] = await Promise.all([
        db.torneio.findMany({
            include: {
                tempo_torneio_time_digitalTotempo: {
                    select: {
                        time: true,
                        plus: true
                    }
                },
                tempo_torneio_time_analogTotempo: {
                    select: {
                        time: true,
                        plus: true
                    }
                }
            },
            where: {
                inscri_closed_by_arbiter: {
                    not: true
                },
                date_inscri: {
                    gt: dateNow
                }
            }
        }),
        getSupabaseAdmin()
    ])

    // Uma listagem só do bucket (antes era uma por torneio, dentro do laço).
    const { data: folderFiles, error: folderError } =
        await supabaseAdmin.storage.from("publics").list("folders")

    const list: TournamentListItem[] = []

    for (const tournment of tournments) {
        const slug = tournment.title.split(" ").join("~")

        const digitalTime = Number(tournment.tempo_torneio_time_digitalTotempo?.time)
        const digitalPlus = Number(tournment.tempo_torneio_time_digitalTotempo?.plus)
        const analogTime = Number(tournment.tempo_torneio_time_analogTotempo?.time)
        const analogPlus = Number(tournment.tempo_torneio_time_analogTotempo?.plus)

        const classTime = await classifyTime(digitalTime, digitalPlus)
        const classTime2 = await classifyTime(analogTime, analogPlus)

        const sameTime = digitalTime === analogTime && digitalPlus === analogPlus

        const timeLabel = !Number.isFinite(digitalTime) || !Number.isFinite(digitalPlus)
            ? ''
            : sameTime
                ? `${capitalize(classTime)} (${formatTime(digitalTime, digitalPlus)})`
                : `Digital: ${capitalize(classTime)} (${formatTime(digitalTime, digitalPlus)}) / Analógico: ${capitalize(classTime2)} (${formatTime(analogTime, analogPlus)})`

        const hasImage = !folderError && Boolean(folderFiles?.some(file => file.name === String(tournment.id)))

        list.push({
            slug,
            title: tournment.title,
            inscriptionDate: tournment.date_inscri.toLocaleDateString('pt-BR'),
            eventDate: tournment.date_event.toLocaleDateString('pt-BR'),
            eventYear: tournment.date_event.getFullYear(),
            eventMonth: tournment.date_event.getMonth(),
            timeLabel,
            local: tournment.local,
            localLink: tournment.local_link ?? '#',
            imageUrl: hasImage
                ? supabaseAdmin.storage.from("publics").getPublicUrl(`folders/${tournment.id}`).data.publicUrl
                : null
        })
    }

    return (
        <>
            <div id="tournaments">
                <h1>Torneios Abertos para Inscrição</h1>

                {list.length > 0
                    ? <TournamentsList tournaments={list} />
                    : <p className="obs">Não há torneios abertos no momento</p>}
            </div>
        </>
    )
}
