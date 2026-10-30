'use client'

import { useEffect, useState } from "react"
import verifyCategorieDates from "./verifydates"
import { isAbsolute } from "path"

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

export default function CategorieArea({divisionsBasic, setErrorCategories}: {divisionsBasic: Division[], setErrorCategories?: Function}) {
    const automhatic = true

    const [divisions, setDivisions] = useState<Division[]>([...divisionsBasic])
    const [categories, setCategories] = useState<Categorie[]>([])

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
    
    async function sendCategorieAutomhatic(){
    const subInput = document.querySelector('#subCategorie') as HTMLSelectElement
    const valueInput = document.querySelector('#valueCategorie') as HTMLInputElement

    const divisionFor = Array.from(document.querySelectorAll('.division-for')).filter(el => el instanceof HTMLInputElement && el.checked)[0].parentElement?.querySelector('label')?.innerText

    if (subInput.value == '' || valueInput.value == '') {
        setMessageError('*Preencha todos os campos')
        return
    }

    // Cálculo do intervalo a partir do ano atual
    const ABSOLUTE_VALUE = 19
    const MIN_YEAR = 1900 // ano mínimo usado no Absoluto (sem limite inferior real)

    const currentYear = new Date().getFullYear()
    const sub = Number(subInput.value)
    const isAbsolute = sub === ABSOLUTE_VALUE

    const categorie: Categorie = {
        name: isAbsolute ? 'Absoluto' : `Sub ${sub}`,
        value: valueInput.value,
        from: isAbsolute ? MIN_YEAR : currentYear - sub,
        to: isAbsolute ? currentYear - sub : currentYear - sub + 1,
        divisionFor: divisionFor as string
    }

    setMessageError('')

    // Nome duplicado dentro da mesma divisão
    if (categories.filter(el => el.divisionFor == categorie.divisionFor).some(el => el.name == categorie.name)) {
        setMessageError('*Uma categoria com este nome já foi adicionada')
        return
    }

    const MIXED_GENRE = 'Masculino/Feminino'

    const thisDivision = divisionsBasic.filter(el => el.name == categorie.divisionFor)[0]

    // Gêneros que esta divisão ocupa (a mista conta para os dois)
    const genresOfThisDivision = thisDivision.genre == MIXED_GENRE
        ? ['Masculino', 'Feminino']
        : [thisDivision.genre]

    // Duas divisões competem entre si se são do mesmo gênero ou se alguma delas é mista
    const competes = (genreA: string, genreB: string) =>
        genreA == MIXED_GENRE || genreB == MIXED_GENRE || genreA == genreB

    // 1) A mesma categoria não pode existir em outra divisão que compete com esta
    const otherDivisionNames = divisionsBasic
        .filter(el => el.name != categorie.divisionFor && competes(el.genre, thisDivision.genre))
        .map(el => el.name)

    if (categories.some(el => otherDivisionNames.includes(el.divisionFor) && el.name == categorie.name)) {
        setMessageError('*Esta categoria já existe em outra divisão do mesmo gênero')
        return
    }

    const newCategories = [...categories, categorie]

    // 2) Choque de intervalos de datas, verificado separadamente para cada gênero
    for (const genre of genresOfThisDivision) {
        const namesThisGenre = divisionsBasic
            .filter(el => el.genre == genre || el.genre == MIXED_GENRE)
            .map(el => el.name)

        const resGenre = await verifyCategorieDates(newCategories.filter(el => namesThisGenre.includes(el.divisionFor)))

        if (resGenre?.error) {
            setMessageError('*Os intervalos de datas não podem se chocar entre divisões de mesmo gênero')
            return
        }
    }

    const res2 = await verifyCategorieDates(newCategories.filter(el => el.divisionFor == categorie.divisionFor))

    const x = [...newCategories.filter(el => el.divisionFor != categorie.divisionFor), ...res2.organized]
    setCategories(x)

    thisDivision.categories = res2.organized
    const y = [...divisions.filter(el => el.name != categorie.divisionFor), ...[thisDivision]]
    setDivisions(y)

    subInput.value = ''
    valueInput.value = ''

    console.log('divisions', divisions)

    
    }
    
    
    async function sendCategorieManual() {
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
                        
                        const thisDivision = divisionsBasic.filter(el => el.name == categorie.divisionFor)[0]
                        
                        const genreThisDivision = thisDivision.genre

                        const divisionsSameGenreNames = divisionsBasic.filter(el => el.genre == genreThisDivision || el.genre == 'Masculino/Feminino').map(el => el.name)

                        
                        const res = await verifyCategorieDates(newCategories.filter(el => divisionsSameGenreNames.includes(el.divisionFor)))
                        const res2 = await verifyCategorieDates(newCategories.filter(el => el.divisionFor == categorie.divisionFor))

                        if (res?.error) {
                            setMessageError('*Os intervalos de datas não podem se chocar entre divisões de mesmo gênero')
                        } else {
                            setMessageError('')
                            
                            const x = [...newCategories.filter(el => el.divisionFor != categorie.divisionFor), ...res2.organized]
                            setCategories(x)
                        
                            thisDivision.categories = res2.organized
                            const y = [...divisions.filter(el => el.name != categorie.divisionFor), ...[thisDivision]]
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

    async function sendCategorie() {
        if (automhatic) {
            sendCategorieAutomhatic()
        } else {
            sendCategorieManual()
        }
    }

    function removeCategorie(table: string, cat: string) {
        
        const el = divisions.find(el => el.name == table)?.categories?.find(el => el.name == cat)


        const newDivision = divisions.find(el => el.name == table)
        if (newDivision && newDivision.categories) {
            newDivision.categories = newDivision.categories.filter(el2 => el2 != el)

            setDivisions(prev => [...prev.filter(el2 => el2.name != table), newDivision])
            setCategories(prev => prev.filter(el2 => el2 != el))
        }
    }

    useEffect(() => {
        if (setErrorCategories) {
            if (categories.length > 0) {
                setErrorCategories(false)
            } else {
                setErrorCategories(true)
            }
        }
    }, [categories])

    return (
        <>
            <div id='gray-area'  className={divisionsBasic.length > 0 ? '' : 'disableDiv'}>
                <h2>Categorias: </h2>
                <div className='form' style={{width: '55%'}}>
                    <h3>Adicionar categoria:</h3>

                    
                        {automhatic ? (
                            <>
                                {/* <div id='interval' style={{width: '100%'}}>
                                    <label htmlFor="">Classificação da categoria: <p className='ast'>*</p></label>
                                    <div id="select-categorie-sub">
                                        <select name="" id="">
                                            <option style={{display: 'none'}} value=""></option>
                                            {Array.from({length: 15}).map((el, i) => {return(
                                                <option key={i} value={i + 4}>Sub {i + 4}</option>
                                            )})}
                                            <option value={'19'}>Absoluto</option>
                                        </select>
                                    </div>
                                </div>

                                <div id='cat-basic' style={{width: '100%'}}>
                                    <div>
                                        <label >Valor: <p className='ast'>*</p></label>
                                        <input onChange={(e) => changeValue(e.currentTarget)} type="text" inputMode="numeric" pattern="[0-9]" id="valueCategorie" style={{width: '30%'}} autoComplete="off"/>
                                    </div>
                                </div> */}

                                <div id='interval' style={{width: '100%'}}>
                                    <label htmlFor="subCategorie">Classificação da categoria: <p className='ast'>*</p></label>
                                    <div id="select-categorie-sub">
                                        <select name="subCategorie" id="subCategorie" defaultValue="">
                                            <option style={{display: 'none'}} value=""></option>
                                            {Array.from({length: 15}).map((el, i) => {return(
                                                <option key={i} value={i + 4}>Sub {i + 4}</option>
                                            )})}
                                            <option value={'19'}>Absoluto</option>
                                        </select>
                                    </div>
                                </div>

                                <div id='cat-basic' style={{width: '100%'}}>
                                    <div>
                                        <label >Valor: <p className='ast'>*</p></label>
                                        <input onChange={(e) => changeValue(e.currentTarget)} type="text" inputMode="numeric" pattern="[0-9]" id="valueCategorie" style={{width: '30%'}} autoComplete="off"/>
                                    </div>
                                </div>
                            </>
                        ) : (
                            <>
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
                            </>
                        )}

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
                                        <tr><th>{el.name} - {el.genre}</th></tr>
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
            </div>
        </>
    )
}

//cbx: 