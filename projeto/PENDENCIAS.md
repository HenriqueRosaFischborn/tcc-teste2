# Pendências de segurança e integridade

Registro formal de **tudo que ficou para depois**. Revisado no encerramento da
sessão que executou T01–T07.

Regras deste arquivo:

- Uma pendência **só sai daqui quando a correção estiver implementada e
  verificada**. Documentar não é corrigir.
- Concluir uma tarefa do plano **não faz desaparecer** as pendências ligadas a
  ela — as pendências são removidas uma a uma, com prova.
- Cada item aponta a tarefa responsável e como verificar que foi resolvido.

Legenda de prioridade: **Crítica** · **Alta** · **Média** · **Baixa**

---

## PS-01 — Testes de autorização da T05 (gravação)

- **Problema:** a T05 colocou a posse do usuário dentro da leitura **e** da
  gravação (`updateMany` com `uuid` + `id_usuario`), mas não existe teste do caso
  "gravação recusada porque a inscrição é de outra pessoa".
- **Risco (simples):** é a proteção que impede alguém de editar a inscrição de
  outra pessoa. Hoje ela funciona, mas nada avisa se alguém a remover no futuro.
- **Arquivos:** `app/minhas-inscricoes/[inscricao]/editar-informacoes/form/action.ts`,
  `app/minhas-inscricoes/[inscricao]/editar-informacoes/layout.tsx`
- **Solução:** em `tests/`, simular `db.incricao.findFirst` devolvendo `null` e
  `db.incricao.updateMany` devolvendo `{ count: 0 }`; verificar que a action
  responde erro e **não** dispara e-mail nem upload.
- **Prioridade:** Alta
- **Tarefa responsável:** nova tarefa de testes (proposta **T46**)
- **Como verificar:** `npm run test` com dois casos novos cobrindo "inscrição de
  outro dono" na leitura e na gravação.

---

## PS-02 — Rate limit compartilhado e persistente para e-mails

- **Problema:** o limitador (`lib/rate-limit.ts`) guarda os contadores em memória.
  Cada instância do servidor tem o seu, e ele zera quando a instância recicla.
- **Risco (simples):** em produção com várias instâncias, uma pessoa consegue
  enviar mais e-mails do que o limite pretendido, gastando cota do Resend.
- **Arquivos:** `lib/rate-limit.ts`, `app/minhas-inscricoes/action.ts`
- **Solução:** trocar o mapa em memória por tabela no banco (`rate_limit`) ou
  cache compartilhado (Redis/Upstash), mantendo a assinatura `allowAttempt`.
- **Prioridade:** Média
- **Tarefa responsável:** consequência da **T07**; nova tarefa (proposta **T47**)
- **Como verificar:** teste com dois processos/instâncias distintas mostrando que
  o 4º envio continua bloqueado; ou teste de integração contra a tabela.

---

## PS-03 — Recuperação de senha — ✅ RESOLVIDA (T11, 2026-10-30)

- **Problema:** (1) `verifyEmailForgotPassword` e `sendEmailAction` devolviam
  valores que revelavam se o e-mail estava cadastrado; (2) não havia limite de
  tentativas; (3) o e-mail era disparado ao abrir a página (`useEffect` de
  montagem), então um GET com `?email=` já enviava; (4) o token nunca era
  apagado; (5) `createdby` é `@unique`, então a segunda solicitação falhava; (6) o
  estado do formulário devolvia a senha em texto claro.
- **Arquivos:** `app/(auth)/esqueci-minha-senha/form/{action.ts,form.tsx}`,
  `app/(auth)/redefinir-senha/form/{action.ts,form.tsx}`,
  `app/(auth)/entrar/form/form.tsx` (+ `verify-forgot-password.ts`, **apagado**),
  `lib/password.ts` (novo).
- **O que foi feito:** ver a seção T11 em `CONTINUIDADE_AUDITORIA.md` §5.
  Em resumo: upsert do token, consumo na mesma transação da troca de senha,
  resposta genérica em todos os casos, envio só por POST explícito, limite de
  3 pedidos/10 min por e-mail, senha de 8 a 128 caracteres, e nenhum dado
  sensível no estado do formulário.
- **Verificado:** 28 testes novos (três arquivos); mutações derrubam os casos
  correspondentes. `tsc`, `eslint` e `build` verdes.
- **O que NÃO foi verificado:** nenhum e-mail real enviado, nenhum banco real
  tocado, nenhuma tela aberta. O hash argon2 foi verificado com
  `argon2.verify` no teste — é o mesmo caminho do login, mas não é um login real.
- **Resíduos (não corrigidos):** limite em memória (vale por instância, como a
  PS-02); token trafega na URL; validade mudou de 10 para 30 minutos.
