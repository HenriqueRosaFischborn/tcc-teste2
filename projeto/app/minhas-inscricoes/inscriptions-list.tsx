'use client'

import Link from 'next/link'
import { useMemo, useState } from 'react'
import ButtonCancelSolicitation from './buttonCancelSolicitation'
import { Player } from '@/lib/types'

export type InscriptionItem = {
    uuid: string
    tournamentId: number
    tournamentTitle: string
    /** Pendente | Confirmada | Recusada */
    status: string
    /** Inscrições ainda abertas (o usuário pode editar / cancelar) */
    open: boolean
    /** ISO da data limite de inscrição, usado só para ordenar */
    deadlineISO: string
    deadlineDate: string
    deadlineTime: string
    name: string
    birthDate: string
    email: string
    categoryName: string
    categoryValue: string
    imageUrl: string | null
    player: Player
}

/** O banco chama de "Recusada", mas para o atleta o que aconteceu é um cancelamento. */
const STATUS_LABEL: Record<string, string> = {
    Confirmada: 'Confirmada',
    Pendente: 'Pendente',
    Recusada: 'Cancelada'
}

/** Ordem em que as seções aparecem na página. */
const SECTIONS: { status: string; title: string; empty: string }[] = [
    { status: 'Confirmada', title: 'Confirmadas', empty: 'Nenhuma inscrição confirmada no momento.' },
    { status: 'Pendente', title: 'Pendentes', empty: 'Nenhuma inscrição pendente no momento.' },
    { status: 'Recusada', title: 'Canceladas', empty: 'Nenhuma inscrição cancelada no momento.' }
]

const statusClass = (status: string) => `status-${status.toLowerCase()}`

function InscriptionCard({ item }: { item: InscriptionItem }) {
    return (
        <div className={`inscri-card ${statusClass(item.status)}${item.open ? '' : ' is-past'}`}>
            <div className="inscri-card-head">
                {item.imageUrl ? (
                    <img
                        className="inscri-thumb"
                        src={item.imageUrl}
                        alt={`Cartaz do ${item.tournamentTitle}`}
                        fetchPriority="low"
                        loading="lazy"
                        decoding="async"
                    />
                ) : (
                    ''
                )}
                <div className="inscri-card-title">
                    <h3>{item.tournamentTitle}</h3>
                    <span className={`inscri-badge ${statusClass(item.status)}`}>
                        {STATUS_LABEL[item.status] ?? item.status}
                    </span>
                </div>
            </div>

            <dl className="inscri-card-info">
                <div className="inscri-field">
                    <dt>Nome</dt>
                    <dd>{item.name}</dd>
                </div>
                <div className="inscri-field">
                    <dt>Data de nascimento</dt>
                    <dd>{item.birthDate}</dd>
                </div>
                <div className="inscri-field wide">
                    <dt>E-mail</dt>
                    <dd>{item.email}</dd>
                </div>
                <div className="inscri-field">
                    <dt>Categoria</dt>
                    <dd>{item.categoryName}</dd>
                </div>
                <div className="inscri-field">
                    <dt>Valor</dt>
                    <dd>{item.categoryValue}</dd>
                </div>
            </dl>

            {item.open ? (
                <div className="inscri-card-foot">
                    {item.status === 'Recusada' ? (
                        <span className="inscri-note error">
                            Esta inscrição foi cancelada. Caso tenha ocorrido algum erro, contate o árbitro.
                        </span>
                    ) : (
                        <>
                            <span className="inscri-note">
                                Você só poderá atualizar sua inscrição até {item.deadlineDate} às{' '}
                                {item.deadlineTime}
                            </span>
                            <div className="pbuttons">
                                <Link
                                    href={`/minhas-inscricoes/${item.uuid}/editar-informacoes`}
                                    className="button blue"
                                >
                                    Editar informações
                                </Link>
                                <ButtonCancelSolicitation
                                    torneioID={item.tournamentId}
                                    inscricao={item.player}
                                    torneio={item.tournamentTitle}
                                />
                            </div>
                        </>
                    )}
                </div>
            ) : (
                <div className="inscri-card-foot">
                    <span className="inscri-note muted">Inscrições encerradas</span>
                </div>
            )}
        </div>
    )
}

export default function InscriptionsList({ items }: { items: InscriptionItem[] }) {
    const [showPast, setShowPast] = useState(false)

    const { open, past } = useMemo(() => {
        const byDeadlineAsc = (a: InscriptionItem, b: InscriptionItem) =>
            a.deadlineISO.localeCompare(b.deadlineISO)

        return {
            open: items.filter((item) => item.open).sort(byDeadlineAsc),
            past: items
                .filter((item) => !item.open)
                .sort((a, b) => {
                    // Confirmadas, depois pendentes, depois canceladas; dentro de cada
                    // grupo, o torneio mais recente primeiro.
                    const order = SECTIONS.findIndex((section) => section.status === a.status) -
                        SECTIONS.findIndex((section) => section.status === b.status)

                    return order !== 0 ? order : byDeadlineAsc(b, a)
                })
        }
    }, [items])

    const pastCount = past.length

    return (
        <>
            {SECTIONS.map((section) => {
                const list = open.filter((item) => item.status === section.status)

                return (
                    <section className="inscri-section" key={section.status}>
                        <div className="inscri-section-head">
                            <h2>{section.title}</h2>
                            <span className="inscri-count">{list.length}</span>
                        </div>

                        {list.length > 0 ? (
                            <div className="inscri-grid">
                                {list.map((item) => (
                                    <InscriptionCard key={item.uuid} item={item} />
                                ))}
                            </div>
                        ) : (
                            <p className="obs">{section.empty}</p>
                        )}
                    </section>
                )
            })}

            <section className="inscri-section is-past">
                <div className="inscri-section-head">
                    <h2>Torneios anteriores</h2>
                    <span className="inscri-count">{pastCount}</span>
                    {pastCount > 0 ? (
                        <button type="button" className="link-button" onClick={() => setShowPast(!showPast)}>
                            {showPast ? 'Ocultar' : 'Mostrar'}
                        </button>
                    ) : (
                        ''
                    )}
                </div>

                {pastCount === 0 ? (
                    <p className="obs">Não há inscrições anteriores cadastradas no momento.</p>
                ) : showPast ? (
                    <div className="inscri-grid">
                        {past.map((item) => (
                            <InscriptionCard key={item.uuid} item={item} />
                        ))}
                    </div>
                ) : (
                    <p className="obs">
                        {pastCount} {pastCount === 1 ? 'inscrição' : 'inscrições'} em torneios com as inscrições
                        já encerradas.
                    </p>
                )}
            </section>
        </>
    )
}
