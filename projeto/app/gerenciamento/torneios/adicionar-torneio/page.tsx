import './unique.css'
import './responsive.css'
import AddTournmentForm from './form/form'
import getTimes from './getTimes'
import { requireAdmin } from '@/lib/auth-guard'


export default async function AddTournment() {

    // Rota administrativa: a guarda relê o banco e vem antes de qualquer
    // consulta. O `proxy.ts` só enxerga a flag `admin` do JWT.
    await requireAdmin()

    const times = await getTimes()
    
    return (
        <>
            <AddTournmentForm times={times}/>
        </>
    )
}