- **Prioridade:** **Alta**
- **Tarefa responsável:** **T11**

---

## PS-04 — Escape de dados dinâmicos nos e-mails HTML

- **Problema:** os 8 templates interpolam dados livres do jogador (nome, clube,
  cidade) sem escape explícito. O React escapa texto por padrão, o que mitiga,
  mas não há garantia documentada nem limite de tamanho nos campos.
- **Risco (simples):** um jogador pode tentar inserir conteúdo estranho no e-mail
  que o árbitro recebe, do domínio oficial do clube.
- **Arquivos:** `app/api/email-elements/*.tsx` (8 templates)
- **Solução:** auditar os templates, garantir que nenhum campo passa por
  `dangerouslySetInnerHTML`, e limitar tamanho dos campos no cadastro.
- **Prioridade:** Média
- **Tarefa responsável:** nova tarefa (proposta **T48**)
- **Como verificar:** teste de renderização com nome contendo `<script>` e
  `<b>`, conferindo que o HTML gerado contém o texto escapado.

---

## PS-05 — Hash de senha enviado ao componente cliente — ✅ RESOLVIDA (T14, 2026-10-30)

- **Problema:** `usuarios/page.tsx` fazia `db.usuario.findMany()` sem `select` e
  passava as linhas inteiras — incluindo `password` (hash argon2) — ao Client
  Component `usersTable.tsx`.
- **Risco (simples):** o hash da senha de todos os usuários viajava para o
  navegador. Não é a senha em si, mas é material que nunca deveria sair do
  servidor e ajuda quem tentar quebrar senhas.
- **Arquivos:** `app/gerenciamento/usuarios/page.tsx`, `usersTable.tsx`
- **O que foi feito:** `select: { email: true, admin: true }` — só os dois campos
  que a tela usa (`email` para exibir/buscar/endereçar o `changeFunction`,
  `admin` para a cor e o estado do `<select>`). `usuarios: any[]` virou
  `UsuarioListado[]`, tipo exportado por `usersTable.tsx` que espelha o `select`.
  **Desvio do plano:** `id` e `socio` **não** foram incluídos, porque a interface
  não os consome — o critério da tarefa foi "exclusivamente os campos
  necessários".
- **Verificado:**
  - `tests/users-page.test.ts` — 6 testes; a asserção central confere o objeto
    `select` enviado ao Prisma e que as linhas entregues ao Client Component têm
    apenas as chaves `admin` e `email`.
  - **Teste de mutação executado:** removendo o `select` (e a guarda) do arquivo,
    os **6 testes falham**; restaurado o arquivo, os 29 passam. Os testes não são
    vacuosos.
  - `npx tsc --noEmit` limpo; `npm run build` verde.
- **O que NÃO foi verificado:** nenhuma sessão real foi aberta no navegador — não
  houve inspeção do payload RSC no DevTools. A garantia vem do `select` (o Prisma
  não projeta colunas não pedidas) e dos testes com mock, não de observação em
  tela.
- **Prioridade:** **Crítica**
- **Tarefa responsável:** **T14**

---

## PS-06 — Concorrência na alteração de administradores

- **Problema:** em `changeFunction`, a contagem de administradores e o `update`
  não são atômicos.
- **Risco (simples):** se dois administradores se rebaixarem exatamente ao mesmo
  tempo, o sistema pode ficar **sem nenhum administrador** e ninguém mais
  consegue gerenciar torneios.
- **Arquivos:** `app/gerenciamento/usuarios/changeFunction.ts`
- **Solução:** `db.$transaction(async (tx) => {...}, { isolationLevel:
  'Serializable' })` e tratamento do erro de serialização (Prisma `P2034`),
  redesenhando o retorno para o usuário.
- **Prioridade:** Baixa (administradores cooperam entre si — aceito pelo dono)
- **Tarefa responsável:** **T43**
- **Como verificar:** teste concorrente disparando dois rebaixamentos
  simultâneos e conferindo que a segunda operação falha com mensagem.

---

## PS-07 — RLS desligado na tabela `usuario`

- **Problema:** verificado por consulta ao catálogo do Postgres. RLS está ligado
  em 7 das 8 tabelas; **`usuario` está sem RLS** e não existe nenhuma policy em
  nenhuma tabela. Hoje não é explorável porque `anon`, `authenticated` e
  `service_role` não têm **nenhum privilégio** em nenhuma tabela de `public`.
- **Risco (simples):** é uma proteção que falta. Se algum dia alguém conceder
  acesso pelo painel do Supabase, a tabela com hashes de senha e a marcação de
  administrador fica legível.
