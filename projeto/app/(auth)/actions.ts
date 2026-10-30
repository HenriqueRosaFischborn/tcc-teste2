'use server'

import { signIn } from "@/auth"

/**
 * Redireciona o usuário para o consentimento do Google e volta para a página
 * em que ele estava (ou para a home).
 */
export async function loginWithGoogle(formData: FormData) {
    const urlBack = String(formData.get('urlBack') ?? '')

    // Só aceita caminho interno, para não virar redirecionamento aberto.
    const redirectTo = urlBack.startsWith('/') && !urlBack.startsWith('//') ? urlBack : '/'

    await signIn('google', { redirectTo })
}
