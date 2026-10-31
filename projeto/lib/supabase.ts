// `server-only` faz o build falhar se este módulo for importado por um Client
// Component. É a garantia de que a chave `service_role` (que ignora RLS) nunca
// chega ao navegador.
//
// Não use `'use server'` aqui: o marcador transformaria `getSupabaseAdmin` em
// uma Server Action pública, ou seja, exporia a criação do client privilegiado
// como endpoint.
import 'server-only'

import { createClient } from '@supabase/supabase-js'

export async function getSupabaseAdmin() {
  // A URL é pública (NEXT_PUBLIC_*), a chave NÃO: `SUPABASE_SERVICE_ROLE_KEY`
  // não tem prefixo público e só existe no servidor.
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!url || !key) {
    throw new Error('Variáveis do Supabase não carregadas')
  }

  return createClient(url, key)
}