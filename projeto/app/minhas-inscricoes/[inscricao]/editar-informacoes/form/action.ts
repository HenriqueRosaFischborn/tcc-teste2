'use server'

// import { sendUpdateInscriptionEmail } from "@/app/api/email/update-infos/send"
// import { auth } from "@/auth"
// import classifyTime from "@/lib/classifyTime"
// import db from "@/lib/db"
// import { getSupabaseAdmin } from "@/lib/supabase"
// import { FormState, Player } from "@/lib/types"
// import * as cheerio from 'cheerio'

// type DataPlayer = {
//     name: string,
//     bornYear: string,
//     genre: string,
//     title: string,
//     idFide: string,
//     ratings: {
//         standard: string,
//         rapid: string,
//         blitz: string
//     }
// }

// export default async function actionInscriIndividual(prev: FormState, formdata: FormData): Promise<FormState> {
//     const needed = ['name', 'city', 'borndate', 'genre', 'uuidCat']

    
    
//     const data = Object.fromEntries(formdata) as Record<string, string>
//     const dataArray = Object.entries(data).filter((el) => {
//         if (!(el[0].startsWith('$'))) {
//             return true
//         }
//     })
//     const resData = Object.fromEntries(dataArray)

//    const infosAntigasRaw = await db.incricao.findUnique({
//     where: {
//         uuid: resData.uuid
//     },
//     include: {
//         categoria: true,
//         divisoes: true,
//         usuario: true
//     }
// })

// if (!infosAntigasRaw) {
//     throw new Error("Inscrição não encontrada")
// }

// const infosAntigas: Player = {
//     uuid: infosAntigasRaw.uuid,
//     name: infosAntigasRaw.name,
//     city: infosAntigasRaw.city,
//     club: infosAntigasRaw.club ?? "",
//     genre: infosAntigasRaw.genre,
//     data_nasc: infosAntigasRaw.data_nasc,

//     id_fide: Number(infosAntigasRaw.id_fide ?? 0),
//     id_cbx: Number(infosAntigasRaw.id_cbx ?? 0),

//     uuid_cat: infosAntigasRaw.uuid_cat,
//     status: infosAntigasRaw.status,
//     id_usuario: infosAntigasRaw.id_usuario,

//     id_division: Number(infosAntigasRaw.id_division ?? 0),
//     id_torneio: Number(infosAntigasRaw.id_torneio),

//     rtg_fide: Number(infosAntigasRaw.rtg_fide ?? 0),
//     rtg_cbx: Number(infosAntigasRaw.rtg_cbx ?? 0),

//     federation: infosAntigasRaw.federation ?? undefined,
//     titulo: infosAntigasRaw.titulo ?? undefined,

//     categoria: {
//         name: infosAntigasRaw.categoria.name,
//         uuid: infosAntigasRaw.categoria.uuid,
//         id_torneio: Number(infosAntigasRaw.categoria.id_torneio),
//         min_y: infosAntigasRaw.categoria.min_y ?? undefined
//     },

//     divisoes: {
//         name: infosAntigasRaw.divisoes ? infosAntigasRaw.divisoes.name : '',
//         id: Number(infosAntigasRaw.divisoes ? infosAntigasRaw.divisoes.id  : 0)
//     },

//     usuario: {
//         id: infosAntigasRaw.usuario.id,
//         email: infosAntigasRaw.usuario.email
//     }
// }

//     const cat = await db.categoria.findFirst({
//         where: {
//             uuid: resData.uuidCat
//         }, include: {
//             torneio: {
//                 select: {
//                     title: true,
                
//                     tempo_torneio_time_digitalTotempo: {
//                         select: {
//                             time: true,
//                             plus: true
//                         }
//                     }
//                 }
//             }
//         }
        
//     })

//     if (!cat || !infosAntigas) {
//         return {
//             message: ['erro'],
//             values: [resData]
//         }
//     }

//     const year = Number(resData.borndate.split('/').at(-1))
    
//     // if (!(year >= cat.min_y && year <= cat.max_y)) {
//     //     console.log('erro aqui')
//     //     return{
//     //         message: ['erro'],
//     //         values: [resData]
//     //     }
//     // }

