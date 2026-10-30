'use client'

import Link from 'next/link'
import { useMemo, useState } from 'react'

export type TournamentListItem = {
  slug: string
  title: string
  inscriptionDate: string
  eventDate: string
  /** Ano do evento (usado no filtro) */
  eventYear: number
  /** Mês do evento, 0 = janeiro (usado no filtro) */
  eventMonth: number
  timeLabel: string
  local: string
  localLink: string
  imageUrl: string | null
}

const MONTH_NAMES = Array.from({ length: 12 }, (_, month) => {
  const name = new Intl.DateTimeFormat('pt-BR', { month: 'long' }).format(new Date(2026, month, 1))

  return name.charAt(0).toUpperCase() + name.slice(1)
})

/** Deixa a busca indiferente a maiúsculas e acentos ("ararangua" acha "Araranguá"). */
const normalize = (value: string) =>
  value.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim()

export default function TournamentsList({ tournaments }: { tournaments: TournamentListItem[] }) {
  const [search, setSearch] = useState('')
  const [year, setYear] = useState('all')
  const [month, setMonth] = useState('all')

  const years = useMemo(
    () => Array.from(new Set(tournaments.map((tournament) => tournament.eventYear))).sort(),
    [tournaments]
  )

  const filtered = useMemo(
    () =>
      tournaments.filter((tournament) => {
        if (year !== 'all' && tournament.eventYear !== Number(year)) return false
        if (month !== 'all' && tournament.eventMonth !== Number(month)) return false

        const term = normalize(search)

        return term === '' || normalize(tournament.title).includes(term)
      }),
    [tournaments, search, year, month]
  )

  const hasFilters = search.trim() !== '' || year !== 'all' || month !== 'all'

  function clearFilters() {
    setSearch('')
    setYear('all')
    setMonth('all')
  }

  return (
    <>
      <div id="filters">
        <div className="fields">
          <label className="field search-field">
            <span>Torneio</span>
            <input
              type="text"
              value={search}
              placeholder="Buscar pelo nome"
              onChange={(event) => setSearch(event.currentTarget.value)}
            />
          </label>

          <label className="field">
            <span>Ano</span>
            <select value={year} onChange={(event) => setYear(event.currentTarget.value)}>
              <option value="all">Todos os anos</option>
              {years.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </label>

          <label className="field">
            <span>Mês</span>
            <select value={month} onChange={(event) => setMonth(event.currentTarget.value)}>
              <option value="all">Todos os meses</option>
              {MONTH_NAMES.map((name, index) => (
                <option key={name} value={index}>
                  {name}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className="summary">
          {/* <span>
            {filtered.length} de {tournaments.length}{' '}
            {tournaments.length === 1 ? 'torneio' : 'torneios'}
          </span> */}
          {hasFilters ? (
            <button type="button" onClick={clearFilters}>
              Limpar filtros
            </button>
          ) : (
            ''
          )}
        </div>
      </div>

      {filtered.length > 0 ? (
        filtered.map((tournament) => (
          <div className="tournament" key={tournament.slug}>
            <div className="content">
              <h3>{tournament.title}</h3>
              <div className="informations">
                <p>
                  <span className="r">Data do encerramento das inscrições:</span>{' '}
                  {tournament.inscriptionDate}
                </p>
                <p>
                  <span className="r">Data do evento:</span> {tournament.eventDate}
                </p>
                <p>
                  {tournament.timeLabel ? (
                    <>
                      <span>Tempo:</span> {tournament.timeLabel}
                    </>
                  ) : (
                    ''
                  )}
                  &nbsp;&nbsp;&nbsp;
                  <span>
                    Local:{' '}
                    <a
                      target="_blank"
                      rel="noopener noreferrer"
                      href={tournament.localLink}
                      className="link"
                    >
                      {tournament.local}
                    </a>
                  </span>
                </p>
              </div>
              <Link href={`/torneios-abertos/${tournament.slug}`} className="button blue">
                Inscreva-se
              </Link>
            </div>
            {tournament.imageUrl ? (
              <img
                src={tournament.imageUrl}
                alt="torneio"
                fetchPriority="low"
                loading="lazy"
                decoding="async"
              />
            ) : (
              ''
            )}
          </div>
        ))
      ) : (
        <p className="obs">Nenhum torneio encontrado com esses filtros.</p>
      )}
    </>
  )
}
