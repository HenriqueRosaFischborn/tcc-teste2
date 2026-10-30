'use client'

import IMask from 'imask'
import { useEffect, useRef } from 'react'
import type { Category, CategoryStatus, Genre } from './types'
import { formatCurrency, handleEnterBlur } from './utils'

type PlayerFieldsProps = {
  hasIds: boolean
  name: string
  onNameChange: (value: string) => void
  onFieldBlur: () => void
  nameError: string
  onBirthDateChange: (value: string) => void
  genre: Genre
  onGenreChange: (genre: Genre) => void
  infoError: string
  categoryStatus: CategoryStatus
  category: Category | null
  showCategory: boolean
  divisionChoice: 'default' | 'absolute'
  onDivisionChange: (choice: 'default' | 'absolute') => void
}

/** Campo de data de nascimento com máscara dd/mm/aaaa (id e classes usados pelo CSS da página). */
function BirthDateInput({
  onValueChange,
  onBlur,
}: {
  onValueChange: (value: string) => void
  onBlur: () => void
}) {
  const inputRef = useRef<HTMLInputElement | null>(null)
  const currentYear = new Date().getFullYear()

  useEffect(() => {
    if (!inputRef.current) return

    const mask = IMask(inputRef.current, {
      mask: Date,
      pattern: 'd{/}m{/}Y',
      lazy: true,
      blocks: {
        d: { mask: IMask.MaskedRange, from: 1, to: 31, maxLength: 2 },
        m: { mask: IMask.MaskedRange, from: 1, to: 12, maxLength: 2 },
        Y: { mask: IMask.MaskedRange, from: currentYear - 100, to: currentYear },
      },
      format: (date: Date | null) => {
        if (!date) return ''

        const day = date.getDate().toString().padStart(2, '0')
        const month = (date.getMonth() + 1).toString().padStart(2, '0')

        return `${day}/${month}/${date.getFullYear()}`
      },
      parse: (value: string) => {
        const [day, month, year] = value.split('/').map(Number)

        return new Date(year, month - 1, day)
      },
      autofix: true,
    })

    return () => mask.destroy()
  }, [currentYear])

  return (
    <input
      ref={inputRef}
      id="input-date"
      className="needed"
      name="borndate"
      onKeyDown={handleEnterBlur}
      onInput={(event) => onValueChange(event.currentTarget.value)}
      onBlur={(event) => {
        onValueChange(event.currentTarget.value)
        onBlur()
      }}
    />
  )
}

export default function PlayerFields({
  hasIds,
  name,
  onNameChange,
  onFieldBlur,
  nameError,
  onBirthDateChange,
  genre,
  onGenreChange,
  infoError,
  categoryStatus,
  category,
  showCategory,
  divisionChoice,
  onDivisionChange,
}: PlayerFieldsProps) {
  const genreLabel = genre === 'masc' ? 'Masculino' : 'Feminino'
  const canChooseDivision = Boolean(
    category?.defaultDivision &&
      category.absoluteDivision &&
      category.absoluteDivision !== category.defaultDivision
  )

  return (
    <>
      <div style={{ width: '70%' }}>
        <label htmlFor="nome">Nome completo: <p className="ast">*</p></label>
        <input
          className="needed"
          id="nome"
          type="text"
          name="name"
          value={name}
          onChange={(event) => onNameChange(event.currentTarget.value)}
          onBlur={onFieldBlur}
          onKeyDown={handleEnterBlur}
        />
        {hasIds && nameError !== '' ? <p className="error">{nameError}</p> : ''}
      </div>

      <div style={{ width: '35%' }}>
        <label htmlFor="borndate">Data de nascimento: <p className="ast">*</p></label>
        <BirthDateInput onValueChange={onBirthDateChange} onBlur={onFieldBlur} />
      </div>

      <div className="genre" style={{ flexDirection: 'column', alignItems: 'start' }}>
        <div style={{ flexDirection: 'row', gap: '10px', cursor: 'pointer' }}>
          <input
            className="radio-genre"
            checked={genre === 'masc'}
            type="radio"
            name="genre"
            value="masc"
            onChange={() => onGenreChange('masc')}
          />
          <h3>Masculino</h3>
        </div>
        <div style={{ flexDirection: 'row', gap: '10px', cursor: 'pointer' }}>
          <input
            className="radio-genre"
            id="df2"
            checked={genre === 'fem'}
            type="radio"
            name="genre"
            value="fem"
            onChange={() => onGenreChange('fem')}
          />
          <h3>Feminino</h3>
        </div>
      </div>

      {hasIds && infoError !== '' ? <p className="error">{infoError}</p> : ''}

      {categoryStatus === 'none' ? (
        <p className="error">Nenhuma categoria deste torneio abrange sua idade</p>
      ) : (
        ''
      )}

      {categoryStatus === 'failed' ? (
        <p className="error">*Não foi possível carregar sua categoria. Tente novamente.</p>
      ) : (
        ''
      )}

      {showCategory ? (
        <div className="div-categorie" style={{ width: '100%', flexDirection: 'row' }}>
          <div style={{ width: 'calc(50% - 15px)', alignItems: 'start' }}>
            <label htmlFor="uuidCat">Categoria:</label>
            <input type="text" hidden id="uuidCat" name="uuidCat" value={category?.uuid ?? ''} readOnly />

            <div className="categorie input">
              <h3 style={{ textAlign: 'start' }}>
                {category
                  ? `${category.name} - ${genreLabel} - ${formatCurrency(category.price)}`
                  : 'Carregando...'}
              </h3>
            </div>

            <p className="obs">
              *A categoria selecionada pode não corresponder exatamente a sua idade por não estar
              disponível neste torneio. Nesse caso, o sistema escolherá automaticamente a categoria
              mais adequada
            </p>
          </div>

          {canChooseDivision && category ? (
            <div className="division" style={{ width: 'calc(50% - 15px)' }}>
              <label>Divisão:</label>
              <div style={{ flexDirection: 'row', gap: '10px', alignItems: 'center', cursor: 'pointer' }}>
                <input
                  name="division"
                  type="radio"
                  checked={divisionChoice === 'default'}
                  onChange={() => onDivisionChange('default')}
                  value={category.defaultDivision ?? ''}
                />
                <div style={{ flexDirection: 'row', gap: '10px', alignItems: 'center' }}>
                  <h3>{category.defaultDivision}</h3>
                  <p className="obs">(recomendado)</p>
                </div>
              </div>
              <div style={{ flexDirection: 'row', gap: '10px', alignItems: 'center', cursor: 'pointer' }}>
                <input
                  id="df"
                  name="division"
                  type="radio"
                  checked={divisionChoice === 'absolute'}
                  onChange={() => onDivisionChange('absolute')}
                  value={category.absoluteDivision ?? ''}
                />
                <h3>{category.absoluteDivision}</h3>
              </div>
            </div>
          ) : (
            ''
          )}
        </div>
      ) : (
        <div id="warning-box">
          <p>*Preencha a data de nascimento e o gênero corretamente para obter sua categoria</p>
        </div>
      )}
    </>
  )
}
