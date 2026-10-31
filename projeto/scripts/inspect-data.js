// Inspeção somente leitura: quantas linhas há em cada tabela, quais usuários
// existem e o que está no storage. Não altera nada.
require('dotenv').config({ path: '.env' })
require('dotenv').config({ path: '.env.local' })

const { Client } = require('pg')
const { createClient } = require('@supabase/supabase-js')

async function main() {
  const db = new Client({ connectionString: process.env.DATABASE_URL })
  await db.connect()

  const tables = ['usuario', 'passwordresettoken', 'torneio', 'tempo', 'divisoes', 'categoria', 'emails', 'incricao']

  console.log('=== CONTAGEM ===')
  for (const t of tables) {
    const r = await db.query(`select count(*)::int as n from public."${t}"`)
    console.log(`${t.padEnd(20)} ${r.rows[0].n}`)
  }

  console.log('\n=== USUÁRIOS ===')
  const users = await db.query('select id, email, admin, socio from public.usuario order by id')
  for (const u of users.rows) {
    console.log(`#${u.id}  ${u.email}  admin=${u.admin}  socio=${u.socio}`)
  }

  await db.end()

  const supa = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)

  console.log('\n=== BUCKETS ===')
  const { data: buckets, error } = await supa.storage.listBuckets()
  if (error) throw error

  if (!buckets.length) console.log('(nenhum bucket)')

  for (const b of buckets) {
    console.log(`- ${b.name} (público: ${b.public})`)
    await listAll(supa, b.name, '')
  }
}

async function listAll(supa, bucket, prefix, depth = 0) {
  const { data, error } = await supa.storage.from(bucket).list(prefix, { limit: 1000 })
  if (error) {
    console.log('  '.repeat(depth + 1) + 'erro: ' + error.message)
    return
  }

  for (const item of data) {
    const path = prefix ? `${prefix}/${item.name}` : item.name
    // Pasta = item sem id de arquivo.
    if (item.id === null) {
      console.log('  '.repeat(depth + 1) + `[dir] ${path}`)
      await listAll(supa, bucket, path, depth + 1)
    } else {
      console.log('  '.repeat(depth + 1) + path)
    }
  }
}

main().catch(e => { console.error(e); process.exit(1) })
