import { googleEnabled } from "@/auth"
import { loginWithGoogle } from "@/app/(auth)/actions"

/**
 * Botão de login com o Google. Não renderiza nada enquanto as credenciais
 * OAuth não estiverem configuradas no ambiente.
 *
 * `dividerPosition` diz onde fica o separador "ou": acima do botão (padrão,
 * quando ele vem depois do formulário) ou abaixo (quando ele vem primeiro).
 */
export default function GoogleSignIn({
    urlBack,
    label,
    dividerPosition = 'above'
}: {
    urlBack?: string,
    label: string,
    dividerPosition?: 'above' | 'below'
}) {
    if (!googleEnabled) {
        return null
    }

    const divider = <div className="auth-divider">ou</div>

    return (
        <div className={dividerPosition === 'below' ? 'google-signin first' : 'google-signin'}>
            {dividerPosition === 'above' && divider}

            <form action={loginWithGoogle}>
                <input type="hidden" name="urlBack" value={urlBack ?? ''} />
                <button type="submit" className="button google">
                    <img src="/icons/google.svg" alt="" width={20} height={20} loading="lazy" decoding="async" />
                    {label}
                </button>
            </form>

            {dividerPosition === 'below' && divider}
        </div>
    )
}