//     const emptyFields = dataArray.filter((el) => {
//         if (needed.includes(el[0]) && el[1].trim() == '') {
//             return true
//         }
//     })
//     if (emptyFields.length > 0) {return {message: ['erro']}}


//     //if (resData.idfide.trim() != '') {
//         // console.log('começamo')
//         // const res = await fetch(`https://ratings.fide.com/profile/${resData.idfide}`, {
//         //     cache: 'force-cache',
//         //     next: { revalidate: 60 * 60 }
//         // })

//         // const html = await res.text()
        
//         // const $ = cheerio.load(html)
//         // const playerName = $('.player-title').text().trim()
//         // const year = $('.profile-info-byear').text().trim()
//         // const sex = $('.profile-info-sex').text().trim()

        
//         // const ratingsT = $('.profile-games').text().trim()
//         // const regex = /(\d+|Not rated)(BLITZ|STANDARD|RAPID)/g
//         // const ratings = [...ratingsT.matchAll(regex)].map(match => ({
//         //     rating: String(match[1]),
//         //     type: String(match[2])
//         // }))
        
//         // if (resData.borndate.split('/').at(-1) != year) {
//         //     console.log('Erro de data')
//         //     return {
//         //         message: ['error-info-id'],
//         //         values: [resData]
//         //     }
//         // }
//         // if ((resData.genre == 'fem' && sex == 'Male') || (resData.genre == 'masc' && sex == 'Female')) {
//         //     console.log('Erro de sexo')
//         //     return {
//         //         message: ['error-info-id'],
//         //         values: [resData]
//         //     }
//         // }
//         // if (resData.name != playerName) {
//         //     console.log('Erro de nome')
//         //     return {
//         //         message: ['error-info-id'],
//         //         values: [resData]
//         //     }
//         // }

        
//     //}
//     const hasFide = formdata.get('hasFide')
//     if (hasFide == 'true') {
//         const alreadyExists = await db.incricao.findFirst({
//             where: {
//                 id_fide: Number(resData.idfide),
//                 id_torneio: cat.id_torneio
//             }
//         })


//         if (alreadyExists) {
//             console.log('Já inscrito')
//             return {
//                 message: ['Você já está inscrito'],
//                 values: [resData]
//             }
//         }
//     }

//     const session = await auth()
//     const email = session?.user.email

//     if (!session || !session.user.email) {
//         return {message: ['não logado']}
//     }
    
//     const user = await db.usuario.findUnique({
//         where: {email: email}
//     })

//     if (!user) {
//         return {message: ['erro']}
//     }
    
    
//     const [d, m, y] = resData.borndate.split('/').map(Number)
//     const date = new Date(y, m - 1, d)







    
//     //id divisão
//     const clientDivision = formdata.get('division')

//     const divisions = await db.divisoes.findMany({
//         where: {
//             id_torneio: cat.id_torneio
//         }
//     })
    
//     let defaultDivision
    
//     defaultDivision = divisions.filter((el) => {
//         if (el.id == cat.default_division) {
//             return true
//         }
//     })[0]

//     let absoluteDivision
//     if (divisions.some((el) => {
//         if (el.isAbsolute) {
//             console.log(el)
//             return true
//         }
//     })) {
//         absoluteDivision = divisions.filter((el) => {
//             if (el.isAbsolute) {
//                 return true
//             }
//         })[0]

//         if (absoluteDivision.name == clientDivision) {
//             defaultDivision = absoluteDivision
//         }
//     }

//     const classTime = await classifyTime(Number(cat.torneio.tempo_torneio_time_digitalTotempo?.time), Number(cat.torneio.tempo_torneio_time_digitalTotempo?.plus))

//     const playerFide = JSON.parse(String(formdata.get('playerFide'))) as DataPlayer
//     const playerCbx = JSON.parse(String(formdata.get('playerCbx'))) as DataPlayer

