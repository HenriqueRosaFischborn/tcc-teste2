'use client'

import { useEffect, useState } from "react"
import verifyCategorieDates from "./verifydates"

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

// Mesma estrutura de `adicionar-torneio/form/categories/catArea.tsx`: a
// categoria é escolhida numa lista (Sub N / Absoluto) e o intervalo de anos de
// nascimento é calculado a partir do ano atual, em vez de ser digitado.
const MIXED_GENRE = 'Masculino/Feminino'
const ABSOLUTE_VALUE = 19
const MIN_YEAR = 1900 // ano mínimo usado no Absoluto (sem limite inferior real)

/** O banco guarda a divisão mista como `ambos`; o formulário usa `Masculino/Feminino`. */
function normalizarGenero(genre?: string) {
    const genero = String(genre ?? '').toLowerCase()

    if (genero == 'ambos' || genero == 'masculino/feminino') return MIXED_GENRE

    return genero == '' ? '' : genero.charAt(0).toUpperCase() + genero.slice(1)
}

export default function CategorieArea({defaultDivisions, divisionsBasic, setErrorCategories}: {defaultDivisions: Division[], divisionsBasic: Division[], setErrorCategories?: Function}) {

    const [divisions, setDivisions] = useState<Division[]>([...divisionsBasic])
    const [categories, setCategories] = useState<Categorie[]>(
        divisionsBasic.flatMap(div => div.categories ?? [])
    )

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
        const subInput = document.querySelector('#subCategorie') as HTMLSelectElement
        const valueInput = document.querySelector('#valueCategorie') as HTMLInputElement

        const divisionFor = Array.from(document.querySelectorAll('.division-for')).filter(el => el instanceof HTMLInputElement && el.checked)[0].parentElement?.querySelector('label')?.innerText

        if (subInput.value == '' || valueInput.value == '' || !divisionFor) {
            setMessageError('*Preencha todos os campos')
            return
        }

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

        const thisDivision = divisionsBasic.filter(el => el.name == categorie.divisionFor)[0]

        if (!thisDivision) {
            setMessageError('*Divisão não encontrada')
            return
        }

        const genreThisDivision = normalizarGenero(thisDivision.genre)

        // Gêneros que esta divisão ocupa (a mista conta para os dois)
        const genresOfThisDivision = genreThisDivision == MIXED_GENRE
            ? ['Masculino', 'Feminino']
            : [genreThisDivision]

        // Duas divisões competem entre si se são do mesmo gênero ou se alguma delas é mista
        const competes = (genreA: string, genreB: string) =>
            genreA == MIXED_GENRE || genreB == MIXED_GENRE || genreA == genreB

        // 1) A mesma categoria não pode existir em outra divisão que compete com esta
        const otherDivisionNames = divisionsBasic
            .filter(el => el.name != categorie.divisionFor && competes(normalizarGenero(el.genre), genreThisDivision))
            .map(el => el.name)

        if (categories.some(el => otherDivisionNames.includes(el.divisionFor) && el.name == categorie.name)) {
            setMessageError('*Esta categoria já existe em outra divisão do mesmo gênero')
            return
        }

        const newCategories = [...categories, categorie]

        // 2) Choque de intervalos de datas, verificado separadamente para cada gênero
        for (const genre of genresOfThisDivision) {
            const namesThisGenre = divisionsBasic
                .filter(el => normalizarGenero(el.genre) == genre || normalizarGenero(el.genre) == MIXED_GENRE)
                .map(el => el.name)

            const resGenre = await verifyCategorieDates(newCategories.filter(el => namesThisGenre.includes(el.divisionFor)))

            if (resGenre?.error) {
                setMessageError('*Os intervalos de datas não podem se chocar entre divisões de mesmo gênero')
                return
            }
        }

        const res2 = await verifyCategorieDates(newCategories.filter(el => el.divisionFor == categorie.divisionFor))

        setCategories([...newCategories.filter(el => el.divisionFor != categorie.divisionFor), ...res2.organized])

        // Atualiza a divisão preservando a ordem das divisões no formulário: a
        // ordem entra na comparação com `defaultDivisions` que libera a
        // sincronização no servidor.
        setDivisions(prev => {
            const atual = prev.find(el => el.name == categorie.divisionFor)
            const atualizada = { ...(atual ?? thisDivision), categories: res2.organized }

            if (!atual) return [...prev, atualizada]

            return prev.map(el => el.name == categorie.divisionFor ? atualizada : el)
        })

        subInput.value = ''
        valueInput.value = ''
    }

    function removeCategorie(table: string, cat: string) {

        // A remoção é por referência: a mesma categoria (ex.: "Sub 15") pode
        // existir em divisões de gêneros diferentes e só sai da divisão clicada.
        const alvo = divisions.find(el => el.name == table)?.categories?.find(el => el.name == cat)

        if (!alvo) return

        setDivisions(prev => prev.map(div => {
            if (div.name !== table) return div

            return {
                ...div,
                categories: div.categories?.filter(categorie => categorie !== alvo)
            }
        }))

        setCategories(prev => prev.filter(categorie => categorie !== alvo))
    }

    useEffect(() => {
        if (!setErrorCategories) return

        const hasCategories = divisions.some(
            div => div.categories && div.categories.length > 0
        )

        setErrorCategories(!hasCategories)

    }, [divisions])

    return (
        <>
            <div id='gray-area'  className={divisionsBasic.length > 0 ? '' : 'disableDiv'}>
                <h2>Categorias: </h2>
                <div className='form' style={{width: 'calc(50% - 15px)'}}>
                    <h3>Adicionar categoria:</h3>

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
                                        <tr><th>{el.name} - {normalizarGenero(el.genre)}</th></tr>
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
                <input name='divisions' type="text" hidden value={JSON.stringify(divisions)} />
                <input name='difference' type="text" hidden value={`${JSON.stringify(divisions) != JSON.stringify(defaultDivisions)}`} />

            </div>
        </>
    )
}
