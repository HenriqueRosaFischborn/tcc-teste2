import './unique.css'
import './responsive.css'
import Logo from '@/components/ui/logo'
import LoginForm from './form/form'
import GoogleSignIn from '@/components/auth/google-signin'

export default async function Login({ searchParams }: { searchParams: Promise<{ urlBack?: string }> }) {
    const { urlBack } = await searchParams

    return (
        <>
            <div id='img'>
                <img src="/images/login-copia.png" alt="login" fetchPriority='low' loading='lazy' decoding='async'/>
            </div>
            <div id='login-content'>
                <Logo width='180' />
                <h1>Entrar</h1>
                <GoogleSignIn urlBack={urlBack} label='Entrar com Google' dividerPosition='below' />
                <LoginForm />
                <p className='auth-alt'>
                    <strong>Não possui uma conta? <a href="/cadastro">Cadastre-se</a></strong>
                </p>
            </div>
        </>
    )
}
