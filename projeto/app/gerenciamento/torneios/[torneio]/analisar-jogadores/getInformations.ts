'use server'

// import db from "@/lib/db"



// export async function getplayers(id: number) {
//     const players = await db.incricao.findMany({
//         where: {
//             id_torneio: id
//         },
//         include: {
//             categoria: {
//                 select: {
//                     name: true,
//                     uuid: true,
//                     id_torneio: true
//                 }
//             },
//             divisoes: {
//                 select: {
//                     name: true,
//                     id: true
//                 }
//             },
//             usuario: {
//                 select: {
//                     id: true
//                 }
//             }
//         },
//         orderBy: {
//             name: 'asc'
//         }
//     })
    
//     return players
// }

// export async function getCategories(id: number) {
//     const data = await db.categoria.findMany({
//         where: {
//             id_torneio: id
//         },
//         select: {
//             uuid: true,
//             name: true,
//             default_division: true,
//         }
//     })
//     return data
// }

// export async function getDivisons(id: number) {
//     const data = await db.divisoes.findMany({
//         where: {
//             id_torneio: id
//         },
//         select: {
//             id: true,
//             name: true,
//             isAbsolute: true
//         }
//     })
//     return data
// }

import { requireAdmin } from "@/lib/auth-guard"
import db from "@/lib/db"

function convertBigIntToNumber(obj: any): any {
    if (typeof obj === 'bigint') {
        return Number(obj)
    }

    // mantém objetos Date intactos
    if (obj instanceof Date) {
        return obj
    }

    if (Array.isArray(obj)) {
        return obj.map(convertBigIntToNumber)
    }

    if (obj && typeof obj === 'object') {
        return Object.fromEntries(
            Object.entries(obj).map(([key, value]) => [
                key,
                convertBigIntToNumber(value)
            ])
        )
    }

    return obj
}

export async function getplayers(id: number) {
    // Dados pessoais de todos os inscritos: só administrador.
    await requireAdmin()

    const players = await db.incricao.findMany({
        where: {
            id_torneio: id
        },
        include: {
            categoria: {
                select: {
                    name: true,
                    uuid: true,
                    id_torneio: true,
                    min_y: true
                }
            },
            divisoes: {
                select: {
                    name: true,
                    id: true
                }
            },
            usuario: {
                select: {
                    email: true,
                    id: true
                }
            }
        },
        orderBy: {
            name: 'asc'
        }
    })

    return convertBigIntToNumber(players)
}

export async function getCategories(id: number) {
    await requireAdmin()

    const data = await db.categoria.findMany({
        where: {
            id_torneio: id
        },
        select: {
            uuid: true,
            name: true,
            default_division: true,
        }
    })

    return convertBigIntToNumber(data)
}

export async function getDivisons(id: number) {
    await requireAdmin()

    const data = await db.divisoes.findMany({
        where: {
            id_torneio: id
        },
        select: {
            id: true,
            name: true,
            isAbsolute: true
        }
    })

    return convertBigIntToNumber(data)
}