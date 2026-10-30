'use client'

import { closeInscri, openInscri } from "./editOpenInscri";

export function ButtonClose({id}: {id: number}) {
    return (
        <button style={{padding: '5px 30px'}} onClick={async () => {
            if (confirm('Tem certeza que deseja fechar as inscrições para este torneio? As inscrições já realizadas permanecerão salvas')) {
                await closeInscri(id)
                window.location.reload();
            }
        }} className='button small black'>Encerrar inscrições</button>
    )
}

export function ButtonOpen({id, dateNow, date_inscri}: {id: number, dateNow: Date, date_inscri: Date}) {
    return (
        <button style={{padding: '5px 30px'}} onClick={async () => {
            if (date_inscri < dateNow) {
                console.log(date_inscri)
                dateNow.toLocaleString()
                alert('A data de encerramento das inscrições deste torneio já expirou, para reabrir as inscrições altere a data de encerramento das inscrições em editar informações')
            } else {
                await openInscri(Number(id))
                window.location.reload();
            }
        }} className='button small black'>Abrir inscrições</button>
    )
}