- **Arquivos:** configuração do Supabase (não está no repositório)
- **Solução:** `ALTER TABLE public.usuario ENABLE ROW LEVEL SECURITY;` sem criar
  policy (nega tudo por padrão). O Prisma conecta como dono das tabelas e
  `relforcerowsecurity` está desligado, então o app continua funcionando.
  Versionar essa DDL junto das migrations (T13).
- **Prioridade:** Média
- **Tarefa responsável:** nova tarefa (proposta **T44**)
- **Como verificar:** repetir a consulta a `pg_class` mostrando `rls=true` em
  todas as 8 tabelas, e confirmar que o app continua lendo/escrevendo normalmente.
- **⚠️ Exige backup e janela de manutenção.**

---

## PS-08 — Mensagens de erro das Server Actions não aparecem na tela

- **Problema:** as actions dos formulários de torneio devolvem
  `{ message: 'Sessão expirada ou sem permissão' }` (T02) e
  `changeFunction` devolve `{ ok:false, message }` (T03), mas os formulários só
  reagem a `state.message == 'Sucesso'`. Em `editOpenInscri` (botão) o erro é
  lançado e não há canal de retorno nenhum.
- **Risco (simples):** o administrador clica e "não acontece nada" — parece que
  o sistema travou, quando na verdade a operação foi recusada por segurança.
- **Arquivos:** `app/gerenciamento/torneios/adicionar-torneio/form/form.tsx`,
  `app/gerenciamento/torneios/[torneio]/editar/form/form.tsx`,
  `app/gerenciamento/torneios/buttonsOpenClose.tsx`
- **Solução:** renderizar `state.message` quando não for sucesso e usar
  `useFormStatus`/`useActionState` para estado de carregamento.
- **Prioridade:** Média
- **Tarefa responsável:** **T36**
- **Como verificar:** abrir o formulário sem permissão de admin (ou simular) e
  confirmar que a mensagem aparece na tela.

---

## PS-09 — Guarda lança erro em páginas em vez de redirecionar

- **Problema:** `requireUser`/`requireAdmin` lançam. Em Server Components
  (T04/T05) isso cai no error boundary. Acontece com administrador rebaixado que
  ainda tem JWT válido e com usuário deletado que ainda tem sessão.
- **Risco (simples):** a pessoa vê uma tela de erro genérica em vez de ser
  mandada para o login ou para a página inicial.
- **Arquivos:** `app/minhas-inscricoes/[inscricao]/editar-informacoes/layout.tsx`,
  `app/gerenciamento/torneios/[torneio]/analisar-jogadores/page.tsx`,
  `app/gerenciamento/usuarios/page.tsx`
- **Solução:** criar um `requirePageUser()`/`requirePageAdmin()` que faz
  `redirect()` em vez de lançar, e usar nas páginas.
- **Prioridade:** Baixa (é conforto; a segurança já está correta)
- **Tarefa responsável:** nova tarefa (proposta **T45**)
- **Como verificar:** rebaixar um admin com sessão ativa e abrir
  `/gerenciamento/usuarios`; deve redirecionar, não quebrar.

---

## PS-10 — Caixa do e-mail inconsistente (unique × busca)

- **Problema:** `usuario.email` é `@unique` **sensível a caixa**, mas a busca é
  insensível (`findFirst` com `mode: 'insensitive'`, sem `orderBy`). Duas contas
  podem diferir só por maiúsculas, e a busca escolhe uma linha arbitrária.
- **Risco (simples):** alguém pode acabar entrando na conta errada (ou não
  conseguindo entrar) dependendo de como digitou o e-mail.
- **Arquivos:** `prisma/schema.prisma`, `lib/user.ts`
- **Solução:** normalizar para minúsculas (ou `citext`) + índice em
  `lower(email)` + migration de saneamento dos dados existentes.
- **Prioridade:** Alta
- **Tarefa responsável:** **T32** (com apoio de T12/T13)
- **Como verificar:** tentar cadastrar `A@x.com` e `a@x.com`; o segundo deve ser
  recusado. Login deve funcionar com qualquer caixa.
- **⚠️ Exige backup: mexe em dados existentes.**

---

## PS-11 — Destinatário do e-mail de confirmação vem do cliente — ✅ RESOLVIDA (T08, 2026-10-30)

- **Problema:** `updateDataBase` montava o e-mail de confirmação a partir do
  objeto `incricao` que o navegador enviava (`nowIncri`). Era admin-only desde a
  T04, mas o destinatário era escolhido no payload.
- **Risco (simples):** um administrador (ou alguém com a sessão dele) conseguia
  mandar a confirmação para um endereço qualquer, e o conteúdo saía do que o
  navegador mandou, não do banco.
