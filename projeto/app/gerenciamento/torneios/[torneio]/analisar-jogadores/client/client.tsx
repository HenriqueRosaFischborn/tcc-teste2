'use client'

import InputDate from '@/components/ui/input-date'
// Crtl + alt + j vai pro próximo bookmark e ctrl + alt + k adiciona ou tira

import { Cat, Div, Player } from '@/lib/types'
import Form from 'next/form'
import { useActionState, useEffect, useState } from 'react'
import updateDataBase from './updateDataBase'
import { generateTXT } from './generateTXT'

type Inscricoes = {
    [key: string]: Player
}

async function routeGenerateTXT(players: Inscricoes) {
    const conteudo = generateTXT(players)

    const blob = new Blob([conteudo], {
        type: "text/plain;charset=utf-8",
    });

    const url = URL.createObjectURL(blob);

    const a = document.createElement("a");
    a.href = url;
    a.download = "Exp.TXT";

    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);

    URL.revokeObjectURL(url);
}

export default function BodyClient({nameTournment, players, comprovantes, categories, divisions}: {nameTournment: string, categories: Cat[], divisions: Div[], players: Player[], comprovantes: {[key: string]: string | null}}) {
    const initialValue: {message: string} = {message: ''}
    const [state, formAction] = useActionState(updateDataBase, initialValue)
    const [defaultInscri, setDefaultInscri] = useState<Inscricoes>({})
    const [nowInscri, setNowInscri] = useState<Inscricoes>({})
    // Uuids com data de nascimento incompleta (o botão salvar só libera com todas completas)
    const [invalidDates, setInvalidDates] = useState<string[]>([])
    
    useEffect(() => {
        const dataInscri: Inscricoes = {}
        players.map((el) => {
            dataInscri[el.uuid] = el
        })
        setDefaultInscri(dataInscri)
        setNowInscri(dataInscri)
    }, [])
    
    function handleDateValue(uuid: string, value: string) {
        setInvalidDates(prev => {
            const outros = prev.filter(item => item !== uuid)
            return value.length === 10 ? outros : [...outros, uuid]
        })
    }

    // Aviso mostrado na própria página quando o jogador não anexou comprovante
    const [avisoComprovante, setAvisoComprovante] = useState('')

    function verComprovante(uuid: string, nome: string) {
        const url = comprovantes[uuid]

        if (!url) {
            setAvisoComprovante(`Nenhum comprovante anexado por ${nome}.`)
            return
        }

        setAvisoComprovante('')
        window.open(url, '_blank', 'noopener,noreferrer')
    }

    function updateObjNowSelect(uuid: string, collumn: string, value: string, type: string) {

        let dateValue: Date
        if (type === 'date') {
            const [dia, mes, ano] = value.split('/').map(Number)

            dateValue = new Date(ano, mes - 1, dia)
        }

        setNowInscri(prev => {
            const newValue = type === 'string' ? value : type === 'date' ? '' : type === 'boolean' ? Boolean(value) : Number(value)
            console.log(newValue)
            const updatedPlayer = {
                ...prev[uuid],
                [collumn]: type === 'date' ? dateValue : newValue
            }

            // caso esteja mudando divisão
            if (type === 'division') {
                const validCats = categories.filter(cat =>Number(cat.default_division) === Number(value)).map(cat => cat.uuid)

                const currentCat = prev[uuid].uuid_cat

                const division = divisions.find(d => Number(d.id) === Number(value))

                const stillValid = validCats.includes(currentCat)

                // se não for absoluta e categoria inválida
                if (!division?.isAbsolute && !stillValid) {
                    updatedPlayer.uuid_cat = validCats[0] ?? ''
                }
            }

            return {
                ...prev,
                [uuid]: updatedPlayer
            }
        })
    }


    function reguleSize(input: HTMLInputElement) {
        input.size = input.value.length
    }

    useEffect(() => {
        if (state.message == 'Alterações salvas') {
            setDefaultInscri(nowInscri)
        }
    }, [state])
    
    return (
        <>
            
                <div id='downloads'>
                    <h2>Baixar lista de jogadores:</h2>
                    <div className='buttons'>
                        {/* <button className='button gray' ><img src="/icons/download.png" alt="" fetchPriority='low' loading='lazy' decoding='async'/> PDF</button> */}
                        {/* <button className='button gray' onClick={() => routeGenerateXLS(defaultInscri)}><img src="/icons/download.png" alt="" fetchPriority='low' loading='lazy' decoding='async'/> Swiss Manager (.xlsx)</button>
                        <button className='button gray' onClick={() => routeGenerateCSV(defaultInscri)}><img src="/icons/download.png" alt="" fetchPriority='low' loading='lazy' decoding='async'/> Swiss Manager (.csv)</button> */}
                        <button className='button gray' onClick={() => routeGenerateTXT(defaultInscri)}><img src="/icons/download.png" alt="" fetchPriority='low' loading='lazy' decoding='async'/> Swiss Manager (.txt)</button>
                    </div>
                </div>

                <div id='players'>
                    <h2>Jogadores inscritos:</h2>
                    {/* <div id='div-search-bar'>
                        <input type="text" />
                        <div id='icon-search'>
                            <img src="/icons/search.png" alt="search" fetchPriority='low' loading='lazy' decoding='async'/>
                        </div>
                    </div> */}
                    {avisoComprovante !== '' ? (
                        <p className='error' style={{width: '100%'}}>{avisoComprovante}</p>
                    ) : ('')}
                    {players.length > 0 ? (<>
                    <div id='table'>
                        <table>
                            <thead>
                                <tr>
                                    {/* <th ></th> */}
                                    <th>Status:</th>
                                    <th className='fixa'>Nome:</th>
                                    <th>Comprovante:</th>
                                    <th>ID FIDE:</th>
                                    <th>ID CBX:</th>
                                    <th>Rating FIDE:</th>
                                    <th>Rating CBX:</th>
                                    <th>Titulação</th>
                                    <th>Cidade:</th>
                                    <th>Clube:</th>
                                    <th>Federação:</th>
                                    <th>Data de nascimento:</th>
                                    <th>Gênero:</th>
                                    <th>Divisão:</th>
                                    <th>Categoria:</th>
                                    <th>Email: </th>
                                </tr>
                            </thead>
                            <tbody>
                                {Object.values(nowInscri).map((el, i) => {return (
                                    <tr key={i}>
                                        {/* <td className='input-user' style={{cursor: 'pointer'}} onClick={(e) => {
                                            if (!(e.target instanceof HTMLElement)) return
                                            if (e.target.className == 'input-user') {
                                                const input = e.currentTarget.querySelector('input')
        
                                                if (!(input instanceof HTMLElement)) return
            
                                                input.click()
                                            }
                                        }}>
                                            <div style={{
                                                width: '100%',
                                                alignItems: 'center',
                                                justifyContent: 'center'
                                            }}>
                                                <input type='checkbox' />
                                            </div>
                                        </td>   */}
                                        <td className='select' style={{backgroundColor: nowInscri[el.uuid]?.status !== defaultInscri[el.uuid]?.status ? 'var(--ligthgray)' : '', borderRight: 'solid 2px black', color: nowInscri[el.uuid]?.status == 'Confirmada' ? '#0F7B0F' : nowInscri[el.uuid]?.status == 'Recusada' ? 'red' : 'var(--mainblack)'}}>
                                            <select name="" id="" defaultValue={el.status} onChange={(e) => updateObjNowSelect(el.uuid, 'status', e.currentTarget.value, 'string')}>
                                                <option style={{color: 'green'}} value="Confirmada">Confirmada</option>
                                                <option style={{color: 'var(--mainblack)'}} value="Pendente">Pendente</option>
                                                <option style={{color: 'red'}} value="Recusada">Recusada</option>
                                            </select>
                                        </td>
                                        <td className='fixa' style={{backgroundColor: nowInscri[el.uuid].name !== defaultInscri[el.uuid]?.name ? 'var(--ligthgray)' : ''}}>
                                            <input type="text" defaultValue={el.name} size={el.name.length} onInput={(e) => reguleSize(e.currentTarget)} onChange={(e) => updateObjNowSelect(el.uuid, 'name', e.currentTarget.value, 'string')}/>
                                        </td>  
                                        <td className='comprovante' style={{paddingLeft: '5px'}}>
                                            <button type='button' className='comprovante-link' onClick={() => verComprovante(el.uuid, el.name)}>Ver comprovante</button>
                                        </td>

                                        <td style={{backgroundColor: nowInscri[el.uuid].id_fide !== defaultInscri[el.uuid]?.id_fide ? 'var(--ligthgray)' : ''}}>
                                            <input placeholder='Nenhum' type="text" defaultValue={el.id_fide} size={String(el.id_fide).length} onInput={(e) => reguleSize(e.currentTarget)} onChange={(e) => updateObjNowSelect(el.uuid, 'id_fide', e.currentTarget.value, 'number')}/>
                                        </td>
                                        <td style={{backgroundColor: nowInscri[el.uuid].id_cbx !== defaultInscri[el.uuid]?.id_cbx ? 'var(--ligthgray)' : ''}}>
                                            <input placeholder='Nenhum' type="text" defaultValue={el.id_cbx} size={String(el.id_cbx).length} onInput={(e) => reguleSize(e.currentTarget)} onChange={(e) => updateObjNowSelect(el.uuid, 'id_cbx', e.currentTarget.value, 'number')}/>
                                        </td>
                                        <td style={{backgroundColor: nowInscri[el.uuid].rtg_fide !== defaultInscri[el.uuid]?.rtg_fide ? 'var(--ligthgray)' : ''}}>
                                            <input placeholder='Nenhum' type="text" defaultValue={el.rtg_fide} size={String(el.rtg_fide).length} onInput={(e) => reguleSize(e.currentTarget)} onChange={(e) => updateObjNowSelect(el.uuid, 'rtg_fide', e.currentTarget.value, 'number')}/>
                                        </td>
                                        <td style={{backgroundColor: nowInscri[el.uuid].rtg_cbx !== defaultInscri[el.uuid]?.rtg_cbx ? 'var(--ligthgray)' : ''}}>
                                            <input placeholder='Nenhum' type="text" defaultValue={el.rtg_cbx} size={String(el.rtg_cbx).length} onInput={(e) => reguleSize(e.currentTarget)} onChange={(e) => updateObjNowSelect(el.uuid, 'rtg_cbx', e.currentTarget.value, 'number')}/>
                                        </td>

                                        <td style={{backgroundColor: nowInscri[el.uuid].titulo !== defaultInscri[el.uuid]?.titulo ? 'var(--ligthgray)' : ''}}>
                                            <input type="text" defaultValue={el.titulo ? el.titulo : ''} placeholder={'Nenhum'} size={el.titulo ? el.titulo.length : 6} onInput={(e) => reguleSize(e.currentTarget)} onChange={(e) => updateObjNowSelect(el.uuid, 'titulo', e.currentTarget.value, 'string')}/>
                                        </td> 

                                        <td style={{backgroundColor: nowInscri[el.uuid].city !== defaultInscri[el.uuid]?.city ? 'var(--ligthgray)' : ''}}>
                                            <input type="text" defaultValue={el.city} size={el.city.length} onInput={(e) => reguleSize(e.currentTarget)} onChange={(e) => updateObjNowSelect(el.uuid, 'city', e.currentTarget.value, 'string')}/>
                                        </td> 
                                        <td style={{backgroundColor: nowInscri[el.uuid].club !== defaultInscri[el.uuid]?.club ? 'var(--ligthgray)' : ''}}>
                                            <input type="text" defaultValue={el.club ? el.club : ''} placeholder={'Nenhum'} size={el.club ? el.club.length : 6} onInput={(e) => reguleSize(e.currentTarget)} onChange={(e) => updateObjNowSelect(el.uuid, 'club', e.currentTarget.value, 'string')}/>
                                        </td> 

                                        <td style={{backgroundColor: nowInscri[el.uuid].federation !== defaultInscri[el.uuid]?.federation ? 'var(--ligthgray)' : ''}}>
                                            <input type="text" defaultValue={el.federation} size={el.federation ? el.federation.length : 6} onInput={(e) => {e.currentTarget.value = e.currentTarget.value.toUpperCase(); reguleSize(e.currentTarget)}} onChange={(e) => updateObjNowSelect(el.uuid, 'federation', e.currentTarget.value, 'string')}/>
                                        </td> 
                                        
                                        <td className='date' style={{backgroundColor: nowInscri[el.uuid].data_nasc !== defaultInscri[el.uuid]?.data_nasc ? 'var(--ligthgray)' : ''}}>
                                            <InputDate uuid={el.uuid} updateObjNowSelect={updateObjNowSelect} reguleSize={reguleSize} size={el.data_nasc.toLocaleDateString('pt-BR', {timeZone: 'UTC'}).length} defaultValue={el.data_nasc.toLocaleDateString('pt-BR', {timeZone: 'UTC'})} onValueChange={(value) => handleDateValue(el.uuid, value)}/>
                                        </td>
                                        
                                        <td className='select' style={{backgroundColor: nowInscri[el.uuid]?.genre !== defaultInscri[el.uuid]?.genre ? 'var(--ligthgray)' : ''}}>
                                            <select name="" id="" defaultValue={el.genre ? 'true' : 'false'} onChange={(e) => {updateObjNowSelect(el.uuid, 'genre', e.currentTarget.value, 'boolean')}}>
                                                <option value={'true'}>Masculino</option>
                                                <option value={'false'}>Feminino</option>
                                            </select>
                                        </td>
                                        
                                        <td className='select' style={{backgroundColor: nowInscri[el.uuid]?.id_division !== defaultInscri[el.uuid]?.id_division ? 'var(--ligthgray)' : ''}}>
                                            <select name="" id="" defaultValue={Number(el.divisoes.id)} onChange={(e) => {updateObjNowSelect(el.uuid, 'id_division', e.currentTarget.value, 'division')}}>
                                                {divisions.map((div, i2) => (
                                                    <option key={i2} value={Number(div.id)}>{div.name}</option>
                                                ))}
                                            </select>
                                        </td>
                                        <td className='select' style={{backgroundColor: nowInscri[el.uuid].uuid_cat !== defaultInscri[el.uuid]?.uuid_cat ? 'var(--ligthgray)' : ''}}>
                                            <select name="" className='categorias' value={nowInscri[el.uuid].uuid_cat} onChange={(e) => updateObjNowSelect(el.uuid, 'uuid_cat', e.currentTarget.value, 'string')}>
                                                {categories.filter((cat, i2) => {
                                                    if ((cat.default_division == nowInscri[el.uuid].id_division) || (divisions.filter((d) => d.id == nowInscri[el.uuid].id_division)[0].isAbsolute && cat.uuid == nowInscri[el.uuid].uuid_cat)) {
                                                        return true
                                                    }
                                                }).map((cat, i2) => (
                                                    <option key={i2} value={cat.uuid}>{cat.name} ({divisions.find(d => Number(d.id) === Number(cat.default_division))?.name})</option>
                                                ))}
                                            </select>
                                        </td>

                                        <td className='email'>
                                            {el.usuario.email}
                                        </td>
                                    </tr>
                                )})}
                            </tbody>
                        </table>
                    </div>
                    <Form action={formAction}>
                        <input type="text" hidden name='nameTournment' value={nameTournment}/>
                        <input type="text" hidden name='defaultInscri' value={JSON.stringify(defaultInscri)}/>
                        <input type="text" hidden name='nowInscri' value={JSON.stringify(nowInscri)}/>
                        <button id='save-changes' type='submit' className={`button red ${(JSON.stringify(defaultInscri) != JSON.stringify(nowInscri)) && invalidDates.length === 0 ? '' : 'disableDiv'}`}>Salvar Alterações</button>
                    </Form>
                    {invalidDates.length === 0 ? '' : <p style={{marginTop: '-15px'}} className='error'>*Preencha as datas corretamente</p>}
                    </>) : (
                        <p className='obs'>Nenhum jogador inscrito neste torneio até o momento.</p>
                    )}
                </div>
        </>
    )
}