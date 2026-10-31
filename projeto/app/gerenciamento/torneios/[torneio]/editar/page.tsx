import './unique.css'
import './responsive.css'
import AddTournmentForm from './form/form'
import getTimes from './getTimes'
import redirectTournment from '@/app/torneios-abertos/[torneio]/redirect'
import { redirect } from 'next/navigation'
import { requireAdmin } from '@/lib/auth-guard'
import db from '@/lib/db'

type Categorie = {
    name: string,
    value: string,
    from: number,
    to: number,
    fide: boolean,
    divisionFor: string,
    divisoes: {
        name: string
    }
}

type Division = {
    name: string,
    isAbsolute: boolean,
    genre: string,
    categories?: Categorie[]
}

export default async function EditTournment({params}: {params: Promise<{ torneio: string }>}) {

    // Rota administrativa: a guarda relê o banco e vem antes de qualquer
    // consulta. O `proxy.ts` só enxerga a flag `admin` do JWT.
    await requireAdmin()

    const {torneio} = await params
    
    const tournment = await redirectTournment(torneio)
    if (!tournment) {
        redirect('/torneios-abertos')
    }

     const tournmentFormatted = {
        ...tournment,
        id: Number(tournment.id),
        time_analog: Number(tournment.time_analog),
        time_digital: Number(tournment.time_digital)
    };

    const times = await getTimes()

    

    const divisions = await db.divisoes.findMany({
        where: {
            id_torneio: tournment.id
        },
        select: {
            name: true,
            isAbsolute: true,
            genre: true
        }
    })

    const emailsDB = await db.emails.findMany({
        where: {
            id_torneio: tournment.id
        },
        select: {
            email: true,
            id: true
        }
    })

    const emails: string[] = []
    emailsDB.forEach(el => {emails.push(el.email)})

    const cats = await db.categoria.findMany({
        where: {
            id_torneio: tournment.id
        },
        include: {
            divisoes: {
                select: {
                    name: true
                }
            }
        }
    })
    
    const categories: Categorie[] = cats.map(cat => ({
        name: cat.name,
        // Mesmo formato que o formulário gera ao adicionar uma categoria
        // (`R$ 0,01`). Com o valor cru (`0.01`) o `sincronizar-categorias`
        // relia o número como texto e gravava R$ 1.
        value: cat.value.toLocaleString('pt-BR', {
            style: 'currency',
            currency: 'BRL'
        }),
        from: cat.min_y,
        to: cat.max_y,
        fide: cat.vale_fide,
        // O formulário identifica a divisão pelo NOME (`divisionFor` é sempre
        // comparado com `division.name` no `catArea`). Antes vinha o id de
        // `default_division`, então nenhuma categoria vinda do banco casava com
        // a divisão escolhida ao adicionar uma nova — e as demais categorias
        // daquela divisão sumiam da tela.
        divisionFor: cat.divisoes.name,
        divisoes: {
            name: cat.divisoes.name
        }
    }))

    const defaultDivisions: Division[] = [...divisions]

    defaultDivisions.forEach((el, i) => {
        const catsFiltered = categories.filter(c => c.divisoes.name == el.name)
        defaultDivisions[i].categories = catsFiltered
    })
    // for (let i = 0 ; i < defaultDivisions.length ; i++) {
        
    // }
    
    return (
        <>
            <AddTournmentForm defaultEmails={emails} defaultDivisions={defaultDivisions} tournment={tournmentFormatted} times={times}/>
        </>
    )
}

