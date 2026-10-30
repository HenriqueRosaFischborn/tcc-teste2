import NextAuth from "next-auth"
import Credentials from "next-auth/providers/credentials"
import Google from "next-auth/providers/google"
import findUserByCredentials, { ensureUserByEmail, findUserByEmail } from "./lib/user"

/**
 * O login com o Google só aparece quando as credenciais do OAuth estão
 * configuradas (AUTH_GOOGLE_ID / AUTH_GOOGLE_SECRET).
 */
export const googleEnabled = Boolean(
  process.env.AUTH_GOOGLE_ID && process.env.AUTH_GOOGLE_SECRET
)


declare module "next-auth" {
  interface User {
    admin?: boolean
  }

  interface Session {
    user: {
      email?: string
      admin?: boolean
    }
  }

  interface JWT {
    admin?: boolean
  }
}

export const { handlers, signIn, signOut, auth } = NextAuth({
  callbacks: {
    async signIn({ user, account }) {
      // Primeiro acesso com o Google: cria a conta no banco se ainda não existir.
      if (account?.provider === 'google') {
        if (!user.email) {
          return false
        }

        await ensureUserByEmail(user.email)
      }

      return true
    },

    async session({token, session}) {
      session.user.admin = Boolean(token.admin)

      return session
    },

    async jwt({token, user, account}) {
      if (account?.provider === 'google') {
        // A sessão do Google começa sem o `admin` que vem do banco.
        const dbUser = token.email ? await findUserByEmail(token.email) : null

        token.admin = Boolean(dbUser?.admin)

        // Usa o id do banco também aqui, para as duas formas de login gerarem
        // a mesma sessão.
        if (dbUser) {
          token.sub = String(dbUser.id)
        }
      } else if (user) {
        token.admin = user.admin
      }

      return token
    }
  },
  // Erros do OAuth (consentimento cancelado, callback inválido, etc.) caem na
  // tela de entrada, onde o botão do Google está à mão para tentar de novo.
  pages: {
    signIn: '/entrar',
    error: '/entrar'
  },
  providers: [
    ...(googleEnabled ? [Google({
      clientId: process.env.AUTH_GOOGLE_ID,
      clientSecret: process.env.AUTH_GOOGLE_SECRET
    })] : []),
    Credentials({
    credentials: {
        email: {},
        password: {}
    },
    authorize: async (credentials) => {
        const user = await findUserByCredentials(credentials.email as string, credentials.password as string)
        return user
    }
  })],
})

//proc