//     const uuid = String(formdata.get('uuid'))
//     try {
//         const res = await db.incricao.update({
//             where: {
//                 uuid: uuid
//             },
//             data: {
//                 status: 'Pendente',
//                 uuid_cat: cat.uuid,
//                 id_usuario: user.id,
//                 city: resData.city,
//                 club: resData.team,
//                 data_nasc: date,
//                 id_division: defaultDivision.id,
//                 id_fide: String(resData.idfide).trim() == '' ? null : Number(resData.idfide),
//                 id_cbx: String(resData.idcbx).trim() == '' ? null : Number(resData.idcbx),
//                 genre: resData.genre == 'masc',
//                 name: hasFide && playerFide? playerFide.name : resData.name,
//                 id_torneio: Number(cat.id_torneio),
//                 rtg_fide: classTime == 'bullet' ? null : (playerFide ? playerFide.ratings[classTime] == 'Not rated' ? 0 : Number(playerFide.ratings[classTime]) : null),
//                 rtg_cbx: classTime == 'bullet' ? null :  (playerCbx ? playerCbx.ratings[classTime] == 'Not rated' ? 0 : Number(playerCbx.ratings[classTime]): null)
//             }
//         })
// //erro aqui
        
//         const fileComprovante = formdata.get('fileComprovante') as File
//         const fileComprovantePath = fileComprovante.size != 0 ? `comprovantes/${cat.id_torneio}/${user.id}/${res.uuid}` : ''
//         if (fileComprovante.size != 0) {
            
//             const supabaseAdmin = await getSupabaseAdmin()
//             const {error} = await supabaseAdmin.storage.from('publics').upload(fileComprovantePath, fileComprovante, {
//                 upsert: true,
//                 contentType: fileComprovante.type
//             })
//         }


//         await sendUpdateInscriptionEmail(infosAntigas, )


//         return {
//             message: ['Sucesso', `/minhas-inscricoes/`],
//             values: [resData]
//         }
//     } catch (e){
//         throw e
//         console.log('errin')
//         return {message: ['erro']}
//     }

    
    
// }

// //comprovant




import { sendUpdateInscriptionEmail } from "@/app/api/email/update-infos/send"
import { requireUser, UnauthorizedError, type SessionUser } from "@/lib/auth-guard"
import classifyTime from "@/lib/classifyTime"
import { validarComprovante } from "@/lib/comprovante"
import db from "@/lib/db"
import { buscarInscricaoDuplicada, idNumerico } from "@/lib/inscricao-duplicada"
import { normalizarGenero, validarCategoria, validarDivisao } from "@/lib/regras-inscricao"
import { getSupabaseAdmin } from "@/lib/supabase"
import { verifyCbxId, verifyFideId } from "@/app/torneios-abertos/[torneio]/form/verify-player"
import type { LookupResult, OfficialPlayer } from "@/app/torneios-abertos/[torneio]/form/types"
import { FormState, Player } from "@/lib/types"
import * as cheerio from 'cheerio'

/**
 * Resultado da consulta a um site oficial, com a distinção que importa na
 * edição: "não tem ID" ≠ "consultei e não veio".
 */
type ConsultaOficial =
    | { situacao: 'encontrado', player: OfficialPlayer }
    | { situacao: 'indisponivel' }
    | { situacao: 'sem-id' }

/** Busca o jogador nas bases oficiais, para não depender do JSON do navegador. */
async function consultarJogadorOficial(
    verificar: (id: string) => Promise<LookupResult>,
    id: string | null
): Promise<ConsultaOficial> {
    if (id === null || id.trim() === '') return { situacao: 'sem-id' }

    const resultado = await verificar(id)

    return resultado.status === 'found'
        ? { situacao: 'encontrado', player: resultado.player }
        : { situacao: 'indisponivel' }
}

/** Rating do jogador oficial na classe de tempo do torneio (0 quando não tem). */
function ratingOficial(jogador: OfficialPlayer | null, classe: string): number | null {
    if (!jogador || classe === 'bullet') return null

    const valor = jogador.ratings[classe as 'standard' | 'rapid' | 'blitz']

    return valor ?? 0
}

/**
 * Rating a gravar na edição.
 *
 * - consulta deu certo → rating oficial;
 * - jogador sem ID → limpa (não tem mais rating oficial);
 * - consulta indisponível → **mantém o que já está no banco**. Sem isso, a FIDE
 *   fora do ar apagaria o rating de todo mundo que editasse a inscrição.
 */
function ratingParaGravar(
    consulta: ConsultaOficial,
    classe: string,
    valorAtual: bigint | null
): number | null {
    if (consulta.situacao === 'encontrado') {
        return ratingOficial(consulta.player, classe)
    }

    if (consulta.situacao === 'sem-id' || classe === 'bullet') {
        return null
    }

    return valorAtual === null ? null : Number(valorAtual)
}

