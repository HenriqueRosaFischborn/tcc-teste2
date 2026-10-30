import './unique.css'
import './responsive.css'
import { auth } from '@/auth'
import db from '@/lib/db'
import { getSupabaseAdmin } from '@/lib/supabase'
import ButtonCancelSolicitation from './buttonCancelSolicitation'
import { Player } from '@/lib/types'


export default async function MyInscriptions() {
    const dateNow = new Date()
    const isMobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
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
    
    const folders: { [key: string]: string } = {}

    const torneiosUnicos = Array.from(
        new Map(inscri.map(item => [item.torneio.id, item.torneio])).values()
    )

    
    for (const torneio of torneiosUnicos) {
        const pathFolder = `folders/${torneio.id}`;

        const { data, error } = await supabaseAdmin.storage
        .from("publics")
        .list("folders");

        if (!error && data.some(file => file.name === String(torneio.id))) {
        const publicUrl = supabaseAdmin.storage
            .from("publics")
            .getPublicUrl(pathFolder)
            .data.publicUrl;

        folders[torneio.title.split(" ").join("~")] = publicUrl;
        }
    }
    
    
    
    return (
        <>
            <div id="tournaments">
                <h1>Minhas Inscrições</h1>
                {inscri.filter(el => el.torneio.date_inscri > dateNow && el.torneio.inscri_closed_by_arbiter === false).length > 0 ? inscri.filter(el => el.torneio.date_inscri > dateNow && el.torneio.inscri_closed_by_arbiter === false).map((el, i) => {
                    
                    const dateInscri = el.torneio.date_inscri.toLocaleDateString('pt-BR')
                    const timeInscri = el.torneio.date_inscri.toLocaleTimeString('pt-BR', {
                        hour: '2-digit',
                        minute: '2-digit'
                    })

                    if (!el.divisoes) return

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

                    if (isMobile) {
                        console.log('status: ', el.status)
                        return(
                        // i é o número de repetição do negócio
                        <div className="tournament" key={i}>
                            <div className="content">
                            {/* <div className='text-content'>

                            </div> */}
                            <div className="informations">
                            <h3>{el.torneio.title}</h3>
                            {el.status == 'Confirmada' ? (
                                <p><strong>Status: <span style={{color: 'green'}}>Confirmada</span> </strong></p>
                            ) : el.status == 'Pendente' ? (
                                <p><strong>Status: <span style={{color: '#838383'}}> Pendente</span>  </strong></p>
                            ) : (
                                <p><strong>Status: <span style={{color: 'red'}}>Cancelada</span> </strong></p>
                            )}
                                <p>
                                    <strong>Nome:</strong> {el.name}<br />
                                    <br />
    
                                    <strong>Data de nascimento:</strong> {el.data_nasc.toLocaleDateString('pt-BR')} <br />
                                    <br />
                                </p>
    
                                <p>
                                    <strong>Email:</strong> {el.usuario.email}<br />
                                    <br />
                                </p>
    
                                <p>
                                    <strong>Categoria:</strong> {el.categoria.name} <br />
                                    <br />
    
                                    <strong>Valor:</strong> {new Intl.NumberFormat('pt-BR', {
                                        style: 'currency',
                                        currency: 'BRL'
                                    }).format(Number(el.categoria.value))} <br />
                                    <br />
                                </p>
                            </div>
                            {folders[el.torneio.title.split(' ').join('~')] ? (
                                <img src={folders[el.torneio.title.split(' ').join('~')]} alt="torneio" fetchPriority='low' loading='lazy' decoding='async'/>
                            ) : ''}
                            </div>
                            
                            {el.status == 'Recusada' ? (
                                <>
                                    <span className='r'>Esta inscrição foi cancelada. Caso tenha ocorrido algum erro, contate o árbitro.</span>
                                </>
                            ) : (
                                <>
                                    <span className='r'>Você só poderá atualizar sua inscrição até {dateInscri} às {timeInscri}</span>
                                    <div className='pbuttons'>
                                        <a href={`/minhas-inscricoes/${el.uuid}/editar-informacoes`} className="button blue">Editar informações</a>
                                        <ButtonCancelSolicitation torneioID={Number(el.torneio.id)} inscricao={inscricaoDetails} torneio={el.torneio.title}/>
                                    </div>
                                </>
                            )}


                        </div>
                        )
                    } else {
                        return(
                        // i é o número de repetição do negócio
                        <div className="tournament" key={i}>
                            <div className="content">
                            <h3>{el.torneio.title}</h3>
                            {el.status == 'Confirmada' ? (
                                <p><strong>Status: <span style={{color: 'green'}}>Confirmada</span> </strong></p>
                            ) : el.status == 'Pendente' ? (
                                <p><strong>Status: <span style={{color: '#838383'}}> Pendente</span>  </strong></p>
                            ) : (
                                <p><strong>Status: <span style={{color: 'red'}}>Cancelada</span> </strong></p>
                            )}
                            <div className="informations">
                                <p>
                                    <strong>Nome:</strong> {el.name}<br />
                                    <br />
    
                                    <strong>Data de nascimento:</strong> {el.data_nasc.toLocaleDateString('pt-BR')} <br />
                                    <br />
                                </p>
    
                                <p>
                                    <strong>Email:</strong> {el.usuario.email}<br />
                                    <br />
                                </p>
    
                                <p>
                                    <strong>Categoria:</strong> {el.categoria.name} <br />
                                    <br />
    
                                    <strong>Valor:</strong> {new Intl.NumberFormat('pt-BR', {
                                        style: 'currency',
                                        currency: 'BRL'
                                    }).format(Number(el.categoria.value))} <br />
                                    <br />
                                </p>
                            </div>
                            {el.status == 'Recusada' ? (
                                <>
                                    <span className='r'>Esta inscrição foi cancelada. Caso tenha ocorrido algum erro, contate o árbitro.</span>
                                </>
                            ) : (
                                <>
                                    <span className='r'>Você só poderá atualizar sua inscrição até {dateInscri} às {timeInscri}</span>
                                    <div className='pbuttons'>
                                        <a href={`/minhas-inscricoes/${el.uuid}/editar-informacoes`} className="button blue">Editar informações</a>
                                        <ButtonCancelSolicitation torneioID={Number(el.torneio.id)} inscricao={inscricaoDetails} torneio={el.torneio.title}/>
                                    </div>
                                </>
                            )}
                            </div>
                            {folders[el.torneio.title.split(' ').join('~')] ? (
                                <img src={folders[el.torneio.title.split(' ').join('~')]} alt="torneio" fetchPriority='low' loading='lazy' decoding='async'/>
                            ) : ''}
                        </div>
                        )

                    }
                    
                    }) : (<>
                    <p className="obs">Não há inscrições recentes cadastradas no momento</p>
                </>)}

                <h1>Minhas Inscrições de Torneios Anteriores</h1>
                {inscri.filter(el => !(el.torneio.date_inscri > dateNow && el.torneio.inscri_closed_by_arbiter === false)).length > 0 ? inscri.filter(el => !(el.torneio.date_inscri > dateNow && el.torneio.inscri_closed_by_arbiter === false)).map((el, i) => {
                    
                    const dateInscri = el.torneio.date_inscri.toLocaleDateString('pt-BR')
                    const timeInscri = el.torneio.date_inscri.toLocaleTimeString('pt-BR', {
                        hour: '2-digit',
                        minute: '2-digit'
                    })

                    if (!el.divisoes) return

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

                    
                    
                    if (isMobile) {
                        return(
                        // i é o número de repetição do negócio
                        <div className="tournament disableDiv" key={i}>
                            <div className="content">
                            {/* <div className='text-content'>

                            </div> */}
                            <div className="informations">
                            <h3>{el.torneio.title}</h3>
                            
                                <p>
                                    <strong>Nome:</strong> {el.name}<br />
                                    <br />
    
                                    <strong>Data de nascimento:</strong> {el.data_nasc.toLocaleDateString('pt-BR')} <br />
                                    <br />
                                </p>
    
                                <p>
                                    <strong>Email:</strong> {el.usuario.email}<br />
                                    <br />
                                </p>
    
                                <p>
                                    <strong>Categoria:</strong> {el.categoria.name} <br />
                                    <br />
    
                                    <strong>Valor:</strong> {new Intl.NumberFormat('pt-BR', {
                                        style: 'currency',
                                        currency: 'BRL'
                                    }).format(Number(el.categoria.value))} <br />
                                    <br />
                                </p>
                            </div>
                            {folders[el.torneio.title.split(' ').join('~')] ? (
                                <img src={folders[el.torneio.title.split(' ').join('~')]} alt="torneio" fetchPriority='low' loading='lazy' decoding='async'/>
                            ) : ''}
                            </div>
                        </div>
                        )
                    } else {
                        return(
                        // i é o número de repetição do negócio
                        <div className="tournament disableDiv" key={i}>
                            <div className="content">
                            <h3>{el.torneio.title}</h3>
                            
                            <div className="informations">
                                <p>
                                    <strong>Nome:</strong> {el.name}<br />
                                    <br />
    
                                    <strong>Data de nascimento:</strong> {el.data_nasc.toLocaleDateString('pt-BR')} <br />
                                    <br />
                                </p>
    
                                <p>
                                    <strong>Email:</strong> {el.usuario.email}<br />
                                    <br />
                                </p>
    
                                <p>
                                    <strong>Categoria:</strong> {el.categoria.name} <br />
                                    <br />
    
                                    <strong>Valor:</strong> {new Intl.NumberFormat('pt-BR', {
                                        style: 'currency',
                                        currency: 'BRL'
                                    }).format(Number(el.categoria.value))} <br />
                                    <br />
                                </p>
                            </div>
                            </div>
                            {folders[el.torneio.title.split(' ').join('~')] ? (
                                <img src={folders[el.torneio.title.split(' ').join('~')]} alt="torneio" fetchPriority='low' loading='lazy' decoding='async'/>
                            ) : ''}
                        </div>
                        )

                    }
                    }) : (<>
                    <p className="obs">Não há inscrições anteriores cadastradas no momento</p>
                </>)}
            </div>
        </>
    )
}