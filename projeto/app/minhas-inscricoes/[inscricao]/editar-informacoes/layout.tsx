import './unique.css'
import './responsive.css'

import redirectTournment from './redirect'
import { redirect } from 'next/navigation'

import { getSupabaseAdmin } from '@/lib/supabase'
import classifyTime from '@/lib/classifyTime'
import TournamentProvider from '@/components/TournmentProvider';
import { requireUser } from '@/lib/auth-guard'
import db from '@/lib/db'
import { Player } from '@/lib/types'

export default async function layoutEditInfoTorneio({children, params}: {children: React.ReactNode, params: Promise<{ inscricao: string }>}) {
    
    
    const {inscricao} = await params

    // O uuid vem da URL: a consulta precisa exigir que a inscrição pertença ao
    // usuário logado, senão qualquer sessão lê os dados pessoais de outra pessoa.
    const user = await requireUser()

    const inscriData = await db.incricao.findFirst({
        where: {
            uuid: inscricao,
            id_usuario: user.id
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
                    date_inscri: true
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

    if (!inscriData) {
        // Inscrição inexistente ou de outra pessoa: mesmo destino, para não
        // revelar que o uuid existe.
        redirect('/minhas-inscricoes')
    }

    if (!inscriData.divisoes) {
        redirect('/minhas-inscricoes')
    }

    const inscricaoDetails: Player = {
        city: inscriData.city,
        club: inscriData.club ? inscriData.club : '',
        genre: inscriData.genre,
        data_nasc: inscriData.data_nasc,
        uuid_cat: inscriData.uuid_cat,
        status: inscriData.status,
        id_usuario: inscriData.id_usuario,
        id_fide: Number(inscriData.id_fide),
        id_cbx: Number(inscriData.id_cbx),
        uuid: inscriData.uuid,
        name: inscriData.name,
        id_division: Number(inscriData.id_division),
        id_torneio: Number(inscriData.id_torneio),
        rtg_fide: Number(inscriData.rtg_fide),
        rtg_cbx: Number(inscriData.rtg_cbx),
        categoria: {
            name: inscriData.categoria.name,
            uuid: inscriData.categoria.uuid,
            id_torneio: Number(inscriData.categoria.id_torneio),
        },
        divisoes: {
            id: Number(inscriData.divisoes.id),
            name: String(inscriData.divisoes.name),
        },
        usuario: {
            id: inscriData.usuario.id,
            email: inscriData.usuario.email,
        }
    }

    const tournment = await redirectTournment(inscriData.torneio.title.split(' ').join('~'))
    if (!tournment) {
        redirect('/torneios-abertos')
    }

    const dateInscri = tournment.date_inscri.toLocaleDateString('pt-BR')
    const timeInscri = tournment.date_inscri.toLocaleTimeString('pt-BR', {
        hour: '2-digit',
        minute: '2-digit'
    })

    const dateEvent = tournment.date_event.toLocaleDateString('pt-BR')
    const timeEvent = tournment.date_event.toLocaleTimeString('pt-BR', {
        hour: '2-digit',
        minute: '2-digit'
    })


   
    const supabaseAdmin = await getSupabaseAdmin()  
    
    const path = `folders/${tournment.id}`
    const { data } = supabaseAdmin.storage.from('publics').getPublicUrl(path)
    const folder = data.publicUrl

    const pathQr = `qrCodes/${tournment.id}`
    const dataQr = supabaseAdmin.storage.from('publics').getPublicUrl(pathQr)
    const folderQr = dataQr.data.publicUrl
    
    
    const times = {
        digital: {
            time: Number(tournment.tempo_torneio_time_digitalTotempo?.time),
            plus: Number(tournment.tempo_torneio_time_digitalTotempo?.plus)
        },
        analog: {
            time: Number(tournment.tempo_torneio_time_analogTotempo?.time),
            plus: Number(tournment.tempo_torneio_time_analogTotempo?.plus)
        }
    }
    const diference = times.digital.time + ' + ' + times.digital.plus != times.analog.time + ' + ' + times.analog.plus

    const classTime = await classifyTime(times.digital.time, times.digital.plus)
    const classTime2 = await classifyTime(times.analog.time, times.analog.plus)
    
    const path2 = `regulamentos/${tournment.id}`
    const data2 = supabaseAdmin.storage.from('publics').getPublicUrl(path2).data
    const reg = data2.publicUrl

    
    

    return (
        <>
            <div id='bars-content' style={{width: '100%', height: '100%', justifyContent: 'center'}}>
                <div id='form-content'>
                    <h1 style={{width: '100%', textAlign: 'start'}} id='torneio-title'>{tournment.title}</h1>
                    <h1 id='qr-key' hidden>{tournment.chave_pix}</h1>
                    <h1 id='qr-src' hidden>{folderQr}</h1>
                    <h1 id='id' hidden>{tournment.id}</h1>
                    
                    <div id='informations'>
                        <div id='l1' style={{marginBottom: '20px', gap: '30px'}}>
                            <div style={{flexDirection: 'column', gap: '30px'}}>
                                <h2 id='info' style={{textAlign: 'start', fontSize: '22pt'}}>informações do torneio:</h2>
                                {reg ? 
                                    <a href={reg} className='button red' target='_blank' rel="noopener noreferrer">Regulamento</a>
                                : ''}
                                <p className='informations'>
                                    Tempo: 
                                    {diference ? (<>
                                        <br />
                                        Digital: {classTime.charAt(0).toUpperCase() + classTime.slice(1)} ({times.digital.time + ' + ' + times.digital.plus}) <br />
                                        Analógico: {classTime2.charAt(0).toUpperCase() + classTime2.slice(1)} ({times.analog.time + ' + ' + times.analog.plus}) <br />
                                    </>)
                                     : `
                                        ${classTime.charAt(0).toUpperCase() + classTime.slice(1)} (${times.digital.time + ' + ' + times.digital.plus})
                                    `}<br />

                                    Local: <a className='link' target='_blank' href={tournment.local_link ? tournment.local_link : '#'}>{tournment.local}</a><br />
                                    <br />
                                    
                                    {tournment.link_chessresults ? (<>
                                        Chessresults:  <a className='link' target='_blank' href={tournment.link_chessresults}>Clique aqui</a><br />
                                    </>) : ''} 
                                    <br />
                                   
                                    Encerramento das inscrições: <br />
                                    Data: {dateInscri}&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;Hora:  {timeInscri} <br />
                                    <br />
                                    Início: <br />
                                    Data: {dateEvent}&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;Hora: {timeEvent}
                                </p>
                            </div>

                            {folder ? <img id='folder-img' src={folder} alt="folder" fetchPriority='low' loading='lazy' decoding='async'/> : ''} 
                        </div>
                        <div id='l2' style={{ flexDirection: 'column', alignItems: 'start', rowGap: '30px'}}>
                            <h2>Editar informações:</h2>
                            <p className="error">Preencha todos os campos obrigatórios (*)</p>
                
                            <TournamentProvider inscricao={inscricaoDetails} id={Number(tournment.id)}>
                                {children}
                            </TournamentProvider>
                        </div>
                    </div>
                </div>
            </div>
        </>
    )
}