- **Arquivos:** `app/gerenciamento/torneios/[torneio]/analisar-jogadores/client/updateDataBase.ts`
- **O que foi feito:**
  - a gravação passou a ser **aguardada** (`for … await` no lugar do
    `.map(async …)` sem `await`), então o `try/catch` finalmente captura a falha
    e o retorno "Erro" deixa de ser inalcançável;
  - os e-mails saem **depois** do commit, relendo a inscrição do banco
    (`inscricaoParaEmail`) — destinatário, conteúdo e **título do torneio**
    vêm da linha gravada, não do `nameTournment` do formulário;
  - o cast `as Differences` (que tipava o valor como o mapa inteiro) virou
    `as Prisma.incricaoUncheckedUpdateInput`, no ponto de uso.
- **Verificado:** `tests/update-database.test.ts` — 12 testes. O payload traz
  `endereco-do-payload@exemplo.com` e `nameTournment = 'Nome Vindo do Cliente'`;
  o teste confere que o envio usa `endereco-do-banco@exemplo.com` e
  `'Torneio Real do Banco'`, e que a ordem é `update → findUnique → email`.
  - **Teste de mutação A:** trocando `await db.incricao.update` por
    `void db.incricao.update` (o comportamento antigo), falha exatamente
    "falha na gravação vira Erro e não dispara e-mail".
  - **Teste de mutação B:** voltando a montar o e-mail do payload, falham 4
    testes (ordem, destinatário, título e o caso de inscrição apagada).
  - `npx tsc --noEmit` limpo; `npm run build` verde.
- **O que NÃO foi verificado:** nenhuma gravação real no Postgres e nenhum envio
  real pelo Resend. Os testes usam mocks de `db` e dos dois módulos de e-mail.
- **Resíduos (não corrigidos, fora do escopo):**
  - **sem transação** — se a terceira gravação falhar, as duas primeiras já
    foram para o banco e o retorno é "Erro". Endereçado na **T10**;
  - **falha de e-mail não chega ao administrador**: o resultado do envio é
    ignorado (só o log do servidor registra). É a mesma lacuna da **PS-08**
    (T36), que trata das mensagens invisíveis;
  - **nenhuma lista de campos permitidos** — ver **PS-14**.
- **Prioridade:** **Alta**
- **Tarefa responsável:** **T08**

---

## PS-12 — Histórico de migrations incompleto

> **Nota da T09 (2026-10-30):** existe agora uma DDL preparada e **não aplicada**
> — trocar `incricao.uuid_cat` de `ON DELETE CASCADE` para `RESTRICT`. O SQL e o
> procedimento estão em `CONTINUIDADE_AUDITORIA.md` §5 (seção T09). Ela precisa
> entrar nesta migration; até lá, o `schema.prisma` diverge do banco nesse ponto
> de propósito.

- **Problema:** `prisma/migrations/20260129181726_init/migration.sql` cria
  **apenas** a tabela `usuario`. As outras 7 tabelas e todas as FKs existem só no
  banco vivo.
- **Risco (simples):** não é possível recriar o banco a partir do repositório. Se
  o banco se perder, a estrutura se perde com ele.
- **Arquivos:** `prisma/migrations/`
- **Solução:** gerar a migration completa (com FKs e índices) a partir do banco
  atual e validar em um banco vazio.
- **Prioridade:** Alta
- **Tarefa responsável:** **T13** (depois de T12)
- **Como verificar:** criar um banco vazio, rodar `prisma migrate deploy` e
  comparar o schema resultante com o de produção (`prisma migrate diff`).
- **⚠️ Exige backup.**

---

## PS-13 — Páginas administrativas sem guarda no servidor — ✅ RESOLVIDA (T14 + auditoria de /gerenciamento, 2026-10-30)

> Descoberta durante a preparação da T14, em 2026-10-30. **Não estava prevista
> em nenhum documento anterior.** A PS-13 só foi dada por encerrada depois da
> auditoria de toda a árvore `/gerenciamento` (abaixo) — antes disso ela cobria
> apenas a página de usuários.

- **Problema:** `app/gerenciamento/usuarios/page.tsx` chamava `auth()` mas nunca
  `requireAdmin()`. A única proteção era o `proxy.ts`, que decide por
  `token.user.admin` — a flag do **JWT**, congelada por até 30 dias. É
  exatamente a fonte de verdade que a T01 rejeitou ao criar `lib/auth-guard.ts`.
- **Risco (simples):** um administrador rebaixado continuava abrindo a tela e
  lendo o e-mail de todos os usuários — e, junto, o hash da senha (PS-05),
  enquanto a T14 não estivesse feita. A página de análise de jogadores recebeu
  `requireAdmin` na T04; esta ficou de fora.
