'use client'

import { FormState } from "@/lib/types"

const MAX_DIGITS = 8
const YEARS_BEFORE = 100

const isDigit = (char: string | undefined) => char !== undefined && char >= '0' && char <= '9'
const onlyDigits = (value: string) => value.replace(/\D/g, '')

/**
 * Separa o texto digitado nas três partes da data (dia, mês, ano) e limita cada uma.
 * Quando o usuário digita tudo sem barra, os dígitos são agrupados em dd/mm/aaaa.
 * Dígito que passa do limite de uma parte vai para o começo da próxima, então
 * apagar um número do mês mexe só no mês: o ano continua intacto.
 */
function splitGroups(value: string): string[] {
    const parts = value.split('/')

    if (parts.length === 1) {
        const digits = onlyDigits(value)

        return [digits.slice(0, 2), digits.slice(2, 4), digits.slice(4, MAX_DIGITS)]
    }

    let [day, month = '', year = ''] = parts.map(onlyDigits)

    if (day.length > 2) {
        month = day.slice(2) + month
        day = day.slice(0, 2)
    }

    if (month.length > 2) {
        year = month.slice(2) + year
        month = month.slice(0, 2)
    }

    return [day, month, year.slice(0, 4)]
}

/** Monta o texto de volta, sem as partes vazias do final. */
function renderGroups(groups: string[]) {
    const partes = [...groups]

    while (partes.length > 1 && partes[partes.length - 1] === '') partes.pop()

    return partes.join('/')
}

/** Posição do cursor depois do enésimo dígito dentro do texto formatado. */
function caretAfterDigits(formatted: string, digitCount: number) {
    if (digitCount <= 0) return 0

    let seen = 0

    for (let index = 0; index < formatted.length; index++) {
        if (!isDigit(formatted[index])) continue

        seen++

        if (seen === digitCount) {
            let caret = index + 1

            while (caret < formatted.length && !isDigit(formatted[caret])) caret++

            return caret
        }
    }

    return formatted.length
}

/** Reformata o campo mantendo o cursor sobre o mesmo dígito. */
export function normalizeDateInput(rawValue: string, caretRaw: number) {
    const value = renderGroups(splitGroups(rawValue))
    const digitsBeforeCaret = onlyDigits(rawValue.slice(0, caretRaw)).length
    const caret = caretAfterDigits(value, Math.min(digitsBeforeCaret, onlyDigits(value).length))

    return { value, caret }
}

/** Data completa que existe de verdade e dentro do intervalo aceito. */
function isRealDate(value: string, allowFuture: boolean) {
    if (value.length !== 10) return false

    const [day, month, year] = value.split('/').map(Number)

    if (!day || !month || !year) return false

    const currentYear = new Date().getFullYear()

    if (year < currentYear - YEARS_BEFORE) return false
    if (year > (allowFuture ? 9999 : currentYear)) return false

    const date = new Date(year, month - 1, day)

    return date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day
}

type InputDateProps = {
    uuid?: string
    updateObjNowSelect?: (uuid: string, collumn: string, value: string, type: string) => void
    reguleSize?: (input: HTMLInputElement) => void
    size?: number
    defaultValue?: string
    blur?: (value: string) => void
    state?: FormState
    multiple?: string
    now?: boolean
    /** Avisa o valor a cada alteração, mesmo quando a data ainda está incompleta. */
    onValueChange?: (value: string) => void
}

export default function InputDate({uuid, updateObjNowSelect, reguleSize, size, defaultValue, blur, state, multiple, now, onValueChange}: InputDateProps) {
    const initialValue = defaultValue ?? state?.values?.[0]?.borndate ?? ''

    function applyValue(input: HTMLInputElement, rawValue: string, caretRaw: number) {
        const { value, caret } = normalizeDateInput(rawValue, caretRaw)

        if (value !== rawValue) {
            input.value = value
            input.setSelectionRange(caret, caret)
        }

        if (reguleSize) reguleSize(input)
        if (onValueChange) onValueChange(value)
    }

    function handleInput(event: React.FormEvent<HTMLInputElement>) {
        const input = event.currentTarget

        applyValue(input, input.value, input.selectionStart ?? input.value.length)
    }

    function handleKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
        if (event.key === 'Enter') {
            event.preventDefault()
            event.currentTarget.blur()
            return
        }

        if (event.key !== 'Backspace') return

        const input = event.currentTarget
        const caret = input.selectionStart ?? 0

        // Com o cursor logo depois de uma barra, apaga o dígito anterior em vez de não fazer nada.
        if (input.selectionStart !== input.selectionEnd || caret < 2) return
        if (isDigit(input.value[caret - 1]) || !isDigit(input.value[caret - 2])) return

        event.preventDefault()

        const { value } = normalizeDateInput(
            input.value.slice(0, caret - 2) + input.value.slice(caret - 1),
            caret - 1
        )

        input.value = value

        // O cursor fica onde o dígito apagado estava (sem pular a barra).
        const newCaret = Math.min(caret - 2, value.length)
        input.setSelectionRange(newCaret, newCaret)

        if (reguleSize) reguleSize(input)
        if (onValueChange) onValueChange(value)
    }

    function handleBlur(event: React.FocusEvent<HTMLInputElement>) {
        const input = event.currentTarget
        let value = input.value

        if (now && value.length === 10) {
            const [day, month, year] = value.split('/').map(Number)
            const dateNow = new Date()

            if (new Date(year, month - 1, day) < dateNow) {
                value = dateNow.toLocaleDateString('pt-BR')
            }
        }

        // Data completa que não existe (31/02, mês 13) ou fora do intervalo: limpa o campo.
        if (value.length === 10 && !isRealDate(value, Boolean(now))) value = ''

        if (value !== input.value) input.value = value

        if (onValueChange) onValueChange(value)
        if (blur) blur(value)

        if (uuid && updateObjNowSelect && value.length === 10) {
            updateObjNowSelect(uuid, 'data_nasc', value, 'date')
        }
    }

    return (
        <input
        id={multiple && multiple == 'sim' ? '' : "input-date"}
        className={`needed ${multiple && multiple == 'sim' ? 'input-date' : ''}`}
        name="borndate"
        defaultValue={initialValue}
        size={size ? size : undefined}
        inputMode="numeric"
        autoComplete="off"
        onInput={handleInput}
        onKeyDown={handleKeyDown}
        onBlur={handleBlur}
        />
    )
}
