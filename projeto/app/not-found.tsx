import './not-found-page.css'

export const metadata = {
    title: 'Página não encontrada - CXA'
}

/**
 * Tela de 404. O arquivo na raiz de `app` cobre qualquer URL que não exista,
 * então o conteúdo aparece dentro do layout padrão (com header e footer).
 */
export default function NotFound() {
    return (
        <div id='not-found'>
            <img
                src='/logo.png'
                alt='Clube de Xadrez de Araranguá'
                width='190'
                height='auto'
                fetchPriority='low'
                decoding='async'
            />

            <h1>Página não encontrada</h1>

            <p id='nf-text'>
                O endereço que você acessou não existe ou foi removido.
                Confira a URL digitada ou volte para o início do sistema.
            </p>

            <div id='nf-actions'>
                <a href='/' className='button red'>Voltar para a página inicial</a>
            </div>
        </div>
    )
}