- **Gravidade real:** não era explorável por visitante anônimo. Exigia um token
  válido cuja flag `admin` ainda fosse `true` — na prática, o cenário de
  rebaixamento.
- **Achado secundário, no mesmo arquivo:** o filtro era
  `where: { email: { not: session?.user.email } }`. Com `session` nulo o valor
  virava `undefined`. **Não foi possível verificar** o comportamento do Prisma
  nesse caso sem banco — a hipótese é que `not: undefined` seja descartado e a
  query devolvesse todos os usuários. O `proxy.ts` barrava antes, mas era a rede
  de proteção segurando, não a página. O filtro agora usa o e-mail da linha do
  banco devolvida por `requireAdmin()`, então o caso `undefined` deixou de
  existir.
- **Arquivos:** `app/gerenciamento/usuarios/page.tsx`
- **O que foi feito:** `await requireAdmin()` antes de qualquer consulta; o
  e-mail do filtro vem do usuário devolvido pela guarda, não da sessão.
- **Verificado:**
  - `tests/users-page.test.ts` — sem sessão (`unauthenticated`), usuário comum
    (`forbidden`) e **administrador revogado no banco com token ainda dizendo
    admin** (`forbidden`): nos três, `findMany` **não** é chamado.
  - Os testes usam o `requireAdmin` **real** (só `@/auth`, `@/lib/user` e
    `@/lib/db` são mockados), então exercitam de fato a guarda da T01.
  - **Teste de mutação:** trocando `requireAdmin()` por `auth()` no arquivo, os 6
    testes falham.
- **O que NÃO foi verificado:** rebaixar um administrador de verdade e abrir a
  tela com a sessão dele. Prova obtida por teste com mocks, não por execução.
- **Prioridade:** **Alta**
- **Tarefa responsável:** **T14** (absorvida por decisão do dono)
- **Páginas vizinhas:** levantadas em 2026-10-30 e **corrigidas na mesma data**
  (ver auditoria abaixo). Total de páginas com guarda após a tarefa: **5**.

### Auditoria de `/gerenciamento` (2026-10-30)

Escopo: todas as páginas e layouts da árvore, incluindo rotas dinâmicas.

| Rota | Guarda no servidor | O que consulta | O que sai para o navegador |
|---|---|---|---|
| `layout.tsx` | — (é Client Component) | nada | menu |
| `menu.tsx` | — (Client Component) | nada | links |
| `torneios/page.tsx` | ⬜ → ✅ **`requireAdmin()`** | `db.torneio.findMany` (sem `select`) + `Storage.list('folders')` por torneio | só ids para os botões; título, local, link, datas e tempos são renderizados no servidor. `chave_pix` é buscado mas **não** chega ao navegador (Server Component) |
| `torneios/[torneio]/editar/page.tsx` | ⬜ → ✅ **`requireAdmin()`** | `redirectTournment` (linha inteira do torneio), `divisoes`, `emails`, `categoria` | **a linha inteira do torneio** (inclui `chave_pix`, `link_chessresults`) + e-mails dos organizadores, entregues ao Client Component do formulário. Legítimo para o admin editar — mas era servido sem guarda |
| `torneios/adicionar-torneio/page.tsx` | ⬜ → ✅ **`requireAdmin()`** | `getTimes()` → `db.tempo.findMany` (com `select`) | apenas a lista de tempos. Nada sensível |
| `torneios/[torneio]/analisar-jogadores/page.tsx` | ⬜ → ✅ **`requireAdmin()`** | `redirectTournment`, `Storage.list` (folders/regulamentos/comprovantes), `getplayers`/`getCategories`/`getDivisons` (**já guardados desde a T04**) | inscritos com `usuario.email` (desvio aprovado da T04), URLs públicas de comprovante, categorias e divisões |
| `usuarios/page.tsx` | ✅ (T14) | `db.usuario.findMany` com `select` | e-mail e flag admin |

Antes desta auditoria, **nenhuma** dessas páginas tinha guarda: a única barreira
era o `proxy.ts`, que decide por `token.user.admin` do JWT. As actions que
gravam já estavam protegidas desde a T02/T03/T04 — **nada disso foi alterado**.

- **Verificado:** `tests/admin-pages-guard.test.ts` — 14 testes. Para as 4
  páginas, em três cenários (sem sessão, usuário comum, administrador revogado
  no banco com token ainda dizendo admin), a página lança antes de tocar em
  banco, Storage ou `redirectTournment`. Dois casos positivos confirmam que o
  admin válido continua passando.
  - **Teste de mutação:** removendo `await requireAdmin()` das 4 páginas, **12
    dos 14 testes falham** (os 2 positivos seguem passando, como esperado).
  - `npx tsc --noEmit` limpo; `npm run build` verde.
