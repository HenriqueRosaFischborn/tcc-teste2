import './unique.css'
import './responsive.css'
import ResetPassword from './form/form'

export default function ForgotPassword() {


    return (
        <>
            <div id='img'>
                <img src="/images/password.png" alt="login" fetchPriority='low' loading='lazy' decoding='async'/>
            </div>
            <ResetPassword />
        </>
    )
}
