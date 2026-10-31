// Função pura usada por Server Components e por Server Actions.
// Não deve ser `'use server'`: isso a transformaria em uma Server Action
// pública, sem nenhum ganho — ninguém precisa chamá-la do navegador.

export default async function classifyTime(min: number, seg: number) {

    const total = min + seg

    if (total < 3) {
        return 'bullet'
    } else if (total < 10) {
        return 'blitz'
    } else if (total < 60) {
        return 'rapid'
    } else {
        return 'standard'
    }
}