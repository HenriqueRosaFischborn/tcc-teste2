import db from "@/lib/db";
import UsersTable from "./usersTable";
import { requireAdmin } from "@/lib/auth-guard";

export default async function Users() {
    // A guarda relê o banco a cada requisição, então quem decide o acesso é a
    // coluna `admin` de hoje — e não a flag congelada no JWT por até 30 dias.
    // O `proxy.ts` só consegue olhar o token, por isso a checagem de verdade
    // precisa acontecer aqui: um administrador rebaixado ainda teria um token
    // válido dizendo que é admin.
    const admin = await requireAdmin()

    const usuarios = await db.usuario.findMany({
        where: {
            // O e-mail vem do banco (via guarda), não da sessão: o login ignora
            // a caixa das letras, então comparar com o e-mail do JWT podia
            // deixar o próprio administrador aparecer na lista.
            email: {
                not: admin.email
            }
        },
        // `select` explícito: sem ele a linha inteira — inclusive o hash argon2
        // da senha — viaja no payload para o Client Component. A tabela só usa
        // `email` (exibição, busca e alvo do changeFunction) e `admin` (cor e
        // estado inicial do <select>).
        select: {
            email: true,
            admin: true
        }
    });

    return <UsersTable usuarios={usuarios} />;
}
