// Limpeza do ambiente para testes.
//
// Apaga TODOS os dados do banco, menos o usuário mantido (por padrão
// henriquewordpress5@gmail.com, garantido como admin), e apaga TODOS os
// arquivos do bucket `publics` no Supabase Storage.
//
// Uso: node scripts/reset-data.js [email-a-manter]
require('dotenv').config({ path: '.env' })
require('dotenv').config({ path: '.env.local' })

const { Client } = require('pg')
const { createClient } = require('@supabase/supabase-js')

const KEEP_EMAIL = (process.argv[2] || 'henriquewordpress5@gmail.com').toLowerCase()
const BUCKET = 'publics'

// Ordem que respeita as chaves estrangeiras do schema.prisma.
const TABLES = ['passwordresettoken', 'incricao', 'categoria', 'emails', 'divisoes', 'torneio', 'tempo']

async function limparBanco(db) {
  const mantido = await db.query('select id, email, admin from public.usuario where lower(email) = $1', [KEEP_EMAIL])

  if (mantido.rowCount !== 1) {
    throw new Error(`Usuário "${KEEP_EMAIL}" não encontrado (ou duplicado). Nada foi apagado.`)
  }

  await db.query('begin')

  try {
    for (const tabela of TABLES) {
      const r = await db.query(`delete from public."${tabela}"`)
      console.log(`${tabela.padEnd(20)} ${r.rowCount} removidas`)
    }

    const usuarios = await db.query('delete from public.usuario where lower(email) <> $1', [KEEP_EMAIL])
    console.log(`${'usuario'.padEnd(20)} ${usuarios.rowCount} removidos (mantido: ${KEEP_EMAIL})`)

    // Garante que o usuário mantido continua administrador.
    await db.query('update public.usuario set admin = true where lower(email) = $1', [KEEP_EMAIL])

    await db.query('commit')
  } catch (e) {
    await db.query('rollback')
    throw e
  }
}

async function listarRecursivo(supa, prefix, acc) {
  const { data, error } = await supa.storage.from(BUCKET).list(prefix, { limit: 1000 })
  if (error) throw error

  for (const item of data) {
    const path = prefix ? `${prefix}/${item.name}` : item.name
    if (item.id === null) {
      await listarRecursivo(supa, path, acc)
    } else {
      acc.push(path)
    }
  }

  return acc
}

async function limparStorage(supa) {
  const arquivos = await listarRecursivo(supa, '', [])

  if (!arquivos.length) {
    console.log('storage: nenhum arquivo para remover')
    return
  }

  // A API remove no máximo 1000 objetos por chamada.
  for (let i = 0; i < arquivos.length; i += 100) {
    const lote = arquivos.slice(i, i + 100)
    const { error } = await supa.storage.from(BUCKET).remove(lote)
    if (error) throw error
    console.log(`storage: ${lote.length} arquivo(s) removido(s)`)
  }
}

async function main() {
  const db = new Client({ connectionString: process.env.DATABASE_URL })
  await db.connect()

  const supa = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)

  console.log('--- apagando dados do banco ---')
  await limparBanco(db)

  console.log('\n--- apagando arquivos do storage ---')
  await limparStorage(supa)

  console.log('\n--- estado final ---')
  for (const tabela of [...TABLES, 'usuario']) {
    const r = await db.query(`select count(*)::int as n from public."${tabela}"`)
    console.log(`${tabela.padEnd(20)} ${r.rows[0].n}`)
  }

  const restantes = await db.query('select id, email, admin from public.usuario order by id')
  console.table(restantes.rows)

  await db.end()

  const sobrou = await listarRecursivo(supa, '', [])
  console.log(`storage: ${sobrou.length} arquivo(s) restante(s)`)
}

main().catch(e => {
  console.error('ERRO:', e.message)
  process.exit(1)
})
