'use client'

import InputDate from '@/components/ui/input-date'
import Form from 'next/form'
import { useActionState, useState } from 'react'
import addTournmentForm from './action'
import CategorieArea from './categories/catArea'
import { NewTournment } from '@/lib/types'
import { verifyEmail } from '@/app/(auth)/cadastro/form/verify-types'
import InputHour from '@/components/ui/input-hour'

type Division = {
    name: string,
    isAbsolute: boolean,
    genre: string
}

export default function AddTournmentForm({times}: {times?: {time: number, plus: number}[]}) {
    const initialValue: NewTournment = {}
    const [state, formAction] = useActionState(addTournmentForm, initialValue)

    const [errorCategories, setErrorCategories] = useState<boolean>(false)

    function changeErrorCategories(value: boolean) {
    console.log("setErrorCategories:", value)
    setErrorCategories(value)
}

    const [dateError, setDateError] = useState<boolean>(false)

    const [emails, setEmails] = useState<string[]>([])
    const [emailError, setEmailError] = useState<string>('')

    function removeEmail(index: number) {
        setEmails(prev => prev.filter((el, i) => i != index))
    }

    const [hasDivision, setHasDivision] = useState<boolean>(false)


    const [nameFolder, setNameFolder] = useState<string>('')
    const [nameReg, setNameReg] = useState<string>('')
    const [nameQr, setNameQr] = useState<string>('')

    function uploadFile(file: string, qr?: boolean) {
        const fileName = String(file.split('\\').at(-1))
        const extension = fileName.split('.').at(-1)

        if (extension == 'pdf') {
            setNameReg(fileName)
        } else {
            if (qr) {
                setNameQr(fileName)
            } else {
                setNameFolder(fileName)
            }
        }
    }

    

    async function giveEmail() {
        const input = document.querySelector('#input-email')

        if (!(input instanceof HTMLInputElement)) return

        const value = input.value

        const x = await verifyEmail(value)

        if (value.trim() == '' || !x) {
            setEmailError('Este não é um email válido')
        } else {
            if (emails.includes(value)) {
                setEmailError('Este email já está cadastrado')
            } else {
                setEmailError('')
                setEmails(prev => [...prev, value])
                input.value = ''
            }        
        }
    }

    const [txtNeed, setTxtNeed] = useState<boolean>(false)

    const [errorInputDate1, setErrorInputDate1] = useState<boolean>(false)
    const [errorInputDate2, setErrorInputDate2] = useState<boolean>(false)
    function completeBlur() {
        const neededs = Array.from(document.querySelectorAll('.needed')).map(el => {
            if (el instanceof HTMLInputElement) {
                return el.value
            }
        })

        const isComplete = neededs.every(el => el?.trim() != '')

        const x = document.getElementById('timeDigital') as HTMLSelectElement
        const y = document.getElementById('timeAnalog') as HTMLSelectElement

        if (x.value == '' || y.value == '') {
            setTxtNeed(false)
        } else {
            setTxtNeed(isComplete)
        }

        const inputDates = Array.from(document.querySelectorAll('.input-date'))

        

        inputDates.map((el, i) => {
           
            if (el instanceof HTMLInputElement) {
                if (el.value.split('').length != 10 && el.value != '') {
                    
                    if (i == 0) {
                        setErrorInputDate1(true)
                    } else {
                        setErrorInputDate2(true)
                    }
                } else {
                    if (i == 0) {
                        setErrorInputDate1(false)
                    } else {
                        setErrorInputDate2(false)
                    }
    
                }
            }
        })

        if (errorInputDate1 || errorInputDate2) {
            setTxtNeed(false)
        } else {
            setTxtNeed(isComplete)
        }

        if (!(inputDates[0] instanceof HTMLInputElement)) return
        if (!(inputDates[1] instanceof HTMLInputElement)) return
        const [d1, m1, y1] = inputDates[0].value.split('/').map(Number)
        const [d2, m2, y2] = inputDates[1].value.split('/').map(Number)

        const date1 = new Date(y1, m1 - 1, d1)
        const date2 = new Date(y2, m2 - 1, d2)

        if (date1 < date2) {
            setDateError(true)
            setTxtNeed(false)
        } else {
            setDateError(false)
            setTxtNeed(isComplete)
            //changeerro
        }
    }

    const [errorLocal, setErrorLocal] = useState<boolean>(false)
    function localBlur(value: string) {
        if (value != '' && !(value.startsWith('https://maps.app.goo.gl/'))) {
            setErrorLocal(true)
        } else {
            setErrorLocal(false)
            
        }
    }

    const [errorHour, setErrorHour] = useState<boolean>(false)
    function hourBlur(input: HTMLInputElement) {
        completeBlur()

        if (input.value.split('').length != 5) {
            setErrorHour(true)
        } else {
            setErrorHour(false)
        }
    }
    


    if (state.message && state.message == 'Sucesso') {
        window.location.href = '/gerenciamento/torneios'
    }























    const [divisions, setDivisions] = useState<Division[]>([])
    const [divisionError, setDivisionError] = useState<string>('')

    async function giveDivision() {
        const inputName = document.querySelector('#input-division') as HTMLInputElement
        
        const genre = Array.from(document.querySelectorAll('.genre-division-radio')).filter(el => el instanceof HTMLInputElement && el.checked)[0].parentElement?.querySelector('label')?.innerText as string
        const isAbsolute = document.querySelector('#isAbsolute') as HTMLInputElement
        const name = inputName.value

        
        if (divisions.some(el => el.name == name)) {
            setDivisionError('Uma divisão de mesmo nome já foi cadastrada')
        } else {
            if (isAbsolute.checked && divisions.some(el => el.isAbsolute == true)) {
                setDivisionError('Só pode haver uma divisão com esta opção selecionada')
            } else {
                setDivisionError('')
                setDivisions(prev => [...prev, {
                    genre: genre,
                    name: name,
                    isAbsolute: isAbsolute.checked
                }])
                inputName.value = ''
                console.log(divisions)
            }
        }        
        
    }

    function removeDivision(index: number) {
        setDivisions(prev => prev.filter((el, i) => i != index))
    }



    return (
        <>
            <Form action={formAction} onKeyDown={(e) => {
                if (e.key === "Enter") {
                e.preventDefault()
                }
            }}>
                <div id='content'>
                    <div className='form' style={{width: '100%'}}>
                    <h1>Adicionar torneio</h1>
                    <p style={{width: '100%'}} className='error'>Preencha todos os campos obrigatórios (*)</p>
                        <div style={{width: 'calc(50% - 15px)'}}>
                            <label htmlFor="title">Título: <p className='ast'>*</p></label>
                            <input type="text" name='title' className='needed' onBlur={completeBlur}/>
                        </div>
                        <div id='times' style={{width: 'calc(50% - 15px)'}}>
                            <div>
                                <label htmlFor="timeAnalog">Tempo analógico:<p className='ast'>*</p></label>
                                {times ? (
                                    <select  name="timeAnalog" id="timeAnalog" onBlur={completeBlur}>  
                                        <option style={{display: 'none'}} value=""></option>
                                        {times.map((el, i) => {
                                            return (
                                                <option key={i} value={`${el.time}+${el.plus}`} >{el.time} + {el.plus}</option>
                                            )
                                        })}
                                    </select>
                                ) : (
                                    <input style={{flex: 1}} type="text" value={'Não há tempos cadastrados'} readOnly/>
                                )}
                            </div>
                            <div>
                                <label htmlFor="timeDigital">Tempo digital:<p className='ast'>*</p></label>
                                {times ? (
                                    <select name="timeDigital" id="timeDigital" onBlur={completeBlur}>  
                                        <option style={{display: 'none'}} value=""></option>
                                        {times.map((el, i) => {
                                            return (
                                                <option key={i} value={`${el.time}+${el.plus}`} >{el.time} + {el.plus}</option>
                                            )
                                        })}
                                    </select>
                                ) : (
                                    <input style={{flex: 1}} type="text" value={'Não há tempos cadastrados'} readOnly/>
                                )}
                            </div>
                        </div>

                        {/* <div className='division'>
                            <input type="checkbox" name='division' onChange={() => {setHasDivision(!hasDivision)}}/>
                            <label htmlFor="fide">{hasDivision ? 'COM' : 'SEM'} DIVISÃO (ESCOLAR/SUPERIOR)</label>
                        </div> */}

                        <div style={{width: '100%'}}>
                            <label htmlFor="link-chess-results">Link chess results:</label>
                            <input type="text" name='link-chess-results' onBlur={completeBlur}/>
                        </div>

                        <div style={{width: '100%'}} id='local'>
                            <div>
                                <label htmlFor="local">Local:<p className='ast'>*</p></label>
                                <input type="text" name='local' onBlur={completeBlur} className='needed'placeholder='Ex.: Shopping Center - Rua tal'/>
                            </div>
                            <div>
                                <label htmlFor="localLink">Link do local (google maps):</label>
                                <div style={{flex: 1, flexDirection: 'column', height: 'fit-content'}}>
                                    <input type="text" name='localLink' onBlur={(e) => {completeBlur(); localBlur(e.currentTarget.value)}} placeholder='https://maps.app.goo.gl/...'/>
                                    {errorLocal ? ( <p className='error'>*Este não é um link válido</p> ) : ('')}
                                </div>
                            </div>
                        </div>

                        <div style={{width: '40%'}}>
                            <label >Data do evento: <p className='ast'>*</p></label>
                            <InputDate multiple='sim' blur={completeBlur} now={true}/>
                            {errorInputDate1 ? ( <p className='error'>*Esta não é uma data válida</p> ) : ('')}
                        </div>
                        <div style={{width: '35%'}}>
                            <label htmlFor="hour">Hora: <p className='ast'>*</p></label>
                            <InputHour blur={hourBlur}/>
                        </div>
                        <div style={{width: '40%'}}>
                            <label >Data de encerramento das inscrições: <p className='ast'>*</p></label>
                            <InputDate multiple='sim' blur={completeBlur} now={true}/>
                            {errorInputDate2 ? ( <p className='error'>*Esta não é uma data válida</p> ) : ('')}
                            {!errorInputDate2 && dateError ? ( <p className='error'>*A data de encerramento das inscrições não pode ser maior que a data do evento</p> ) : ('')}
                        </div>
                        <div style={{width: '35%'}}>
                            <label htmlFor="hour">Hora: <p className='ast'>*</p></label>
                            <InputHour blur={hourBlur}/>
                            
                        </div>
                    </div>
                </div>










                <div id='divisions' style={{width: '100%'}}>
                    <h3 style={{width: '100%'}}>Divisões de adversários:<p className='ast'>*</p></h3>
                    <div className='form' style={{width: 'calc(50% - 15px)'}}>
                        <div  style={{width: '100%'}}>
                            <label >Nome da divisão:</label>
                            <input id='input-division' type="text" onBlur={completeBlur}/>
                        </div>
                        <div className='genre-division' style={{width: '100%', flexDirection: 'row'}}>
                            <div>
                                <input className='genre-division-radio' name='genre-division' type="radio" defaultChecked/>
                                <label>Masculino/Feminino</label>
                            </div>
                            <div>
                                <input className='genre-division-radio' name='genre-division' type="radio"/>
                                <label>Masculino</label>
                            </div>
                            <div>
                                <input className='genre-division-radio' name='genre-division' type="radio"/>
                                <label>Feminino</label>
                            </div>
                        </div>
                        <div style={{width: '100%', flexDirection: 'row', gap: '15px', alignItems: 'center'}}>
                            <input id='isAbsolute' type="checkbox"/>
                            <label htmlFor="">Permitir que jogadores de outras categorias possam jogar nesta categoria <br />(recomendado para divisões do tipo absoluto)</label>
                        </div>
                        {divisionError != '' ? (
                            <p className='error'>{divisionError}</p>
                        ) : ('')}
                        <button onClick={() => giveDivision()} type='button' className='button black'>Adicionar divisão</button>
                    </div>                
                    <table>
                        <thead>
                            <tr><th>Divisões:</th></tr>
                        </thead>
                        <tbody>
                            {divisions.length > 0 ? (
                                <>
                                    {divisions.map((el, i) => {
                                        return (
                                            <tr key={i}>
                                                <td>
                                                    <div className='td-width'>
                                                        <p>{el.name}</p>
                                                        <img onClick={(e) => {
                                                            
                                                            if (!(e.currentTarget.parentElement?.firstChild instanceof HTMLElement)) return
                                                            removeDivision(i)
                                                        }} style={{cursor: 'pointer'}} src="/icons/cancel-red.png" alt="" />
                                                    </div>
                                                </td>
                                            </tr>
                                        )
                                    })}
                                </>
                            ) : (
                                <tr>
                                    <td>
                                        <div className='td-width'>
                                            <p>Não há divisões cadastradas</p>
                                        </div>
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                    
                    {divisions.length > 0 ? '' : <p style={{width: '100%'}} className='error'>*Adicione ao menos uma divisão de adversários para adicionar categorias ao torneio</p>}
                </div>
                





















                
                <CategorieArea divisionsBasic={divisions} setErrorCategories={changeErrorCategories}/>


                {/* <div id='discount' className='content' hidden>
                    <h3>Descontos:</h3>
                    <div className='form' style={{width: 'calc(50% - 15px)'}}>
                        <div style={{width: 'calc(50% - 15px)'}}>
                            <label htmlFor="disNumPlayers">Número de jogadores para desconto:</label>
                            <input type="number" name='disNumPlayers' onBlur={completeBlur}/>
                        </div>
                        <div style={{width: 'calc(50% - 15px)'}}>
                            <label htmlFor="disPrice">Valor (%):</label>
                            <input type="number" name='disPrice' onBlur={completeBlur}/>
                        </div>
                        <button className='button black'>Adicionar desconto</button>
                    </div>
                    
                    <table>
                        <thead>
                            <tr><th>Descontos:</th></tr>
                        </thead>
                        <tbody>
                            <tr>
                                <td>
                                    <div className='td-width'>
                                        <p>10% para 10 jogadores</p>
                                        <img src="/icons/cancel-red.png" alt="" fetchPriority='low' loading='lazy' decoding='async'/>  
                                    </div>
                                </td>
                            </tr>
                        </tbody>
                    </table>
                </div> */}
                

                <div id='emails'>
                    <h3>Emails de envio da lista de jogadores:</h3>
                    <div className='form' style={{width: 'calc(50% - 15px)'}}>
                        <div  style={{width: '100%'}}>
                            <label >Email:</label>
                            <input id='input-email' type="text" onBlur={completeBlur}/>
                            {emailError != '' ? (
                                <p className='error'>{emailError}</p>
                            ) : ('')}
                        </div>
                        <button onClick={() => giveEmail()} type='button' className='button black'>Adicionar email</button>
                    </div>
                    
                        <table>
                            <thead>
                                <tr><th>Emails:</th></tr>
                            </thead>
                            <tbody>
                                {emails.length > 0 ? (
                                    <>
                                        {emails.map((el, i) => {
                                            return (
                                                <tr key={i}>
                                                    <td>
                                                        <div className='td-width'>
                                                            <p>{el}</p>
                                                            <img onClick={(e) => {
                                                                
                                                                if (!(e.currentTarget.parentElement?.firstChild instanceof HTMLElement)) return
                                                                removeEmail(i)
                                                            }} style={{cursor: 'pointer'}} src="/icons/cancel-red.png" alt="" />
                                                        </div>
                                                    </td>
                                                </tr>
                                            )
                                        })}
                                    </>
                                ) : (
                                    <tr>
                                        <td>
                                            <div className='td-width'>
                                                <p>Não há emails cadastrados</p>
                                            </div>
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                        
                    
                </div>
                <input name='emails' type="text" hidden value={JSON.stringify(emails)} />

                <div className='buttons'>
                    <div id='qr-area' className='upload-file'>
                        
                        <button onClick={() => document.getElementById('input-qr')?.click()} type='button' className='button red'>Anexar QR Code</button>
                        <input onChange={(e) => uploadFile(e.currentTarget.value, true)} type='file' id='input-qr' name='fileQr' accept='image/*' hidden={true}/>
                    
                        <div style={{flex: 1}}>
                            <h3>Chave Pix:</h3>
                            <input type="text" name='chave-pix'/>
                        </div>
                        <div style={{width: '100%'}}>
                            {nameQr != '' ? (
                                <p>({nameQr})</p>
                            ) : ('')}
                        </div>
                    </div>

                    <div className='upload-file'>
                        <button onClick={() => document.getElementById('input-folder')?.click()} type='button' className='button red'>Anexar folder</button>
                        {nameFolder != '' ? (
                            <p>({nameFolder})</p>
                        ) : ('')}
                        <input onChange={(e) => uploadFile(e.currentTarget.value)} type='file' id='input-folder' name='fileFolder' accept='image/*' hidden={true}/>
                    </div>

                    <div className='upload-file'>
                        <button onClick={() => document.getElementById('input-reg')?.click()} type='button' className='button red'>Anexar regulamento <span style={{fontSize: '10pt'}}>(.pdf)</span></button>
                        {nameReg != '' ? (
                            <p>({nameReg})</p>
                        ) : ('')}
                        <input onChange={(e) => uploadFile(e.currentTarget.value)} type='file' id='input-reg' name='fileReg' accept='.pdf' hidden={true}/>     
                    </div>


                    <div style={{
                        widows: '100%',
                        justifyContent: 'end',
                        flexDirection: 'row',
                    }}>
                        <button type='submit' className={`button red big ${!(divisions.length > 0) || !txtNeed || errorCategories || errorLocal || errorHour ? 'disableDiv' : ''}`} >Adicionar torneio</button>
                    </div>
                </div>
            </Form> 
        </>
    )
}