- **O que NÃO foi verificado:** nenhum acesso real às telas com sessão de admin
  ou de admin rebaixado. Testes com mock; `Player[]` e o formulário não foram
  renderizados.

### Achados novos desta auditoria — documentados, **não corrigidos**

1. **`getTimes.ts` (2 cópias idênticas: `adicionar-torneio/` e `editar/`) tem
   `'use server'` sem precisar.** Só é importado por Server Components, então o
   marcador não serve para nada além de transformar `getTimes` em **Server Action
   pública** que consulta o banco sem autenticação. É a mesma classe de problema
   que a T06 corrigiu em `lib/*`. Impacto baixo (só leitura da tabela `tempo`,
   que não é sigilosa), mas é endpoint exposto sem motivo. **Fora do escopo desta
   tarefa** — remover o marcador é uma linha por arquivo, se autorizado.
2. **`verifydates.ts` (2 cópias) tem `'use server'` e precisa dele**: é importado
   por `catArea.tsx`, que é Client Component. Ali o marcador é correto — mas a
   função é uma Server Action pública sem guarda. É **função pura**, sem acesso a
   banco ou Storage, então o risco é de consumo de CPU, não de dado.
3. **`getInformations.ts` continua `'use server'` com `requireAdmin` em cada
   export** (T04). Funciona, mas o modelo "arquivo inteiro vira endpoint" é o que
   gerou os problemas da T06.

- **Pendência restante de verdade:** **PS-09** — a guarda **lança**, então um
  administrador rebaixado vê o *error boundary* em vez de ser redirecionado ao
  login. Conforto, não segurança.

---

## PS-14 — `updateDataBase` sem lista de campos permitidos — ✅ RESOLVIDA (T49, 2026-10-30)

- **Problema:** a action percorria `Object.keys(defaultIncri[uuid])` — chaves que
  vinham do payload do navegador — e gravava cada diferença. Não existia lista de
  colunas permitidas, então `id_usuario`, `id_torneio` e até `uuid` (chave
  primária) podiam ser enviados e eram escritos.
- **Risco (simples):** um administrador conseguia mover uma inscrição para outra
  conta ou outro torneio sem que a interface oferecesse isso. Admin-only, e um
  admin já pode apagar inscrições — por isso a severidade é menor que a do IDOR
  da T05, que era alcançável por qualquer visitante.
- **Arquivo:** `app/gerenciamento/torneios/[torneio]/analisar-jogadores/client/updateDataBase.ts`
- **O que foi feito:**
  - **lista explícita** `CAMPOS_EDITAVEIS` com os 14 campos que a tela realmente
    edita (levantados um a um em `client.tsx`): `status`, `name`, `city`, `club`,
    `federation`, `titulo`, `id_fide`, `id_cbx`, `rtg_fide`, `rtg_cbx`,
    `data_nasc`, `genre`, `id_division`, `uuid_cat`;
  - **fora da lista:** `uuid`, `id_usuario`, `id_torneio` e qualquer outro campo
    interno — os três primeiros porque não são editáveis na interface, o resto
    porque não existe;
  - **nenhum objeto do cliente vai direto ao Prisma.** `montarDados` constrói o
    `data` campo a campo, com validação de tipo e de faixa em runtime: enum de
    `status`, texto/limite de tamanho, inteiro ≥ 0 com teto, data real entre 1900
    e hoje, booleano, UUID para `uuid_cat`;
  - **sem cast:** o `as Prisma.incricaoUncheckedUpdateInput` da T08 saiu. O tipo
    agora é só o formato do DTO — quem barra valor inválido é a validação. Ficou
    uma rede de segurança que recusa a gravação se algum campo escapar da lista;
  - **uma inscrição inválida cancela a operação inteira** (nada é gravado), em
    vez de gravar metade;
  - payload sem nenhuma alteração deixou de disparar um `UPDATE` vazio.
- **Verificado:** `tests/update-database.test.ts` — 35 testes. Cobrem: os 14
  campos legítimos gravados juntos; `null` aceito nas colunas que permitem;
  `id_usuario`/`id_torneio`/`uuid`/campos inventados ignorados; `uuid` de
  inscrição fora de formato recusado; 13 casos de valor inválido (`status` fora
  do enum, `genre` texto, `id_fide` negativo/fracionário/texto, rating acima do
  teto, `name` numérico/vazio/longo, data inválida, data no futuro, `uuid_cat`
  fora do formato, `id_division` texto); JSON malformado.
  - **Mutação A** (voltar a copiar todas as chaves do payload): **7 testes
    falham**, incluindo todos os de identificador.
  - **Mutação B** (remover faixa numérica e enum de `status`): falham exatamente
    os 4 testes desses casos.
  - `npx tsc --noEmit` limpo; `eslint` sem erros nem warnings; `npm run build`
    verde.
