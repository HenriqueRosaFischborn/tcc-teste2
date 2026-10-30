import './unique.css'
import './responsive.css'
import Logo from '@/components/ui/logo'
import RegisterForm from './form/form'
import GoogleSignIn from '@/components/auth/google-signin'

export default function Register() {
    return (
        <>
            <div id='login-content'>
                <Logo width='200' />
                <h1>Cadastre-se</h1>

                <RegisterForm />
                <GoogleSignIn label='Cadastrar com Google' />
                <p className='auth-alt'>
                    <strong>Já possui uma conta? <a href="/entrar">Entre</a></strong>
                </p>
            </div>

            <div id='img'>
                <img src="/images/register.png" alt="login" fetchPriority='low' loading='lazy' decoding='async'/>
            </div>
        </>
    )
}
