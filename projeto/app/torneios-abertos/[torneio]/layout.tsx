import './unique.css'
import './responsive.css'

import redirectTournment from './redirect'
import { redirect } from 'next/navigation'

import { getSupabaseAdmin } from '@/lib/supabase'
import classifyTime from '@/lib/classifyTime'
import TournamentProvider from '@/components/TournmentProvider';
import type { TournamentCategory, TournamentDivision } from '@/lib/types';

export default async function layoutTorneio({children, params}: {children: React.ReactNode, params: Promise<{ torneio: string }>}) {
    const {torneio} = await params

    const tournment = await redirectTournment(torneio)
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


   
    const supabaseAdmin = await getSupabaseAdmin();

    const id = String(tournment.id)

    // As três listas são independentes, então vão em paralelo (a página abre mais rápido).
    const [folders, qrCodes, regulamentos] = await Promise.all([
        supabaseAdmin.storage.from("publics").list("folders"),
        supabaseAdmin.storage.from("publics").list("qrCodes"),
        supabaseAdmin.storage.from("publics").list("regulamentos"),
    ])

    const publicUrl = (folderName: string) =>
        supabaseAdmin.storage.from("publics").getPublicUrl(`${folderName}/${id}`).data.publicUrl

    const fileExists = (result: { data: { name: string }[] | null, error: unknown }) =>
        !result.error && Boolean(result.data?.some(file => file.name === id))

    const folder = fileExists(folders) ? publicUrl('folders') : null
    const folderQr = fileExists(qrCodes) ? publicUrl('qrCodes') : null
    const reg = fileExists(regulamentos) ? publicUrl('regulamentos') : null
    
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

    // Categorias e divisões vão para o formulário, que escolhe a categoria na hora
    // (sem ida ao servidor). O redirect já devolve os ids como number.
    const categories: TournamentCategory[] = tournment.categoria.map((categoria) => ({
        uuid: categoria.uuid,
        name: categoria.name,
        price: categoria.value,
        minYear: categoria.min_y,
        maxYear: categoria.max_y,
        divisionId: categoria.default_division
    }))

    const divisions: TournamentDivision[] = tournment.divisoes.map((divisao) => ({
        id: divisao.id,
        name: divisao.name,
        genre: divisao.genre,
        isAbsolute: divisao.isAbsolute
    }))
    
    
    

    return (
        <>
            <div id='bars-content' style={{width: '100%', height: '100%', justifyContent: 'center'}}>
                <div id='form-content'>
                    <h1 style={{width: '100%', textAlign: 'start'}} id='torneio-title'>{torneio.split('~').join(' ')}</h1>
                    
                    <div id='informations'>
                        <div id='l1'>
                            <div style={{flexDirection: 'column', gap: '30px'}}>
                                <h2 id='info' style={{textAlign: 'start', fontSize: '22pt'}}>Informações do torneio:</h2>
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
                            <h2>Realizar nova inscrição:</h2>
                            <p className="error">Preencha todos os campos obrigatórios (*)</p>
                
                            <TournamentProvider
                                id={Number(tournment.id)}
                                pixKey={tournment.chave_pix}
                                qrCodeUrl={folderQr}
                                categories={categories}
                                divisions={divisions}
                            >
                                {children}
                            </TournamentProvider>
                        </div>
                    </div>
                </div>
            </div>
        </>
    )
}