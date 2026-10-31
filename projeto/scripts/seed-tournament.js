// Cria um torneio de teste com divisões e categorias, seguindo as mesmas regras
// do formulário de "adicionar torneio":
//
// - Divisão Absoluto (genre ambos, isAbsolute = true) com a categoria "Absoluto"
//   (de 1900 até o ano de nascimento de quem tem 19 anos hoje).
// - Divisões Masculino e Feminino com Sub 8, 10, 12, 14 e 16. Cada Sub N cobre
//   os anos de nascimento [anoAtual - N, anoAtual - N + 1] — só os pares são
//   usados porque faixas vizinhas (Sub 8 e Sub 9, por exemplo) se sobrepõem.
//
// Uso: node scripts/seed-tournament.js
require('dotenv').config({ path: '.env' })
require('dotenv').config({ path: '.env.local' })

const { Client } = require('pg')

const TITULO = 'Torneio Teste'
const SUBS = [8, 10, 12, 14, 16]
const ABSOLUTE_VALUE = 19
const MIN_YEAR = 1900
const VALOR_BASE = 30
const VALOR_ABSOLUTO = 50

async function main() {
  const db = new Client({ connectionString: process.env.DATABASE_URL })
  await db.connect()

  const anoAtual = new Date().getFullYear()

  const existente = await db.query('select id from public.torneio where title = $1', [TITULO])

  if (existente.rowCount > 0) {
    throw new Error(`Já existe um torneio "${TITULO}". Nada foi criado.`)
  }

  // Ritmo 10 + 0 para os dois tabuleiros (digital e analógico).
  const tempo = await db.query('select id from public.tempo where time = 10 and plus = 0')

  if (tempo.rowCount !== 1) {
    throw new Error('Ritmo 10 + 0 não encontrado na tabela tempo.')
  }

  const idTempo = tempo.rows[0].id

  // Inscrições fecham em 30 dias, evento em 45 dias a partir de hoje.
  const fechamento = new Date()
  fechamento.setDate(fechamento.getDate() + 30)
  fechamento.setHours(23, 59, 0, 0)

  const evento = new Date()
  evento.setDate(evento.getDate() + 45)
  evento.setHours(14, 0, 0, 0)

  await db.query('begin')

  try {
    const torneio = await db.query(
      `insert into public.torneio
         (title, "time-digital", time_analog, local, local_link, date_event, date_inscri, chave_pix, link_chessresults, inscri_closed_by_arbiter)
       values ($1, $2, $3, $4, $5, $6, $7, $8, $9, false)
       returning id`,
      [
        TITULO,
        idTempo,
        idTempo,
        'Sede do CXA - Araranguá',
        null,
        evento,
        fechamento,
        'cxa@teste.com',
        null
      ]
    )

    const idTorneio = torneio.rows[0].id

    const divisions = [
      { name: 'Masculino', genre: 'masculino', isAbsolute: false },
      { name: 'Feminino', genre: 'feminino', isAbsolute: false },
      { name: 'Absoluto', genre: 'ambos', isAbsolute: true }
    ]

    for (const division of divisions) {
      const div = await db.query(
        `insert into public.divisoes (id_torneio, name, genre, "isAbsolute")
         values ($1, $2, $3, $4) returning id`,
        [idTorneio, division.name, division.genre, division.isAbsolute]
      )

      const idDivisao = div.rows[0].id

      const categorias = division.isAbsolute
        ? [{ name: 'Absoluto', min: MIN_YEAR, max: anoAtual - ABSOLUTE_VALUE, value: VALOR_ABSOLUTO }]
        : SUBS.map((sub) => ({
            name: `Sub ${sub}`,
            min: anoAtual - sub,
            max: anoAtual - sub + 1,
            value: VALOR_BASE
          }))

      for (const categoria of categorias) {
        await db.query(
          `insert into public.categoria (id_torneio, name, value, min_y, max_y, default_division)
           values ($1, $2, $3, $4, $5, $6)`,
          [idTorneio, categoria.name, categoria.value, categoria.min, categoria.max, idDivisao]
        )
      }
    }

    await db.query('commit')
  } catch (e) {
    await db.query('rollback')
    throw e
  }

  console.log(`Torneio "${TITULO}" criado (ano de referência: ${anoAtual}).`)

  const resumo = await db.query(
    `select d.name as divisao, d.genre, d."isAbsolute" as absoluto, c.name as categoria, c.min_y, c.max_y, c.value
       from public.divisoes d
       join public.categoria c on c.default_division = d.id
      where d.id_torneio = (select id from public.torneio where title = $1)
      order by d.id, c.min_y desc`,
    [TITULO]
  )

  console.table(resumo.rows)

  await db.end()
}

main().catch(e => {
  console.error('ERRO:', e.message)
  process.exit(1)
})
