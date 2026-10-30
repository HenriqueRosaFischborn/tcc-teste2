import db from "@/lib/db"


export default async function redirectTournment(tournmentName: string) {
    const name = tournmentName.split('~').join(' ')

    const tournment = await db.torneio.findUnique({
        where: {
            title: name
        },
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
            },
            // As categorias e divisões vão junto com o torneio para o formulário
            // conseguir escolher a categoria sem nenhuma consulta extra.
            categoria: {
                select: {
                    uuid: true,
                    name: true,
                    value: true,
                    min_y: true,
                    max_y: true,
                    default_division: true
                }
            },
            divisoes: {
                select: {
                    id: true,
                    name: true,
                    genre: true,
                    isAbsolute: true
                }
            }
        }
    })

    if (!tournment) return null

    // BigInt não pode ser enviado ao cliente (JSON.stringify quebra), então ids e
    // tempos já saem daqui como number.
    return {
        ...tournment,
        id: Number(tournment.id),
        time_analog: tournment.time_analog === null ? null : Number(tournment.time_analog),
        time_digital: tournment.time_digital === null ? null : Number(tournment.time_digital),
        categoria: tournment.categoria.map((categoria) => ({
            ...categoria,
            default_division: Number(categoria.default_division)
        })),
        divisoes: tournment.divisoes.map((divisao) => ({
            ...divisao,
            id: Number(divisao.id)
        }))
    }

}
