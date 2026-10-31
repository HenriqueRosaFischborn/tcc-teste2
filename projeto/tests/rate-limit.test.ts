import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { allowAttempt, resetAttempts } from '@/lib/rate-limit'

const CHAVE = 'teste:limite'

beforeEach(() => {
    resetAttempts(CHAVE)
})

afterEach(() => {
    vi.useRealTimers()
})

describe('allowAttempt', () => {
    it('permite até o limite dentro da janela', () => {
        expect(allowAttempt(CHAVE, 3, 60_000)).toBe(true)
        expect(allowAttempt(CHAVE, 3, 60_000)).toBe(true)
        expect(allowAttempt(CHAVE, 3, 60_000)).toBe(true)
        expect(allowAttempt(CHAVE, 3, 60_000)).toBe(false)
    })

    it('não mistura chaves diferentes', () => {
        resetAttempts('teste:outra')

        expect(allowAttempt(CHAVE, 1, 60_000)).toBe(true)
        expect(allowAttempt(CHAVE, 1, 60_000)).toBe(false)
        expect(allowAttempt('teste:outra', 1, 60_000)).toBe(true)

        resetAttempts('teste:outra')
    })

    it('volta a permitir depois que a janela expira', () => {
        vi.useFakeTimers()

        expect(allowAttempt(CHAVE, 1, 1_000)).toBe(true)
        expect(allowAttempt(CHAVE, 1, 1_000)).toBe(false)

        vi.advanceTimersByTime(1_001)

        expect(allowAttempt(CHAVE, 1, 1_000)).toBe(true)
    })
})
