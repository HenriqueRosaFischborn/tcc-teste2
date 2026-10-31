'use client'

import { useEffect, useState } from "react"
import { SelectCategorie } from "./selectCategorie"
import { usePathname } from "next/navigation"
import { FormState, Player } from "@/lib/types"
import type { OfficialPlayer } from "@/app/torneios-abertos/[torneio]/form/types"
import { error } from "console"

type Divisions = {
    fide?: string,
    cbx?: string
}

type ErrorID = {
    id?: 'fide' | 'cbx',
    error?: Boolean
}

export default function Fields({inscricao, playerCbx, playerFide, hasFide, setindividualPrice, state, setButton, setIdError, player, id}: {inscricao: Player, id: number, playerCbx?: OfficialPlayer, playerFide?: OfficialPlayer, hasFide: boolean, setIdError?: Function, setindividualPrice?: Function, setButton?: Function, player?: any, state: FormState}) {
    function handleEnterBlur(e: React.KeyboardEvent<HTMLInputElement>) {
        if (e.key === 'Enter') {
            e.preventDefault()
            e.currentTarget.blur()
        }
    }
    
    const pathname = usePathname()
    
    const [divisions, setDivisions] = useState<Divisions>({})

    const [errorName, setErrorName] = useState<string>('')
    const [errorInfo, setErrorInfo] = useState<string>('')

    function completeBlur() {
        if (hasFide && playerCbx && playerFide) {
            const name = document.getElementById('nome')
            if (name instanceof HTMLInputElement && name.value.trim() != '' && name.value != playerCbx.name) {
                setErrorName(`*Nome incorreto, o nome fornecido no ID é: ${playerCbx.name}`)
            } else {
                setErrorName('')
            }

            
            const date = document.getElementById('input-date')
            const genre = Array.from(document.querySelectorAll('.radio-genre')).filter((el) => {
                if (el instanceof HTMLInputElement && el.checked) {
                    return true
                }
            })[0].parentElement?.querySelector('h3')?.innerText

            
            if ((date instanceof HTMLInputElement && date.value.trim() != '' && date.value != playerCbx.bornYear) || (genre == 'Masculino' ? 'm' : 'f') != playerFide.genre) {
                console.log((genre == 'Masculino' ? 'm' : 'f') != playerFide.genre)
                
                setErrorInfo(`*Informações inválidas, as informações cadastradas são: ${playerCbx.bornYear} - ${playerFide.genre == 'm' ? 'Masculino' : 'Feminino' }`)
            } else {
                setErrorInfo('')
            }

        }
        
        const neededs = Array.from(document.querySelectorAll('.needed')).map(el => {
            if (el instanceof HTMLInputElement) {
                return el.value
            }
        })

        const isComplete = neededs.every(el => el?.trim() != '')

        
        if (setButton) {
            setButton(isComplete && ((hasFide && errorName == '' && errorInfo == '') || !hasFide))
        }
    }
    
    function division(divisionss: Divisions) {
        setDivisions(divisionss)
    }
    
    useEffect(() => {
        completeBlur()
    }, [divisions])

    return (
        <>
            <div style={{width: '70%'}}>
                <label htmlFor="name">Nome completo: <p className="ast">*</p></label>
                <input className="needed" id="nome" type="text" name="name" onBlur={completeBlur}defaultValue={state.values && state.values[0] ? state.values[0].name : playerCbx?.name ? playerCbx?.name : inscricao.name} onKeyDown={handleEnterBlur}/>
                {hasFide && errorName != '' ? <p className="error">{errorName}</p> : ''}
            </div>

            <SelectCategorie inscricao={inscricao} id={id} hasFide={hasFide} errorInfo={errorInfo} setindividualPrice={setindividualPrice} state={state} setDivisions={division} blur={completeBlur}/>     
        </>
    )//console
}