export default async function actionInscriIndividual(prev: FormState, formdata: FormData): Promise<FormState> {
    const needed = ['name', 'city', 'borndate', 'genre', 'uuidCat']

    const data = Object.fromEntries(formdata) as Record<string, string>

    const dataArray = Object.entries(data).filter((el) => {
        if (!(el[0].startsWith('$'))) {
            return true
        }
    })

    const resData = Object.fromEntries(dataArray)

    // A inscrição é identificada pelo uuid que vem do formulário, então a
    // autorização precisa participar da própria consulta: sem isso, qualquer
    // sessão conseguiria ler e editar a inscrição de outra pessoa.
    let user: SessionUser

    try {
        user = await requireUser()
    } catch (error) {
        if (error instanceof UnauthorizedError) {
            return {
                message: ['Sessão expirada. Entre novamente para editar a inscrição.'],
                values: [resData]
            }
        }

        throw error
    }

    const infosAntigasRaw = await db.incricao.findFirst({
        where: {
            uuid: resData.uuid,
            id_usuario: user.id
        },
        include: {
            categoria: true,
            divisoes: true,
            usuario: true
        }
    })

    if (!infosAntigasRaw) {
        throw new Error("Inscrição não encontrada")
    }

    const infosAntigas: Player = {
        uuid: infosAntigasRaw.uuid,
        name: infosAntigasRaw.name,
        city: infosAntigasRaw.city,
        club: infosAntigasRaw.club ?? "",
        genre: infosAntigasRaw.genre,
        data_nasc: infosAntigasRaw.data_nasc,

        id_fide: Number(infosAntigasRaw.id_fide ?? 0),
        id_cbx: Number(infosAntigasRaw.id_cbx ?? 0),

        uuid_cat: infosAntigasRaw.uuid_cat,
        status: infosAntigasRaw.status,
        id_usuario: infosAntigasRaw.id_usuario,

        id_division: Number(infosAntigasRaw.id_division ?? 0),
        id_torneio: Number(infosAntigasRaw.id_torneio),

        rtg_fide: Number(infosAntigasRaw.rtg_fide ?? 0),
        rtg_cbx: Number(infosAntigasRaw.rtg_cbx ?? 0),

        federation: infosAntigasRaw.federation ?? undefined,
        titulo: infosAntigasRaw.titulo ?? undefined,

        categoria: {
            name: infosAntigasRaw.categoria.name,
            uuid: infosAntigasRaw.categoria.uuid,
            id_torneio: Number(infosAntigasRaw.categoria.id_torneio),
            min_y: infosAntigasRaw.categoria.min_y ?? undefined
        },

        divisoes: {
            name: infosAntigasRaw.divisoes ? infosAntigasRaw.divisoes.name : '',
            id: Number(infosAntigasRaw.divisoes ? infosAntigasRaw.divisoes.id : 0)
        },

        usuario: {
            id: infosAntigasRaw.usuario.id,
            email: infosAntigasRaw.usuario.email
        }
    }

    const cat = await db.categoria.findFirst({
        where: {
            uuid: resData.uuidCat
        },
        include: {
            torneio: {
                select: {
                    title: true,

                    tempo_torneio_time_digitalTotempo: {
                        select: {
                            time: true,
                            plus: true
                        }
                    }
                }
            }
        }
    })

    if (!cat || !infosAntigas) {
        return {
            message: ['erro'],
            values: [resData]
        }
    }

    // T15: a categoria vem do cliente e a edição gravava `id_torneio` a partir
    // dela — bastava mandar a categoria de OUTRO torneio para transferir a
    // inscrição, inclusive para um torneio encerrado. O vínculo não se move.
    if (cat.id_torneio !== infosAntigasRaw.id_torneio) {
        return {
            message: ['A categoria escolhida não pertence ao torneio desta inscrição. Recarregue a página e tente de novo.'],
            values: [resData]
        }
    }

    const year = Number(resData.borndate.split('/').at(-1))

    const emptyFields = dataArray.filter((el) => {
        if (needed.includes(el[0]) && el[1].trim() == '') {
            return true
        }
    })

    if (emptyFields.length > 0) {
        return {
            message: ['erro']
        }
    }

    // Duplicidade por identidade do jogador (ID FIDE ou CBX), ignorando a
    // própria inscrição — antes ela se encontrava e bloqueava toda edição de
    // quem tem ID FIDE (T26). Uma conta pode ter vários jogadores no mesmo
    // torneio, então a conta não entra na comparação.
    const duplicada = await buscarInscricaoDuplicada({
        idTorneio: infosAntigasRaw.id_torneio,
        identidade: {
            idFide: idNumerico(resData.idfide),
            idCbx: idNumerico(resData.idcbx)
        },
        ignorarUuid: infosAntigas.uuid
    })

    if (duplicada) {
        return {
            message: ['Você já está inscrito'],
            values: [resData]
        }
    }

    const [d, m, y] = resData.borndate.split('/').map(Number)
    const date = new Date(y, m - 1, d)

    const clientDivision = formdata.get('division')

    const divisions = await db.divisoes.findMany({
        where: {
            id_torneio: infosAntigasRaw.id_torneio
        }
    })

    const categorias = await db.categoria.findMany({
        where: {
            id_torneio: infosAntigasRaw.id_torneio
        },
        select: {
            uuid: true,
            name: true,
            min_y: true,
            max_y: true,
            default_division: true
        }
    })

    const genero = normalizarGenero(resData.genre)

    if (!genero) {
        return {
            message: ['erro'],
            values: [resData]
        }
    }

    // T17: mesma regra de idade e gênero usada no cadastro. O prazo do torneio
    // NÃO é conferido aqui de propósito: corrigir uma inscrição já feita
    // precisa continuar funcionando depois de as inscrições encerrarem.
    const categoriaValida = validarCategoria({
        categorias,
        divisoes: divisions,
        uuidCategoria: cat.uuid,
        anoNascimento: year,
        genero
    })

    if (!categoriaValida.ok) {
        return {
            message: [categoriaValida.motivo],
            values: [resData]
        }
    }

    let defaultDivision = divisions.filter((el) => {
        if (el.id == cat.default_division) {
            return true
        }
    })[0]

    let absoluteDivision

    if (divisions.some((el) => {
        if (el.isAbsolute) {
            console.log(el)
            return true
        }
    })) {
        absoluteDivision = divisions.filter((el) => {
            if (el.isAbsolute) {
                return true
            }
        })[0]

        if (absoluteDivision.name == clientDivision) {
            defaultDivision = absoluteDivision
        }
    }

    // T17: só a divisão padrão da categoria ou a absoluta do torneio, e sempre
    // compatível com o gênero informado.
    const divisaoValida = validarDivisao({
        divisoes: divisions,
        categoria: cat,
        idDivisao: defaultDivision.id,
        genero
    })

    if (!divisaoValida.ok) {
        return {
            message: [divisaoValida.motivo],
            values: [resData]
        }
    }

    const classTime = await classifyTime(
        Number(cat.torneio.tempo_torneio_time_digitalTotempo?.time),
        Number(cat.torneio.tempo_torneio_time_digitalTotempo?.plus)
    )

    // T16: nome e ratings oficiais vêm da FIDE/CBX, não do JSON do navegador.
    // Se o site oficial estiver fora do ar, o que já está gravado é preservado
    // (ver `ratingParaGravar`).
    const [consultaFide, consultaCbx] = await Promise.all([
        consultarJogadorOficial(verifyFideId, String(resData.idfide).trim() === '' ? null : String(resData.idfide)),
        consultarJogadorOficial(verifyCbxId, String(resData.idcbx).trim() === '' ? null : String(resData.idcbx))
    ])

    const oficialFide = consultaFide.situacao === 'encontrado' ? consultaFide.player : null

    // T18: valida o comprovante antes de gravar qualquer coisa.
    const fileComprovante = formdata.get('fileComprovante')
    const temComprovante = fileComprovante instanceof File && fileComprovante.size > 0

    if (temComprovante) {
        const validacao = validarComprovante(fileComprovante)

        if (!validacao.ok) {
            return {
                message: [validacao.motivo],
                values: [resData]
            }
        }
    }

    const uuid = String(formdata.get('uuid'))

    try {
        // A posse participa também da escrita: se a inscrição deixar de ser do
        // usuário entre a leitura e a gravação, nada é atualizado.
        const atualizacao = await db.incricao.updateMany({
            where: {
                uuid: uuid,
                id_usuario: user.id
            },
            data: {
                status: 'Pendente',
                uuid_cat: cat.uuid,
                city: resData.city,
                club: resData.team,
                data_nasc: date,
                id_division: defaultDivision.id,
                id_fide: String(resData.idfide).trim() == ''
                    ? null
                    : Number(resData.idfide),
                id_cbx: String(resData.idcbx).trim() == ''
                    ? null
                    : Number(resData.idcbx),
                genre: resData.genre == 'masc',
                name: oficialFide
                    ? oficialFide.name
                    : resData.name,
                // `id_torneio` NÃO é escrito: a inscrição não muda de torneio na
                // edição (T15).
                rtg_fide: ratingParaGravar(consultaFide, classTime, infosAntigasRaw.rtg_fide),
                rtg_cbx: ratingParaGravar(consultaCbx, classTime, infosAntigasRaw.rtg_cbx)
            }
        })

        if (atualizacao.count === 0) {
            return {
                message: ['Não foi possível salvar: a inscrição não pertence a você.'],
                values: [resData]
            }
        }

        const infosNovasRaw = await db.incricao.findFirst({
            where: {
                uuid: uuid,
                id_usuario: user.id
            },
            include: {
                categoria: true,
                divisoes: true,
                usuario: true
            }
        })

        if (!infosNovasRaw) {
            throw new Error("Inscrição não encontrada após atualização")
        }

        const infosNovas: Player = {
            uuid: infosNovasRaw.uuid,
            name: infosNovasRaw.name,
            city: infosNovasRaw.city,
            club: infosNovasRaw.club ?? "",
            genre: infosNovasRaw.genre,
            data_nasc: infosNovasRaw.data_nasc,

            id_fide: Number(infosNovasRaw.id_fide ?? 0),
            id_cbx: Number(infosNovasRaw.id_cbx ?? 0),

            uuid_cat: infosNovasRaw.uuid_cat,
            status: infosNovasRaw.status,
            id_usuario: infosNovasRaw.id_usuario,

            id_division: Number(infosNovasRaw.id_division ?? 0),
            id_torneio: Number(infosNovasRaw.id_torneio),

            rtg_fide: Number(infosNovasRaw.rtg_fide ?? 0),
            rtg_cbx: Number(infosNovasRaw.rtg_cbx ?? 0),

            federation: infosNovasRaw.federation ?? undefined,
            titulo: infosNovasRaw.titulo ?? undefined,

            categoria: {
                name: infosNovasRaw.categoria.name,
                uuid: infosNovasRaw.categoria.uuid,
                id_torneio: Number(infosNovasRaw.categoria.id_torneio),
                min_y: infosNovasRaw.categoria.min_y ?? undefined
            },

            divisoes: {
                name: infosNovasRaw.divisoes
                    ? infosNovasRaw.divisoes.name
                    : '',
                id: Number(
                    infosNovasRaw.divisoes
                        ? infosNovasRaw.divisoes.id
                        : 0
                )
            },

            usuario: {
                id: infosNovasRaw.usuario.id,
                email: infosNovasRaw.usuario.email
            }
        }

        if (temComprovante) {
            const supabaseAdmin = await getSupabaseAdmin()

            const { error } = await supabaseAdmin
                .storage
                .from('publics')
                .upload(
                    `comprovantes/${infosAntigasRaw.id_torneio}/${user.id}/${uuid}`,
                    fileComprovante,
                    {
                        upsert: true,
                        contentType: fileComprovante.type
                    }
                )

            // T18: antes a falha só ia para o log e a tela dizia "Sucesso".
            // Os dados já foram salvos, então a mensagem diz exatamente isso.
            if (error) {
                console.error('Erro ao enviar comprovante:', error)

                return {
                    message: ['Seus dados foram salvos, mas o comprovante não foi enviado. Tente anexá-lo novamente.'],
                    values: [resData]
                }
            }
        }

        await sendUpdateInscriptionEmail(
            infosAntigas,
            infosNovas,
            cat.torneio.title,
            infosNovas.id_torneio
        )

        return {
            message: ['Sucesso', `/minhas-inscricoes/`],
            values: [resData]
        }

    } catch (e) {
        console.error(e)
        throw e
    }
}

