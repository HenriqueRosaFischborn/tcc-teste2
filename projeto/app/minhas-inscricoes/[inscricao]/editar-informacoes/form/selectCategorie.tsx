'use client'
export const dynamic= "force-dynamic"

import InputDate from "@/components/ui/input-date"
import React, { useEffect, useState } from "react"
import searchCat from "./search-cat"
import { FormState, Player } from "@/lib/types"


type FieldsCat = Array<'genre' | 'date'> //array com os elementos permitidos

enum ErrorCat {
    TRUE = 'true',
    FALSE = 'false',
    NONE = 'sem'
}



export function SelectCategorie({inscricao, hasFide, errorInfo, setindividualPrice, blur, state, setDivisions, id}: {inscricao: Player, id: number, hasFide: boolean, errorInfo?: string, setindividualPrice?: Function, blur?: Function, setDivisions?: Function, state: FormState}) {
    const [fieldsCat, setFields] = useState<FieldsCat>(['genre'])
    const [updateCat, setUpdate] = useState<Boolean>(false) // essa const só serve pra quando atualizar, chamar o useEffect de novo, atualizando a cat, ela muda sempre no complete
    const [errorCat, setErrorCat] = useState<ErrorCat>(ErrorCat.NONE)
    

    const [cat, setCat] = useState<any>({})
     

    useEffect(() => {
        async function searchCate() {
            
                if (fieldsCat.indexOf('genre') !== -1 && fieldsCat.indexOf('date') !== -1) {              
                    const inputDate = document.getElementById('input-date')
                    if (!(inputDate instanceof HTMLInputElement)) return 
                    const date = inputDate.value







                    const genre = Array.from(document.querySelectorAll('.radio-genre')).filter((el) => {
                        if (el instanceof HTMLInputElement && el.checked) {
                            return true
                        }
                    })[0].parentElement?.querySelector('h3')?.innerText

                    const res = await searchCat(id, date, String(genre))

                    if (res.error) {
                        setErrorCat(ErrorCat.TRUE)
                    } else {
                        setErrorCat(ErrorCat.FALSE)
                    }

                    
                    if (res.value && res.name && res.uuidCat && res.value) {
                        setCat({
                          
                            name: res.name,
                            value: res.value,
                            uuidCat: res.uuidCat,
                            default_division: res.default_division,
                            absolute_division: res.absolute_division
                        })
                        
                        if (setindividualPrice) {
                            setindividualPrice(res.value)
                        }
                        
                    
                    } else {
                        setCat({
                            hasDivision: false,
                            fide: false,
                            cbx: false,
                            value: 0,
                            name: '',
                            uuidCat: '',
                            default_division: res.default_division,
                            absolute_division: res.absolute_division
                        })
                        if (setindividualPrice) {
                            setindividualPrice(0)
                        }
                        if (setDivisions) {
                            setDivisions({
                                fide: false,
                                cbx: false
                            })
                        }
                    }
                }
            
        }

        searchCate()

    }, [updateCat, fieldsCat])

    const [dfChecked, setChek] = useState<boolean>(true)
    const [dfChecked2, setChek2] = useState<boolean>(true)

    useEffect(() => {

        if (state.values && state.values[0] && state.values[0]) {
            console.log(state.values[0].genre)
            console.log(state.values[0].division)
        }

        if (state.values && state.values[0] && state.values[0].genre === 'fem') {
            setChek2(false)
            
            document.getElementById('input-date')?.focus()
            document.getElementById('input-date')?.blur()
            
            
        } 

        if (state.values && state.values[0] && state.values[0].division === 'superior') {
            setChek(false)
            document.getElementById('input-date')?.focus()
            document.getElementById('input-date')?.blur()
            
            
        }
    }, [state.values])

    useEffect(() => {
        setChek(dfChecked)
        setChek2(dfChecked2)
    },  [state.values])

    // function divClick(e: React.MouseEvent) { // serve pra poder clicar na div tbm
    //         const x = e.currentTarget.querySelector('input')
    //         if (!x) return
    //         if (x.checked == false) {
    //             setChek(!dfChecked)
    //         } 
    // }

    // function divClick2(e: React.MouseEvent) { // serve pra poder clicar na div tbm
    //         const x = e.currentTarget.querySelector('input')
    //         if (!x) return
    //         if (x.checked == false) {
    //             setChek2(!dfChecked2)
    //         } 
    // }

    function defineDate(date: string) {
        const complete = date.split('').length == 10
        if (complete) {
            if (fieldsCat.indexOf('date') == -1) {
                setFields(prev => [...prev, 'date'])
            }
            setUpdate(!updateCat)
        } else {
            if (fieldsCat.indexOf('date') !== -1) {
                setFields(prev => prev.filter((el, i) => el !== 'date'))
            }
            if (setindividualPrice) {
                setindividualPrice(0)
            }
        }
        if (blur) blur()
    }
    
    
    return (

        <>
            <div style={{width: '35%'}}>
                <label htmlFor="borndate">Data de nascimento: <p className="ast">*</p></label>
                <InputDate blur={defineDate} state={state} defaultValue={inscricao.data_nasc.toLocaleDateString('pt-BR', {
                    timeZone: 'UTC',
                })}/>
            </div>
            
            <div className="genre" style={{flexDirection: 'column', alignItems: 'start'}}>
                <div style={{flexDirection: 'row', gap: '10px', cursor: 'pointer'}}>
                    <input className="radio-genre" checked={dfChecked2} type="radio" name="genre" value={'masc'} onChange={() => {
                        setChek2(true)
                        
                        const date = document.querySelector('#input-date')

                        if (date instanceof HTMLInputElement && date.value.trim() != '') {
                            defineDate(date.value)
                        }

                        if (blur) {
                            blur()
                        }
                    }} /><h3>Masculino</h3>
                </div>
                <div style={{flexDirection: 'row', gap: '10px', cursor: 'pointer'}}>
                    <input className="radio-genre" id="df2" checked={!dfChecked2} type="radio" name="genre" value={'fem'} onChange={() => {
                        setChek2(false)
                        
                        const date = document.querySelector('#input-date')

                        if (date instanceof HTMLInputElement && date.value.trim() != '') {
                            defineDate(date.value)
                        }

                        if (blur) {
                            blur()
                        }
                    }} /><h3>Feminino</h3>
                </div>
            </div> 
            {hasFide && errorInfo != '' ? <p className="error">{errorInfo}</p> : ''}
            
            {errorCat == 'true' ? (
                <p className="error">Nenhuma categoria deste torneio abrange sua idade</p>
            ) : ('')}

            {fieldsCat.indexOf('genre') !== -1 && fieldsCat.indexOf('date') !== -1 && !(errorCat == 'true') && ((hasFide && !errorInfo) || !hasFide) ? (
                <div className="div-categorie" style={{width: '100%', flexDirection: 'row'}}>
                    <div style={{width: 'calc(50% - 15px)', alignItems: 'start'}}>
                        <label htmlFor="">Categoria:</label>
                        <input type="text" hidden={true} name="uuidCat" value={String(cat.uuidCat)}/>
                        
                        <div className="categorie input">
                            <h3 style={{textAlign: 'start'}}>{isNaN(Number(cat.value)) ? ('Carregando...') : (`     
                                ${cat.name} - ${dfChecked2 ? 'Masculino' : 'Feminino'} - ${new Intl.NumberFormat('pt-BR', {
                                    style: 'currency',
                                    currency: 'BRL'
                                }).format(Number(cat.value))}
                            `)} 
                            </h3>
                        </div>

                        <p className="obs">*A categoria selecionada pode não corresponder exatamente a sua idade por não estar disponível neste torneio. Nesse caso, o sistema escolherá automaticamente a categoria mais adequada</p>  
                    </div>
                    
                    {cat.absolute_division && cat.absolute_division != cat.default_division ? (
                        <div className="division" style={{width: 'calc(50% - 15px)'}}>
                            <label>Divisão:</label>
                            <div style={{flexDirection: 'row', gap: '10px', alignItems: 'center', cursor: 'pointer'}} >
                                <input name='division' type="radio"  checked={dfChecked}  onChange={() => setChek(true)} value={cat.default_division}/><div style={{flexDirection:'row', gap:'10px', alignItems: 'center'}}><h3>{cat.default_division}</h3><p className="obs">(recomendado)</p></div>
                            </div>
                            <div  style={{flexDirection: 'row', gap: '10px', alignItems: 'center', cursor: 'pointer'}} >
                                <input id="df" name='division' type="radio" checked={!dfChecked} onChange={() => setChek(false)} value={cat.absolute_division}/><h3>{cat.absolute_division}</h3>
                            </div>
                        </div>

                    ) : ('')}
                </div>

    
            ) : (
                <div id="warning-box">
                    <p>*Preencha a data de nascimento e o gênero corretamente para obter sua categoria</p>
                </div>
            )}
        </>
    )
}

// console.log