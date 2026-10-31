import { beforeEach, describe, expect, it, vi } from 'vitest'

const {
    authMock,
    findUserByEmailMock,
    torneioFindManyMock,
    torneioFindUniqueMock,
    tempoFindManyMock,
    redirectTournmentMock,
    getSupabaseAdminMock,
    storageListMock
} = vi.hoisted(() => ({
    authMock: vi.fn(),
    findUserByEmailMock: vi.fn(),
    torneioFindManyMock: vi.fn(),
    torneioFindUniqueMock: vi.fn(),
    tempoFindManyMock: vi.fn(),
    redirectTournmentMock: vi.fn(),
    getSupabaseAdminMock: vi.fn(),
    storageListMock: vi.fn()
}))

// `cache` do React precisa de um render em andamento; nos testes vira passagem
// direta. Mesmo tratamento dos outros arquivos de teste.
vi.mock('react', async (importOriginal) => {
    const actual = await importOriginal<typeof import('react')>()

    return {
        ...actual,
        cache: (fn: unknown) => fn
    }
})

vi.mock('@/auth', () => ({ auth: authMock }))
vi.mock('@/lib/user', () => ({ findUserByEmail: findUserByEmailMock }))

vi.mock('@/lib/db', () => ({
    default: {
        torneio: { findMany: torneioFindManyMock, findUnique: torneioFindUniqueMock },
        tempo: { findMany: tempoFindManyMock },
        divisoes: { findMany: vi.fn() },
        emails: { findMany: vi.fn() },
        categoria: { findMany: vi.fn() }
    }
}))

vi.mock('@/lib/supabase', () => ({ getSupabaseAdmin: getSupabaseAdminMock }))

vi.mock('@/app/torneios-abertos/[torneio]/redirect', () => ({
    default: redirectTournmentMock
}))

vi.mock('@/app/gerenciamento/torneios/[torneio]/analisar-jogadores/getInformations', () => ({
    getplayers: vi.fn(),
    getCategories: vi.fn(),
    getDivisons: vi.fn()
}))

// Componentes de cliente: só interessam as consultas que a página faz antes de
// chegar neles.
vi.mock('next/form', () => ({ default: () => null }))
vi.mock('@/app/gerenciamento/torneios/adicionar-torneio/form/form', () => ({ default: () => null }))
vi.mock('@/app/gerenciamento/torneios/[torneio]/editar/form/form', () => ({ default: () => null }))
vi.mock('@/app/gerenciamento/torneios/[torneio]/analisar-jogadores/client/client', () => ({ default: () => null }))
vi.mock('@/app/gerenciamento/torneios/[torneio]/deletar-jogadores/button', () => ({ default: () => null }))
vi.mock('@/app/gerenciamento/torneios/buttonsOpenClose', () => ({ ButtonClose: () => null, ButtonOpen: () => null }))

import Tournments from '@/app/gerenciamento/torneios/page'
import EditTournment from '@/app/gerenciamento/torneios/[torneio]/editar/page'
import AddTournment from '@/app/gerenciamento/torneios/adicionar-torneio/page'
import Players from '@/app/gerenciamento/torneios/[torneio]/analisar-jogadores/page'
import { UnauthorizedError } from '@/lib/auth-guard'

const admin = { id: 1, email: 'admin@exemplo.com', admin: true, socio: true }
const comum = { id: 7, email: 'jogador@exemplo.com', admin: false, socio: false }

const params = { params: Promise.resolve({ torneio: 'torneio-teste' }) }

beforeEach(() => {
    authMock.mockReset()
    findUserByEmailMock.mockReset()
    torneioFindManyMock.mockReset()
    torneioFindUniqueMock.mockReset()
    tempoFindManyMock.mockReset()
    redirectTournmentMock.mockReset()
    getSupabaseAdminMock.mockReset()
    storageListMock.mockReset()

    storageListMock.mockResolvedValue({ data: [], error: null })
    getSupabaseAdminMock.mockResolvedValue({
        storage: {
            from: () => ({
                list: storageListMock,
                getPublicUrl: () => ({ data: { publicUrl: 'https://exemplo.com/arquivo' } })
            })
        }
    })
})

