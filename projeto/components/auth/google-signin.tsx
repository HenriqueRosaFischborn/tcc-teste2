import { googleEnabled } from "@/auth"
import { loginWithGoogle } from "@/app/(auth)/actions"

/**
 * Botão de login com o Google. Não renderiza nada enquanto as credenciais
 * OAuth não estiverem configuradas no ambiente.
 */
export default function GoogleSignIn({ urlBack, label }: { urlBack?: string, label: string }) {
    if (!googleEnabled) {
        return null
    }

    return (
        <div className="google-signin">
            <div className="auth-divider">ou</div>

            <form action={loginWithGoogle}>
                <input type="hidden" name="urlBack" value={urlBack ?? ''} />
                <button type="submit" className="button google">
                    <img src="/icons/google.svg" alt="" width={20} height={20} loading="lazy" decoding="async" />
                    {label}
                </button>
            </form>
        </div>
    )
}
