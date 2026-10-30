'use client'

import { useEffect, useState } from "react"
import verifyCategorieDates from "./verifydates"
import { isAbsolute } from "path"
import { Tournment } from "@/lib/types"

type Categorie = {
    name: string,
    value: string,
    from: number,
    to: number,
    divisionFor: string
}

type Division = {
    name: string,
    isAbsolute: boolean,
    genre: string,
    categories?: Categorie[]
}

export default function CategorieArea({defaultDivisions, divisionsBasic, setErrorCategories}: {defaultDivisions: Division[], divisionsBasic: Division[], setErrorCategories?: Function}) {

    const [divisions, setDivisions] = useState<Division[]>([...divisionsBasic])
    const [categories, setCategories] = useState<Categorie[]>(
        divisionsBasic.flatMap(div => div.categories ?? [])
    )

    const [dateError, setDateError] = useState<string>('')

    function changeValue(input: HTMLInputElement) {
        
        const onlyNumbers = input.value.replace(/\D/g, '')

        const number = Number(onlyNumbers) / 100

        const formatted = number.toLocaleString('pt-BR', {
        style: 'currency',
        currency: 'BRL',
        })

        input.value = formatted
    }

    const [messageError, setMessageError] = useState<string>('')
    
    async function sendCategorie() {
        const nameInput = document.querySelector('#nameCategorie') as HTMLInputElement
        const valueInput = document.querySelector('#valueCategorie') as HTMLInputElement
        const toInput = document.querySelector('#toCategorie') as HTMLInputElement
        const fromInput = document.querySelector('#fromCategorie') as HTMLInputElement
        

        
        const divisionFor = Array.from(document.querySelectorAll('.division-for')).filter(el  => el instanceof HTMLInputElement && el.checked)[0].parentElement?.querySelector('label')?.innerText

        const categorie: Categorie = {
            name: nameInput.value,
            value: valueInput.value,
            to: Number(toInput.value),
            from: Number(fromInput.value),
            divisionFor: divisionFor as string
        }

        if (categorie.name == '' || categorie.value == '' || toInput.value == '' || fromInput.value == '') {
            setMessageError('*Preencha todos os campos')
        } else {
            setMessageError('')
            if (categorie.from > categorie.to) {
                setDateError('*A data mínima para inscrição deve ser menor que a máxima')
            } else {
                setDateError('')
                
                if (String(categorie.to).length != 4 || String(categorie.from).length != 4) {
                    setDateError('*insira anos válidos')
                } else {
                    setDateError('')

                    // const x = categories.filter(el => el.justSuperior == categorie.justSuperior)

                    // const isX = x.some(el => el.name == categorie.name)
    
                    if (categories.filter(el => el.divisionFor == categorie.divisionFor).some(el => el.name == categorie.name)) {
                        setMessageError('*Uma categoria com este nome já foi adicionada')
                    } else {
                        setMessageError('')
                        
                        const newCategories = [...categories, categorie]
                        
                        const thisDivision = divisions.find(
                            el => el.name == categorie.divisionFor
                        )
                        if (!thisDivision) return
                        const genreThisDivision = thisDivision.genre

                        const divisionsSameGenreNames = divisionsBasic.filter(el => el.genre == genreThisDivision || el.genre == 'Masculino/Feminino').map(el => el.name)

                        
                        const res = await verifyCategorieDates(newCategories.filter(el => divisionsSameGenreNames.includes(el.divisionFor)))
                        const res2 = await verifyCategorieDates(newCategories.filter(el => el.divisionFor == categorie.divisionFor))

                        if (res?.error) {
                            setMessageError('*Os intervalos de datas não podem se chocar entre divisões de mesmo gênero')
                        } else {
                            setMessageError('')
                            
                                const x = [
                                ...newCategories.filter(el => el.divisionFor != categorie.divisionFor),
                                ...res2.organized
                            ]

                            setCategories(x)

                            const updatedDivision = {
                                ...thisDivision,
                                categories: [
                                    ...(thisDivision?.categories ?? []).filter(
                                        cat => !res2.organized.some(
                                            newCat => newCat.name === cat.name
                                        )
                                    ),
                                    ...res2.organized
                                ]
                            }

                            const y = [
                                ...divisions.filter(el => el.name != categorie.divisionFor),
                                updatedDivision
                            ]

                            setDivisions(y)

                            nameInput.value = ''
                            valueInput.value = ''
                            toInput.value = ''
                            fromInput.value = ''
                           
                            console.log('divisions', divisions)
                        }
                    }
                }
    
            }
        }

    }

    function removeCategorie(table: string, cat: string) {

    setDivisions(prev => 
        prev.map(div => {
            if (div.name !== table) return div

            return {
                ...div,
                categories: div.categories?.filter(
                    categorie => categorie.name !== cat
                )
            }
        })
    )

    setCategories(prev =>
        prev.filter(categorie => categorie.name !== cat)
    )
}

    // useEffect(() => {
    //     setDivisions(divisionsBasic)
    //     setCategories(divisionsBasic.flatMap(div => div.categories ?? []))
    // }, [])

//thisDivision
    useEffect(() => {
    console.log("divisionsBasic", divisionsBasic)
    console.log("divisions", divisions)

    if (!setErrorCategories) return

    const hasCategories = divisions.some(
        div => div.categories && div.categories.length > 0
    )

    console.log("hasCategories", hasCategories)

    setErrorCategories(!hasCategories)

}, [divisions])

    return (
        <>
            <div id='gray-area'  className={divisionsBasic.length > 0 ? '' : 'disableDiv'}>
                <h2>Categorias: </h2>
                <div className='form' style={{width: 'calc(50% - 15px)'}}>
                    <h3>Adicionar categoria:</h3>
                    <div id='cat-basic' style={{width: '100%'}}>
                        <div>
                            <label >Nome: <p className='ast'>*</p></label>
                            <input id="nameCategorie" type="text" style={{display: 'flex', flex: 1}}/>
                        </div>
                        <div>
                            <label >Valor: <p className='ast'>*</p></label>
                            <input onChange={(e) => changeValue(e.currentTarget)} type="text" inputMode="numeric" pattern="[0-9]" id="valueCategorie" style={{width: '30%'}} autoComplete="off"/>
                        </div>
                    </div>

                    <div id='interval' style={{width: '100%'}}>
                        <label htmlFor="">Intervalo de ano de nascimento para participação: <p className='ast'>*</p></label>
                        <div style={{width: '100%'}}>
                            <div style={{width: 'calc(50% - 5px)'}}>
                                <label>De:</label>
                                <input id="fromCategorie" type="text" inputMode="numeric" pattern="[0-9]" maxLength={4}/>
                            </div>
                            <div style={{width: 'calc(50% - 5px)'}}>
                                <label>Até:</label>
                                <input id="toCategorie" type="text" inputMode="numeric" pattern="[0-9]" maxLength={4}/>
                            </div>
                        </div>
                        {dateError != '' ? ( <p className="error">{dateError}</p> ) : ('')}
                    </div>

                    <div id='checkboxes' style={{width: '100%'}}>
                        <div id="radios-divisions">
                            {divisionsBasic.map((el, i) => {
                                return (
                                    <div key={i}>
                                        <input name="division-for" className="division-for" type='radio' defaultChecked={i == 0}/>
                                        <label htmlFor="division-for">{el.name}</label>
                                    </div>
                                )
                            })}
            
                        </div>
                    </div>

                    <div>
                        <button onClick={() => {sendCategorie()}} type="button" className='button black'>Adicionar categoria</button>
                        {messageError != '' ? ( <p className="error">{messageError}</p> ) : ('')}
                    </div>
                </div>

                <div id='body-tables'>
                    {divisionsBasic.map((el, i) => {
                        
                        const division = divisions.find(div => div.name == el.name)
                        
                        return (
                                <table key={i}>
                                    <thead>
                                        <tr><th>{el.name} - {el.genre == 'ambos' ? 'Masculino/Feminino' : el.genre.charAt(0).toUpperCase() + el.genre.slice(1)}</th></tr>
                                    </thead>
                                    <tbody>
                                        { division?.categories && division.categories.length > 0 ? (
                                            <>
                                                {division.categories.map((el2, i2) => {
                                                    return (
                                                        <tr key={i2}>
                                                            <td>
                                                                <div>
                                                                    <p>{el2.name} / {el2.value} / ({el2.from} - {el2.to})</p>
                                                                    <img src="/icons/cancel-red.png" alt="" fetchPriority='low' loading='lazy' decoding='async' onClick={() => removeCategorie(el.name, el2.name)}/>    
                                                                </div>    
                                                            </td>
                                                        </tr>
                                                    )
                                                })}
                                            </>
                                        ) : (
                                            <tr>
                                                <td>
                                                    <div>
                                                        <p>Não há categorias cadastradas</p>
                                                    </div>
                                                </td>
                                            </tr>
                                        )}
                                    </tbody>
                                </table>
                            
                        )
                    })}
                </div>
                {/* <input name="categories" type="text" hidden value={JSON.stringify(categories)} /> */}
                <input name='divisions' type="text" hidden value={JSON.stringify(divisions)} />
                <input name='difference' type="text" hidden value={`${JSON.stringify(divisions) != JSON.stringify(defaultDivisions)}`} />
                
            </div>
        </>
    )
}

//cbx: 