/** Deixa o banco e o Storage "limpos" para a asserção de que nada foi tocado. */
function nadaFoiConsultado() {
    expect(torneioFindManyMock).not.toHaveBeenCalled()
    expect(torneioFindUniqueMock).not.toHaveBeenCalled()
    expect(tempoFindManyMock).not.toHaveBeenCalled()
    expect(redirectTournmentMock).not.toHaveBeenCalled()
    expect(storageListMock).not.toHaveBeenCalled()
}

describe('páginas administrativas — sem sessão', () => {
    beforeEach(() => {
        authMock.mockResolvedValue(null)
    })

    it.each([
        ['/gerenciamento/torneios', () => Tournments()],
        ['/gerenciamento/torneios/[torneio]/editar', () => EditTournment(params)],
        ['/gerenciamento/torneios/adicionar-torneio', () => AddTournment()],
        ['/gerenciamento/torneios/[torneio]/analisar-jogadores', () => Players(params)]
    ])('%s recusa antes de consultar', async (_rota, executar) => {
        await expect(executar()).rejects.toBeInstanceOf(UnauthorizedError)
        await expect(executar()).rejects.toMatchObject({ reason: 'unauthenticated' })
        nadaFoiConsultado()
    })
})

describe('páginas administrativas — usuário comum', () => {
    beforeEach(() => {
        authMock.mockResolvedValue({ user: { email: comum.email } })
        findUserByEmailMock.mockResolvedValue(comum)
    })

    it.each([
        ['/gerenciamento/torneios', () => Tournments()],
        ['/gerenciamento/torneios/[torneio]/editar', () => EditTournment(params)],
        ['/gerenciamento/torneios/adicionar-torneio', () => AddTournment()],
        ['/gerenciamento/torneios/[torneio]/analisar-jogadores', () => Players(params)]
    ])('%s recusa antes de consultar', async (_rota, executar) => {
        await expect(executar()).rejects.toMatchObject({ reason: 'forbidden' })
        nadaFoiConsultado()
    })
})

describe('páginas administrativas — administrador revogado no banco', () => {
    beforeEach(() => {
        // O JWT ainda diz que é admin; o banco já não diz.
        authMock.mockResolvedValue({ user: { email: comum.email, admin: true } })
        findUserByEmailMock.mockResolvedValue({ ...comum, admin: false })
    })

    it.each([
        ['/gerenciamento/torneios', () => Tournments()],
        ['/gerenciamento/torneios/[torneio]/editar', () => EditTournment(params)],
        ['/gerenciamento/torneios/adicionar-torneio', () => AddTournment()],
        ['/gerenciamento/torneios/[torneio]/analisar-jogadores', () => Players(params)]
    ])('%s recusa antes de consultar', async (_rota, executar) => {
        await expect(executar()).rejects.toMatchObject({ reason: 'forbidden' })
        nadaFoiConsultado()
    })
})

describe('páginas administrativas — administrador válido', () => {
    beforeEach(() => {
        authMock.mockResolvedValue({ user: { email: admin.email } })
        findUserByEmailMock.mockResolvedValue(admin)
        torneioFindManyMock.mockResolvedValue([])
        tempoFindManyMock.mockResolvedValue([])
    })

    it('a lista de torneios consulta o banco depois da guarda', async () => {
        const elemento = await Tournments()

        expect(torneioFindManyMock).toHaveBeenCalledTimes(1)
        expect(elemento).toBeTruthy()
    })

    it('adicionar torneio carrega os tempos depois da guarda', async () => {
        await AddTournment()

        expect(tempoFindManyMock).toHaveBeenCalledTimes(1)
    })
})
