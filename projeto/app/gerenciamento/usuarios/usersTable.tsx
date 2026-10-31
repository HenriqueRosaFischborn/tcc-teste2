'use client'

import { useState } from 'react'
import './unique.css'
import './responsive.css'
import Switch from '@/components/ui/switch/switch'
import { changeFunction } from './changeFunction'

/**
 * Linha da tabela — espelha exatamente o `select` de `page.tsx`.
 *
 * Os dois campos são os únicos que a tela usa: `email` para exibir, filtrar e
 * endereçar o `changeFunction`, e `admin` para a cor e o estado inicial do
 * <select>. Nada de senha, id ou qualquer outro dado do usuário chega aqui.
 */
export type UsuarioListado = {
    email: string
    admin: boolean
}

export default function Users({ usuarios }: { usuarios: UsuarioListado[] }) {
    const [search, setSearch] = useState("")

    const filteredUsers = usuarios.filter(el =>
        el.email.toLowerCase().includes(search.toLowerCase())
    )

    return (
        <>
            <div id='content'>

                <h1>Usuários</h1>

                <div id='div-search-bar'>
                    <input
                        type="text"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        placeholder="Pesquisar por e-mail"
                    />
                    <div id='icon-search'>
                        <img
                            src="/icons/search.png"
                            alt="search"
                            fetchPriority='low'
                            loading='lazy'
                            decoding='async'
                        />
                    </div>
                </div>

                <table>
                    <thead>
                        <tr>
                            <th style={{ width: '500px' }}>Email:</th>
                            <th id='th-padding-2'>Função:</th>
                        </tr>
                    </thead>
                    <tbody>
                        {filteredUsers.map((el, i) => (
                            <tr key={i}>
                                <td>{el.email}</td>
                                <td className='select' style={{color: `${el.admin ? 'var(--mainred)' : 'black'}`}}>
                                    <select defaultValue={el.admin ? 'true' : 'false'} onChange={async (e) => {
                                        // Guarda o elemento antes do await: depois dele o React
                                        // não expõe mais o currentTarget do evento.
                                        const select = e.currentTarget
                                        const desejado = select.value === 'true'

                                        try {
                                            const { ok, message } = await changeFunction(el.email, desejado)

                                            // A função só muda se o servidor permitir (regra do
                                            // último administrador). Caso contrário, desfaz a escolha.
                                            if (!ok) {
                                                alert(message ?? 'Não foi possível alterar a função.')
                                                select.value = el.admin ? 'true' : 'false'
                                                return
                                            }

                                            window.location.reload()
                                        } catch {
                                            // Sessão expirada ou sem permissão: a action lança e
                                            // nada foi gravado, então a escolha volta ao que era.
                                            alert('Sessão expirada ou sem permissão.')
                                            select.value = el.admin ? 'true' : 'false'
                                        }
                                    }}>
                                        <option  style={{color: 'black'}} value={'false'}>Usuário</option>
                                        <option  style={{color: 'var(--mainred)'}} value={'true'}>Admin</option>
                                    </select>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>

            </div>
        </>
    )
}