- **O que NÃO foi verificado:** nada disso rodou contra um Postgres real. Os
  testes usam mock de `db`; o comportamento do Prisma com `null` em coluna
  `BigInt?` e `Date` em `@db.Date` é suposto, não observado.
- **Resíduos (não corrigidos):**
  - **`uuid_cat` e `id_division` são validados no formato, mas não no vínculo:**
    nada confere se a categoria pertence ao mesmo torneio da inscrição, nem se a
    divisão existe naquele torneio. Fechar isso exige uma consulta ao banco por
    gravação — registrado na **PS-15 (T50)** junto com a transação;
  - **sem transação**: falha no meio deixa gravação parcial — **PS-15 (T50)**;
  - **uuid de inscrição de outro torneio** continua alcançável pela action (é
    admin-only e o admin já edita qualquer torneio pela própria tela; não é
    escalada de privilégio). Documentado, não corrigido.
- **Prioridade:** Média
- **Tarefa responsável:** **T49**

## PS-15 — `updateDataBase` grava sem transação — ✅ RESOLVIDA (T50, 2026-10-30)

> Registrada em 2026-10-30 como tarefa **própria e separada da T10**. A T10
> continua responsável pelas transações dos fluxos de criação/edição de torneio;
> esta era específica da confirmação de pagamentos.

- **Problema:** a T08 corrigiu o `await`, mas as gravações continuavam soltas: o
  laço fazia `await db.incricao.update(...)` uma por vez, sem transação. Se a
  terceira falhasse, as duas primeiras já estavam commitadas.
- **Risco (simples):** o administrador confirma o pagamento de 20 jogadores, o
  banco cai na metade, e o sistema responde "Erro" — mas 12 ficaram confirmados e
  8 não. Pior: como o retorno é antecipado, **nenhum** e-mail sai, então há
  jogadores confirmados no banco que nunca foram avisados.
- **Arquivo:** `app/gerenciamento/torneios/[torneio]/analisar-jogadores/client/updateDataBase.ts`
- **O que foi feito:**
  - **transação interativa** (`db.$transaction(async (tx) => …)`) cobrindo a
    validação e todas as gravações: ou tudo entra, ou nada entra. Interativa e
    não de array porque o passo seguinte depende do que foi lido no anterior;
  - **todas as escritas passam por `tx`**, nunca pelo client de fora;
  - **envio de e-mails só depois do commit** — já era assim desde a T08, e agora
    o "commit" é de fato um só;
  - **vínculo categoria × torneio validado dentro da transação:** `uuid_cat`
    precisa existir e pertencer ao mesmo `id_torneio` da inscrição; `id_division`
    idem. Antes só o formato era checado (T49), e a FK aceitaria uma categoria de
    outro torneio;
  - inscrição inexistente na hora da validação → erro, transação revertida;
  - payload sem nenhuma alteração **não abre transação**;
  - `divisao: null` (limpar o campo) continua válido e não dispara consulta.
- **Verificado:** `tests/update-database.test.ts` — 47 testes (12 novos).
  Os novos cobrem: gravação pelo client da transação e nunca pelo de fora; falha
  no meio sem nenhuma gravação commitada e sem e-mail; e-mail depois do término;
  payload vazio sem transação; categoria e divisão do mesmo torneio aceitas;
  categoria/divisão de **outro** torneio recusadas; categoria/divisão
  inexistentes recusadas; inscrição inexistente recusada; nenhuma consulta de
  vínculo quando nada de categoria/divisão mudou; limpar a divisão sem consulta.
  - **Mutação A** (gravar por `db.incricao.update` em vez de `tx`): derruba os
    testes de transação e os de gravação.
  - **Mutação B** (remover `validarVinculos`): falham exatamente os 6 testes de
    vínculo.
  - `npx tsc --noEmit` limpo; `eslint` sem erros nem warnings; `npm run build`
    verde.
- **O que NÃO foi verificado:** **o rollback não foi observado.** Os testes usam
  um `$transaction` de mentira que só "commita" o buffer quando o callback
  termina — isso prova que a action deixa o erro subir e não engole no meio, mas
  quem desfaz as linhas é o Postgres, e nenhum banco real foi tocado. Também não
  houve envio real pelo Resend.
