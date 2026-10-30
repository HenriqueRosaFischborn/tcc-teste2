import InscriptionForm from './form/inscription-form'

// Folga para a consulta aos sites oficiais e o envio dos emails terminarem
// antes do limite de execução da função na Vercel.
export const maxDuration = 60

export default function Torneio() {
    return <InscriptionForm />
}
