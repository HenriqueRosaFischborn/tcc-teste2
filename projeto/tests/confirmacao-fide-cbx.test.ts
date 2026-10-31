import { describe, expect, it } from 'vitest'
import { confirmarIdFidePelaCbx } from '@/app/torneios-abertos/[torneio]/form/confirmacao-cbx'
import type { OfficialPlayer } from '@/app/torneios-abertos/[torneio]/form/types'

const jogadorCbx = (idFide: string | null): OfficialPlayer => ({
    name: 'Henrique da Rosa Fischborn',
    bornYear: '23/05/2009',
    genre: null,
    title: null,
    federation: null,
    idFide,
    ratings: { standard: 1786, rapid: 1790, blitz: 1751 }
})

describe('confirmarIdFidePelaCbx', () => {
    it('confirma o ID quando o cadastro da CBX informa o mesmo número', () => {
        const resultado = confirmarIdFidePelaCbx('44731736', jogadorCbx('44731736'))

        expect(resultado.ok).toBe(true)

        if (!resultado.ok) return

        expect(resultado.player).toEqual({
            name: 'Henrique da Rosa Fischborn',
            bornYear: '23/05/2009',
            // Sem a FIDE não há como confirmar gênero, federação e ratings.
            genre: null,
            title: null,
            federation: null,
            idFide: '44731736',
            ratings: { standard: null, rapid: null, blitz: null }
        })
    })

    it('ignora espaços em volta do ID digitado', () => {
        expect(confirmarIdFidePelaCbx(' 44731736 ', jogadorCbx('44731736')).ok).toBe(true)
    })

    it('recusa quando o cadastro da CBX traz outro ID FIDE', () => {
        const resultado = confirmarIdFidePelaCbx('44731736', jogadorCbx('1234567'))

        // `divergente` é o que trava o formulário: o número digitado está errado.
        expect(resultado).toEqual({
            ok: false,
            motivo: 'O cadastro da CBX informa o ID FIDE 1234567.',
            divergente: true
        })
    })

    it('recusa quando o cadastro da CBX não informa ID FIDE', () => {
        // Aqui quem falha é o dado da CBX, não o jogador: não pode travar a inscrição.
        expect(confirmarIdFidePelaCbx('44731736', jogadorCbx(null))).toEqual({
            ok: false,
            motivo: 'O cadastro da CBX não informa ID FIDE.',
            divergente: false
        })
    })
})
