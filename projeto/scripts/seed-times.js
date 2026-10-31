// Recria a tabela `tempo` com a lista padrão de ritmos do clube.
// O `id` é identity: reiniciamos a contagem para os registros ficarem 1..17.
require('dotenv').config({ path: '.env' })
require('dotenv').config({ path: '.env.local' })

const { Client } = require('pg')

// [minutos, incremento] — a mesma ordem usada no formulário de torneio
// (getTimes ordena por time e depois por plus, então a ordem aqui é só estética).
const TEMPOS = [
  [1, 0],
  [2, 1],
  [3, 0],
  [3, 2],
  [5, 0],
  [5, 3],
  [10, 0],
  [10, 5],
  [15, 0],
  [15, 10],
  [20, 0],
  [25, 5],
  [30, 0],
  [30, 30],
  [60, 0],
  [60, 30],
  [90, 30]
]

async function main() {
  const db = new Client({ connectionString: process.env.DATABASE_URL })
  await db.connect()

  const antes = await db.query('select count(*)::int as n from public.tempo')
  console.log(`tempo antes: ${antes.rows[0].n} registro(s)`)

  if (antes.rows[0].n > 0) {
    throw new Error('A tabela tempo não está vazia. Nada foi inserido.')
  }

  await db.query('begin')

  try {
    // Zera a identity para os novos registros começarem em 1.
    await db.query('alter table public.tempo alter column id restart with 1')

    for (const [time, plus] of TEMPOS) {
      await db.query('insert into public.tempo (time, plus) values ($1, $2)', [time, plus])
    }

    await db.query('commit')
  } catch (e) {
    await db.query('rollback')
    throw e
  }

  const depois = await db.query('select id, time, plus from public.tempo order by id')
  console.table(depois.rows)

  await db.end()
}

main().catch(e => {
  console.error('ERRO:', e.message)
  process.exit(1)
})