- **Resíduos (não corrigidos, fora do escopo):**
  - **isolation level padrão (read committed)**, sem retry de `P2034`. Uma
    escrita concorrente entre a leitura e o commit teórica e remotamente poderia
    escapar; Serializable exigiria tratar conflito de serialização. Comentado no
    código;
  - **lote grande numa transação só**: as gravações são sequenciais dentro da
    transação, então confirmar muitas inscrições de uma vez segura a transação
    por mais tempo. Não medido;
  - **uuid de inscrição de outro torneio** continua alcançável pela action
    (admin-only; resíduo já registrado na PS-14);
  - **falha de e-mail não chega ao administrador** (PS-08 / T36).
- **Prioridade:** **Alta**
- **Tarefa responsável:** **T50**

---

## PS-16 — Falhas intermitentes do Vitest

> Registrada em 2026-10-30 para investigação. **Não é uma vulnerabilidade.**

- **Sintoma:** em **2 de ~17 execuções** de `npm run test`, o resultado foi
  `Test Files N failed` / `Tests no tests` / `worker 97%`, com exit ≠ 0 — sem
  erro útil no log. Nas 9 tentativas seguintes de reprodução (6 isoladas, 3 logo
  após `next build`) não repetiu; 78 testes passaram em todas.
- **Risco (simples):** a suíte pode reportar falha sem que exista defeito, o que
  enfraquece a confiança no "está verde" e pode mascarar uma falha real no meio
  do ruído.
- **Arquivos:** `vitest.config.mts`, `package.json`
- **Solução proposta:** investigar com `--no-file-parallelism` e/ou
  `pool: 'forks'` com `singleFork`, comparando; capturar `--reporter=verbose` e
  o stderr completo na próxima ocorrência; considerar `poolOptions` com
  `maxForks` menor (o ambiente é Windows com o dev server rodando).
- **Prioridade:** Baixa
- **Tarefa responsável:** nova tarefa (**T51**)
- **Como verificar:** 20 execuções consecutivas sem o sintoma, ou o sintoma
  reproduzido com causa identificada.

---

## Mapa pendência → tarefa (para não duplicar)

| Pendência | Tarefa do plano | Também relacionada |
|---|---|---|
| PS-01 | nova (T46) | T05 |
| PS-02 | nova (T47) | T07 |
| PS-03 | **T11** — ✅ resolvida em 2026-10-30 | T28 (proxy), T30 (já coberto pelo POST) |
| PS-04 | nova (T48) | — |
| PS-05 | **T14** — ✅ resolvida em 2026-10-30 | — |
| PS-06 | **T43** | T03 |
| PS-07 | nova (T44) | T13 |
| PS-08 | **T36** | T02, T03 |
| PS-09 | nova (T45) | T04, T05 |
| PS-10 | **T32** | T12, T13 |
| PS-11 | **T08** — ✅ resolvida em 2026-10-30 | T04 |
| PS-12 | **T13** | T12 |
| PS-13 | **T14** — ✅ resolvida em 2026-10-30 | T01, T04 |
| PS-14 | **T49** — ✅ resolvida em 2026-10-30 | T08, T10 |
| PS-15 | **T50** — ✅ resolvida em 2026-10-30 | T08, T49, T10 |
| PS-16 | nova (**T51**) — **não implementada** | — |

**Pendências sem tarefa no plano original** (propostas, precisam de aprovação):
**T44** (RLS), **T45** (guarda de página), **T46** (testes T05), **T47** (rate
limit persistente), **T48** (escape nos e-mails).

---

## Tarefas do plano ainda não executadas

O plano original tem 42 tarefas. Concluídas: T01–T06, T07, **T08**, **T09**
(código; a DDL de FK está preparada e não aplicada), **T11**, **T12** (sem DDL: a
duplicidade é checada na aplicação, por identidade do jogador), **T14**, **T15**,
**T16**, **T17**, **T18** (bucket público dos comprovantes segue como resíduo),
**T19**, **T26**, **T49** e **T50**.

**Pendentes:** T10, T13, T20, T21, T22, T23, T24, T25, T27, T28, T29, T30,
T31, T32, T33, T34, T35, T36, T37, T38, T39, T40, T41, T42 — e a **T43**.

**Novas, fora do plano original:** T44 (RLS, PS-07) · T45 (guarda de página,
PS-09) · T46 (testes da T05, PS-01) · T47 (rate limit, PS-02) · T48 (escape nos
e-mails, PS-04) · T51 (instabilidade do Vitest, PS-16).

Descrição de cada uma em `CONTINUIDADE_AUDITORIA.md`, §4.

**Etapa 1 da sequência recomendada (§9.1):** T14 ✅ · T44 (RLS) ⬜ · T08 ✅

**Prioridade alta em aberto:** **PS-03** (recuperação de senha — token travado,
enumeração de contas, disparo por GET).
