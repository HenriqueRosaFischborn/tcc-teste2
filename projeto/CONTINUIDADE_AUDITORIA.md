# Continuidade da Auditoria — Sistema de Torneios de Xadrez (CXA)

> Documento de passagem de contexto. Foi escrito no encerramento da sessão de
> auditoria que executou as tarefas **T01–T07**. Tudo aqui foi verificado no
> código, no repositório ou no banco — nada foi inferido. Onde uma verificação
> foi apenas estática ou baseada em mocks, isso está dito explicitamente.
>
> Leia também: [`PENDENCIAS.md`](./PENDENCIAS.md) (registro formal do que ficou
> para depois).

---

## 1. O sistema

**Domínio:** gerenciamento e inscrição em torneios de xadrez do Clube de Xadrez
de Araranguá (CXA).

**Fluxos principais**

1. Visitante vê a lista de torneios abertos (prazo não vencido e inscrições não
   encerradas pelo árbitro).
2. Jogador autenticado se inscreve em um torneio: escolhe categoria (com preço
   por faixa de ano de nascimento), informa dados pessoais e IDs FIDE/CBX, e
   envia comprovante de PIX. A inscrição nasce com status `Pendente`.
3. Jogador acompanha e edita suas inscrições, e pode solicitar cancelamento por
   e-mail ao árbitro.
4. Administrador/árbitro cria e edita torneios (categorias, divisões, e-mails dos
   organizadores, regulamento, cartaz, QR Code), analisa os inscritos, confirma
   ou recusa pagamentos e gera arquivo TXT.
5. Administrador gerencia usuários (promover/rebaixar admin).

**Stack**

| Camada | Tecnologia |
|---|---|
| Framework | Next.js **16.4.3** (App Router, Turbopack) |
| UI | React **19.3.1**, CSS artesanal por rota + Tailwind instalado (não usado em classes) |
| Linguagem | TypeScript **5.9** (`strict: true`) |
| Banco | PostgreSQL (Supabase) via **Prisma 7.10** com driver adapter `@prisma/adapter-pg` |
| Auth | **NextAuth v5 (`5.0.0-beta.32`)**: Credentials (argon2) + Google OAuth, sessão JWT |
| E-mail | **Resend** + templates **react-email** |
| Storage | **Supabase Storage**, bucket `publics`, chave `service_role` |
| Scraping | **cheerio** sobre FIDE e CBX |
| Testes | **vitest 5.0.5** (instalado durante a auditoria) |

**Arquitetura relevante**

- **Não existe backend separado.** Toda a lógica de servidor são **Server
  Actions** (~25 arquivos `'use server'` em `app/`). A única Route Handler é
  `app/api/auth/[...nextauth]/route.ts`.
- **Não existe camada de acesso a dados.** As actions chamam `db` (Prisma)
  diretamente.
- A autorização de navegação fica em **`proxy.ts`** (o antigo `middleware.ts` do
  Next 16), que só protege **paths**. Server Actions são endpoints POST públicos
  e **não passam pelo proxy** — essa é a causa raiz da maioria dos problemas
  encontrados.
- `NEXT_PUBLIC_*` existentes: `APP_URL` (links de e-mail), `SUPABASE_URL` e
  `SUPABASE_ANON_KEY` (esta última deixou de ser usada na T06).
- Chave `service_role` (`SUPABASE_SERVICE_ROLE_KEY`) usada **apenas** em
  `lib/supabase.ts`, para Storage.

**Modelo de dados (8 tabelas):** `usuario`, `passwordresettoken`, `torneio`,
`categoria`, `divisoes`, `incricao` (nome com typo dentro do banco — é
`inscricao` em português), `tempo`, `emails`. Sem `created_at`/`updated_at`. Sem
índices além das PKs e dois `@unique`. Sem nenhuma `$transaction` no projeto.

---

## 2. Objetivo da auditoria

O dono do projeto pediu uma auditoria técnica completa — arquitetura, lógica de
negócio, performance, segurança, qualidade, UX, dependências e escalabilidade —
com a regra explícita de **não modificar nada** na fase de diagnóstico. O
diagnóstico foi entregue e, em seguida, convertido em um plano de **42 tarefas
numeradas (T01–T42)**, executadas uma por vez, sob autorização explícita a cada
etapa.

Posteriormente surgiu a **T43** (atomicidade da contagem de administradores).

A execução começou pela **T01** e seguiu a ordem autorizada, com uma inversão: a
**T07 foi antecipada** à T06 por conter uma vulnerabilidade explorável.

---

## 3. Resumo dos problemas encontrados

### Segurança (os mais graves)

1. **Escalada de privilégio trivial.** `changeFunction` (server action) não
   verificava sessão: qualquer visitante podia tornar a própria conta
   administrador.
2. **IDOR na edição de inscrição.** A action buscava a inscrição pelo `uuid` do
   formulário e **reescrevia `id_usuario`**, transferindo a posse para quem
   enviasse o POST. O layout de edição também lia dados pessoais de qualquer
   inscrição pelo `uuid` da URL.
3. **CRUD administrativo sem autorização.** Criar/editar/excluir torneio,
   abrir/fechar inscrições e `updateDataBase` não verificavam nada.
4. **Relay de e-mail.** `cancel-solicitation/send.ts` e `new-inscription/send.ts`
   eram `'use server'`: qualquer visitante podia disparar e-mail com HTML e
   destinatários escolhidos por ele, do domínio do clube.
5. **Hash de senha para o navegador.** `usuarios/page.tsx` fazia
   `db.usuario.findMany()` sem `select` e entregava as linhas com `password` ao
   Client Component.
6. **Enumeração de contas / reset travado.** Token de reset nunca era apagado e
   `createdby` é `@unique` → a segunda redefinição falha para sempre. Ação
   pública devolvia booleano revelando se o e-mail existe.
7. **RLS desligado em `usuario`** (verificado no banco na T06).

### Integridade de dados

8. **`updateDataBase` grava dentro de `.map(async)` sem `await`** e responde
   "Alterações salvas" antes de gravar — o fluxo central de confirmação de
   pagamento.
9. **Editar categorias/divisões apaga em cascata todas as inscrições** do
   torneio (`onDelete: Cascade`), sem confirmação nem transação.
10. **Zero transações**; criação de torneio faz 5 escritas independentes.
11. **Sem unicidade** para impedir duas inscrições do mesmo usuário no mesmo
    torneio; sem índices em nenhuma FK.
12. **Migrations só criam `usuario`**: as outras 7 tabelas e todas as FKs existem
    apenas no banco vivo.

### Regra de negócio

13. Inscrição confia no cliente para categoria, preço, rating, título, federação
    e até o nome (campo oculto JSON).
14. Não valida idade, gênero, divisão absoluta, prazo nem encerramento.
15. Comprovante vai para bucket público, sem validação de tipo/tamanho, com erro
    engolido.

### Performance

16. Toda rota é dinâmica (`auth()` no layout raiz, `headers()` inútil na home).
17. N+1 contra o Supabase Storage na home e na tela de análise.
18. Zero `revalidatePath`; 48 `<img>` crus contra 1 `next/image`; 76 KB de CSS
    duplicado; 20 MB em `public/`.

### Qualidade

19. 435 linhas comentadas, duplicatas byte a byte (`getTimes.ts`,
    `verifydates.ts`), 78 `console.log`, dependência não usada (`imask`), `any`
    em pontos críticos, nomenclatura inconsistente.

---

## 4. As 42 tarefas originais + T43, com estado

Legenda: ✅ concluída · ⚠️ concluída com ressalva · ⬜ pendente · 🔒 bloqueada

### Bloco A — Autorização

| ID | Tarefa | Estado |
|---|---|---|
| **T01** | Criar a camada de guarda de sessão (`lib/auth-guard.ts` com `requireUser`/`requireAdmin`) | ✅ |
| **T02** | Proteger as actions de torneio (criar/editar/excluir/abrir-fechar inscrições) | ✅ |
| **T03** | Fechar a promoção a administrador (`changeFunction` + `usersTable`) | ✅ |
| **T04** | Proteger a análise de jogadores (`getInformations`, `updateDataBase`) | ⚠️ com desvio aprovado (ver §6) |
| **T05** | Corrigir o IDOR da edição de inscrição (leitura **e** gravação) | ✅ (teste dedicado pendente — PS-01) |
| **T06** | Parar de expor `service_role` e a chave anon; limpar `'use server'` indevido | ✅ (aguardando aprovação formal) |
| **T07** | Tornar internos os módulos de e-mail; proteger o cancelamento | ✅ (aprovada provisoriamente) |

### Bloco B — Integridade de dados

| ID | Tarefa | Estado |
|---|---|---|
| **T08** | Corrigir a gravação de `updateDataBase` (`await`, e-mail depois do commit, destinatário vindo do banco) | ✅ |
| **T09** | Impedir que editar categoria apague inscrições (`onDelete: Restrict` + confirmação) | ✅ (código) · ⬜ DDL |
| **T10** | Transações nos fluxos de torneio | ⬜ |
| **T11** | Destravar a redefinição de senha (upsert do token, consumo após uso, senha mínima) | ✅ |
| **T12** | Índices e unicidade no schema — **decisão: sem `@@unique`**; duplicidade passou a ser checada na aplicação, por identidade do jogador | ✅ (sem DDL) |
| **T13** | Versionar o schema de verdade (migration completa com FKs) | ⬜ |
| **T14** | Parar de devolver hash de senha ao navegador (`select` em `usuarios/page.tsx`) | ✅ (absorveu a PS-13) |

### Bloco C — Regra de negócio da inscrição

| ID | Tarefa | Estado |
|---|---|---|
| **T15** | Validar categoria/torneio/prazo/encerramento no servidor — inclui a edição (categoria não move a inscrição de torneio) | ✅ |
| **T16** | Descartar o JSON de jogador vindo do cliente (rating, título, federação, nome) | ✅ |
| **T17** | Validar idade, gênero e divisão absoluta | ✅ |
| **T18** | Comprovante seguro (validação, erro visível, estado consistente) | ✅ (bucket público: resíduo documentado) |

### Bloco D — Bugs pontuais

| ID | Tarefa | Estado |
|---|---|---|
| **T19** | `Boolean('false')` na análise de jogadores grava gênero errado | ✅ |
| **T20** | `\|\| true` no `generateTXT` exporta todos os inscritos | ⬜ |
| **T21** | `classifyTime` devolve `standard` para tempo ausente (`NaN`) | ⬜ |
| **T22** | `searchCat` estoura `TypeError` quando nenhuma categoria casa com o gênero | ⬜ |
| **T23** | Upload da edição usa o título no caminho; leitura usa o id | ⬜ |
| **T24** | `contentType` do folder copiado para regulamento e QR Code | ⬜ |
| **T25** | Cancelamento não altera estado (só envia e-mail) | ⬜ |
| **T26** | Edição sempre responde "Você já está inscrito" para quem tem ID FIDE | ✅ |
| **T27** | Unificar a busca de usuário por e-mail (hoje convivem `findUnique` exato e `findUserByEmail` insensível) | ⬜ |

### Bloco E — Fluxo de autenticação

| ID | Tarefa | Estado |
|---|---|---|
| **T28** | Proxy não deve bloquear `/esqueci-minha-senha` e `/redefinir-senha` para quem está logado | ⬜ |
| **T29** | Validar `urlBack` também no login por credenciais (redirecionamento aberto) | ⬜ |
| **T30** | E-mail de redefinição só por POST (hoje dispara com um GET) | ⬜ |
| **T31** | Não devolver senha no `FormState` | ⬜ |
| **T32** | Normalizar e-mail no banco (unique × busca insensível) | ⬜ |

### Bloco F — Performance e UX

| ID | Tarefa | Estado |
|---|---|---|
| **T33** | N+1 de Storage na home | ⬜ |
| **T34** | Parar de tornar tudo dinâmico (`auth()` no layout raiz, `headers()` inútil) | ⬜ |
| **T35** | `revalidatePath` após mutações | ⬜ |
| **T36** | `isPending`/`disabled` real nos 8 formulários (inclui exibir as mensagens de erro das actions) | ⬜ |
| **T37** | Chave PIX visível mesmo sem QR Code | ⬜ |
| **T38** | Links quebrados nos templates de e-mail | ⬜ |

### Bloco G — Limpeza

| ID | Tarefa | Estado |
|---|---|---|
| **T39** | Remover código morto e duplicatas (330 linhas comentadas, `getTimes`/`verifydates`) | ⬜ |
| **T40** | Remover os 78 `console.log` | ⬜ |
| **T41** | Remover `imask` | ⬜ |
| **T42** | Revisar `select`/índices apontados e ajustes finais de limpeza | ⬜ |

### Tarefa adicional

| ID | Tarefa | Estado |
|---|---|---|
| **T43** | Atomicidade da contagem de administradores em `changeFunction` (transação serializável) | ⬜ (só documentada, em código e em `PENDENCIAS.md`) |
| **T49** | Lista de campos permitidos em `updateDataBase` (bloquear `uuid`, `id_usuario`, `id_torneio` e campos inventados; validar valores em runtime) | ✅ |
| **T50** | Transação no `updateDataBase` + vínculo categoria/divisão × torneio | ✅ |

### Tarefas propostas ainda sem execução (fora do plano original)

| ID | Origem | Estado |
|---|---|---|
| **T44** | PS-07 — RLS em `usuario` | ⬜ exige backup |
| **T45** | PS-09 — guarda de página que redireciona em vez de lançar | ⬜ |
| **T46** | PS-01 — testes da gravação da T05 | ⬜ |
| **T47** | PS-02 — rate limit persistente | ⬜ |
| **T48** | PS-04 — escape nos e-mails | ⬜ |
| **T51** | PS-16 — instabilidade do Vitest | ⬜ |

---

## 5. O que foi efetivamente implementado (T01–T07 e T14)

### T01 — `lib/auth-guard.ts` (novo)

Exporta `SessionUser`, `UnauthorizedError` (com `reason: 'unauthenticated' |
'forbidden'`), `requireUser()` e `requireAdmin()`.

- Resolve o usuário **no banco** via `findUserByEmail` (o `Session` augmentado não
  tem `id`), então `admin` vem sempre do banco e não do JWT.
- `cache()` do React memoiza por requisição.
- `import 'server-only'` adicionado na T06.
- **Não tem `'use server'`** — de propósito: transformaria cada função em endpoint
  público.

### T02 — Actions de torneio

`requireAdmin()` em: `editOpenInscri.ts` (2 funções), `adicionar-torneio/form/action.ts`,
`[torneio]/editar/form/action.ts`, `[torneio]/deletar-jogadores/action.ts`.

- As duas actions de formulário devolvem `{ message: 'Sessão expirada ou sem permissão' }`
  (opção "b"); as demais lançam (opção "a"), conforme decidido pelo dono.
- No arquivo de edição a guarda vem **antes dos uploads**.
- `deleteById` não recebeu guarda porque não é exportada (não é action).

### T03 — `changeFunction`

- `requireAdmin()`; recebe o valor **desejado** (antes calculava `!el.admin` no
  cliente); idempotente; valida tipos em runtime; recusa rebaixar o **último**
  administrador; `update` por `id` (não por e-mail).
- `usersTable.tsx`: `onChange` movido para o `<select>`, `e.currentTarget`
  capturado antes do `await`, trata recusa e falha com `alert` e desfaz a escolha.
- **Ajuste adicional:** a limitação de concorrência foi documentada no código como
  **PENDÊNCIA T43** (a pedido do dono).

### T04 — Análise de jogadores

- `requireAdmin()` em `getplayers`, `getCategories`, `getDivisons` e
  `updateDataBase` (esta com opção "a").
- **Desvio aprovado:** o campo `usuario.email` **foi mantido** em `getplayers`,
  porque a tabela administrativa o exibe (`client.tsx:268`) e o e-mail de
  confirmação o usa como destinatário. O critério "nenhum dado de inscrito sai sem
  admin" é atendido pela guarda.

### T05 — IDOR da edição

`editar-informacoes/form/action.ts`:
- `requireUser()` no topo;
- leitura com `findFirst({ where: { uuid, id_usuario: user.id } })`;
- **`id_usuario` removido do `update`** (não transfere mais a posse);
- bloco antigo (`auth()` + `findUnique` por e-mail) removido.

`editar-informacoes/layout.tsx`:
- `requireUser()` + `findFirst` escopado;
- `return` vazio trocado por `redirect('/minhas-inscricoes')`.

**Complemento feito na T07:** a gravação passou de `update({ where: { uuid } })`
para `updateMany({ where: { uuid, id_usuario: user.id } })` com
`if (count === 0) return erro`, e a releitura final também foi escopada. A
autorização agora participa da escrita (um único `UPDATE ... WHERE uuid AND
id_usuario`).

### T06 — Supabase e `'use server'` indevido

- `'use server'` removido de `lib/supabase.ts`, `lib/types.ts` e `lib/classifyTime.ts`
  (consumidores verificados um por um antes).
- `import 'server-only'` em `lib/supabase.ts`, `lib/db.ts`, `lib/user.ts`,
  `lib/auth-guard.ts`.
- `lib/supabaseClient.ts` **deletado** (chave anon embarcada e nunca usada) e
  imports mortos removidos de `individual.tsx`.
- `lib/` não tem mais nenhum `'use server'`.

### T07 — E-mails (executada fora de ordem, antes da T06)

- `app/minhas-inscricoes/action.ts` (**novo**): única porta pública do
  cancelamento. Recebe **só o `uuid`**; `requireUser()`; posse no `where`; limite
  de 3 disparos/10 min por usuário; monta o e-mail a partir do **banco**.
- `cancel-solicitation/send.ts` e `new-inscription/send.ts`: `'use server'`
  removido → deixaram de ser actions.
- `buttonCancelSolicitation.tsx`: recebe só `inscricaoUuid`, trata o resultado, e
  deixou de ser componente client `async`.
- `inscriptions-list.tsx` e `minhas-inscricoes/page.tsx`: removida a serialização
  do prontuário completo (`Player`) para o cliente, que ficou morta.
- `lib/rate-limit.ts` (**novo**): limitador em memória.

### T14 — Hash de senha e guarda da página de usuários (2026-10-30)

Executada com escopo ampliado por autorização do dono: além da PS-05, fechou a
**PS-13**, uma vulnerabilidade descoberta na preparação da tarefa e não prevista
em documento nenhum.

`app/gerenciamento/usuarios/page.tsx`:
- `await requireAdmin()` **antes** de qualquer consulta. Antes a página chamava só
  `auth()` e a única proteção era o `proxy.ts`, que decide por `token.user.admin`
  — a flag congelada no JWT que a T01 rejeitou como fonte de verdade.
- O filtro passou de `session?.user.email` para o e-mail do usuário **devolvido
  pela guarda** (linha do banco). Efeito colateral bom: o administrador deixa de
  aparecer na própria lista quando entra com caixa diferente da cadastrada.
- `select: { email: true, admin: true }` — só o que a tabela usa. Sem `id`, sem
  `socio`, sem `password`.

`app/gerenciamento/usuarios/usersTable.tsx`:
- `usuarios: any[]` → `usuarios: UsuarioListado[]`, tipo exportado junto do
  componente e espelhando o `select`.
- Nenhuma mudança de comportamento na tabela ou na troca de função (T03 intacta).

`tests/users-page.test.ts` (**novo**, 6 testes): sem sessão, usuário comum,
administrador revogado com token ainda dizendo admin, forma do `select`, linhas
entregues ao Client Component sem `password`, e origem do e-mail do filtro. Os
testes usam o `requireAdmin` **real** — só `@/auth`, `@/lib/user` e `@/lib/db`
são mockados.

**Teste de mutação executado e registrado:** com `requireAdmin()` trocado por
`auth()` e o `select` removido, os 6 testes falham; com o arquivo restaurado, os
29 passam.

#### T14 — extensão: auditoria de `/gerenciamento`

A PS-13 não podia ser dada por resolvida enquanto as outras páginas da árvore
continuassem sem guarda. Auditoria feita e correções aplicadas em 2026-10-30:

| Página | Antes | Depois |
|---|---|---|
| `torneios/page.tsx` | sem guarda | `await requireAdmin()` |
| `torneios/[torneio]/editar/page.tsx` | sem guarda | `await requireAdmin()` |
| `torneios/adicionar-torneio/page.tsx` | sem guarda | `await requireAdmin()` |
| `torneios/[torneio]/analisar-jogadores/page.tsx` | sem guarda (só os dados eram protegidos pela T04) | `await requireAdmin()` |
| `usuarios/page.tsx` | sem guarda | feito na T14 |

`layout.tsx` é **Client Component** (`'use client'`) e não acessa dados — a
guarda não pode ficar nele, por isso foi página a página. As Server Actions que
gravam (T02/T03/T04) **não foram tocadas**.

Detalhes por página, dados expostos, achados novos (`getTimes.ts` como action
pública desnecessária) e verificação em `PENDENCIAS.md`, PS-13.

### T08 — Gravação e e-mail do `updateDataBase` (2026-10-30)

`app/gerenciamento/torneios/[torneio]/analisar-jogadores/client/updateDataBase.ts`:

- **`await` de verdade.** A gravação era `Object.keys(differences).map(async k =>
  await db.incricao.update(...))` — o `map` devolvia promessas que ninguém
  aguardava. Resultado: a action respondia "Alterações salvas" **antes** de
  qualquer escrita terminar, o `try/catch` nunca capturava nada (o erro virava
  promise rejeitada sem tratamento) e "Erro" era código morto. Agora é
  `for (const uuid of …) await db.incricao.update(...)`.
- **E-mail depois do commit.** Antes o envio acontecia dentro do laço de diff,
  antes da gravação: um jogador podia receber "inscrição confirmada" e o banco
  continuar em `Pendente`. Agora o laço só anota **quais** uuids mudaram de
  status; o envio acontece depois de todas as gravações.
- **Dados do e-mail vêm do banco.** `inscricaoParaEmail(uuid)` relê a inscrição
  com `categoria`, `divisoes`, `usuario(email)` e `torneio(title)`. O
  destinatário, o conteúdo e o **título do torneio** deixaram de sair do payload
  — o formulário continua enviando `nameTournment`, que agora é ignorado no
  servidor (o campo foi mantido no formulário para não mexer na interface).
- **BigInt → number** antes de montar o e-mail, preservando `null` como `null`
  (o template mostra `—`; `Number(null)` viraria `0`). A função é uma cópia
  tipada com `unknown` da que existe em `getInformations.ts` — a duplicata fica
  registrada para a T39.
- **Cast corrigido:** `data: differences[k] as Differences` (que tipava o valor
  como o mapa inteiro) virou `as Prisma.incricaoUncheckedUpdateInput`.

`tests/update-database.test.ts` (**novo**, 12 testes): autorização; falha de
gravação vira "Erro" sem e-mail; ordem `update → findUnique → email`;
destinatário e título vindo do banco; conversão de BigInt; `Recusada` usando o
template de cancelamento; e os casos em que **não** deve sair e-mail.

**Testes de mutação executados:** (A) `void` no lugar de `await` derruba o teste
de falha de gravação; (B) montar o e-mail do payload derruba 4 testes.

### T49 — Lista de campos permitidos no `updateDataBase` (2026-10-30)

Mesmo arquivo da T08. A action iterava `Object.keys(defaultIncri[uuid])` — chaves
escolhidas pelo navegador — e gravava todas as diferenças. Não havia lista de
colunas permitidas: `id_usuario`, `id_torneio` e `uuid` eram graváveis.

- **`CAMPOS_EDITAVEIS`** (14) levantados um a um em `client.tsx`, que é a única
  tela que chama a action: `status`, `name`, `city`, `club`, `federation`,
  `titulo`, `id_fide`, `id_cbx`, `rtg_fide`, `rtg_cbx`, `data_nasc`, `genre`,
  `id_division`, `uuid_cat`.
- **Bloqueados:** `uuid` (PK), `id_usuario` (dono), `id_torneio` (torneio) e
  qualquer chave inventada. `id_division` e `uuid_cat` são relacionamentos, mas
  continuam permitidos porque são exatamente os dois selects da tabela.
- **`montarDados`** constrói o `data` campo a campo, com validação de tipo e
  faixa em runtime — enum de `status`, limite de tamanho nos textos, inteiro ≥ 0
  com teto, data real entre 1900 e hoje, booleano, UUID para `uuid_cat`.
- **O cast `as Prisma.incricaoUncheckedUpdateInput` saiu.** O tipo virou só o
  formato do DTO; a segurança está na validação. Uma checagem final recusa a
  gravação se algum campo atribuído escapar da lista.
- **Falha em qualquer campo cancela a operação inteira** — nada é gravado.
- Payload sem diferença deixou de disparar `UPDATE` vazio.

`tests/update-database.test.ts` cresceu de 12 para **35 testes**; detalhamento e
resíduos (vínculo categoria × torneio não validado; sem transação) em
`PENDENCIAS.md`, PS-14/PS-15.

**Mutações executadas:** (A) voltar a copiar todas as chaves do payload derruba 7
testes, todos os de identificador entre eles; (B) remover faixa numérica e enum
de `status` derruba exatamente os 4 casos correspondentes.

### T50 — Transação e vínculo com o torneio (2026-10-30)

Mesmo arquivo. Fecha o que a T08 só havia atenuado.

- **Transação interativa** `db.$transaction(async (tx) => …)` envolvendo a
  validação de vínculo e **todas** as gravações. Interativa e não de array
  porque o passo seguinte depende do que foi lido no anterior. Todas as escritas
  passam por `tx` — nunca pelo client de fora.
- **`validarVinculos(tx, alteracoes)`**, dentro da transação: `uuid_cat` tem de
  existir e ser do mesmo `id_torneio` da inscrição; `id_division` idem. A T49 só
  checava formato, e a FK aceitaria uma categoria de outro torneio. Divergência
  lança `VinculoInvalidoError` → transação revertida.
- **Inscrição inexistente** na validação → erro.
- **Payload sem alterações não abre transação**; `divisao: null` (limpar) é
  válido e não consulta nada.
- `Alteracao` passou a carregar `categoria`/`divisao` já validados, para a
  checagem de vínculo não precisar destrinchar o DTO do Prisma de volta (sem
  cast).

`tests/update-database.test.ts` cresceu de 35 para **47 testes**. Os 12 novos
cobrem transação (gravação por `tx`, falha no meio sem commit, ordem do e-mail,
payload vazio) e vínculo (mesmo torneio aceito; outro torneio, inexistente e
inscrição sumida recusados; nenhuma consulta quando nada muda; limpar divisão).

**Mutações executadas:** (A) gravar por `db.incricao.update` em vez de `tx`
derruba os testes de transação e de gravação; (B) remover `validarVinculos`
derruba exatamente os 6 testes de vínculo.

**Nenhum rollback foi observado em banco real** — o `$transaction` dos testes é
um dublê que só commita o buffer quando o callback termina. O que os testes
provam é que a action não engole o erro no meio; desfazer as linhas é do
Postgres.

### T09 — Editar categorias não apaga mais inscrições (2026-10-30)

**O problema:** `editar/form/action.ts` fazia `categoria.deleteMany` e recriava
tudo. Como `incricao.uuid_cat` tem `onDelete: Cascade`, editar categorias apagava
**todas as inscrições do torneio**. O próprio formulário avisava isso num
`confirm()`, que foi reescrito.

**Novo módulo** `editar/form/sincronizar-categorias.ts` (sem `'use server'`, para
não virar endpoint), com a regra *validar antes de escrever*:

1. categoria tem identidade **(divisão + nome)** e é **atualizada pelo `uuid`** —
   que é exatamente o valor em `incricao.uuid_cat`, então o vínculo sobrevive;
2. divisão tem identidade **nome** e é atualizada **pelo `id`**, preservando
   `incricao.id_division`;
3. se uma categoria/divisão **com inscrições** não está no formulário, a edição
   inteira é recusada com mensagem que diz qual item e quantas inscrições;
4. só é apagado o que a validação garantiu não ter inscrição.

**`action.ts`:** a sincronização passou para dentro de uma `db.$transaction`,
**antes** de `torneio.update` e dos e-mails. Se ela recusar, nada é gravado —
antes, a recusa chegaria depois de o torneio e os e-mails já terem mudado.

**`form.tsx`:** a mensagem de recusa agora é renderizada (antes só `'Sucesso'`
era tratado), e o `confirm()` diz a verdade.

**`deletar-jogadores/action.ts`:** apaga as inscrições explicitamente, na mesma
transação, antes do torneio. Sem isso, quando a FK deixar de ser `Cascade`, a
exclusão de torneio passaria a falhar conforme a ordem em que o Postgres processa
os cascatas.

**Testes:** `tests/sincronizar-categorias.test.ts` (12) e
`tests/editar-torneio-action.test.ts` (3). **Mutações:** (A) desligar a validação
derruba os 5 testes de recusa; (B) recriar categorias em vez de atualizar
derruba os 4 de atualização.

#### Migração preparada — **NÃO aplicada**

`schema.prisma`: `incricao.categoria` passou de `onDelete: Cascade` para
`Restrict`. Enquanto a DDL não rodar, o banco continua com `Cascade` e a proteção
é só o código.

```sql
-- Confirme o nome da constraint antes:
--   SELECT conname FROM pg_constraint
--   WHERE conrelid = 'incricao'::regclass AND contype = 'f';

ALTER TABLE "incricao" DROP CONSTRAINT "incricao_uuid_cat_fkey";
ALTER TABLE "incricao" ADD CONSTRAINT "incricao_uuid_cat_fkey"
  FOREIGN KEY ("uuid_cat") REFERENCES "categoria"("uuid")
  ON DELETE RESTRICT ON UPDATE NO ACTION;
```

**Antes de aplicar:** backup, e conferir que nenhuma rotina dependa do cascade
(a única exclusão de torneio passou a apagar as inscrições explicitamente).
**Não executar sem autorização.**

### T26 — Edição não confunde a própria inscrição com duplicata (2026-10-30)

**O problema:** a checagem de duplicidade em `editar-informacoes/form/action.ts`
buscava `findFirst({ where: { id_fide, id_torneio } })` **sem excluir a própria
inscrição**. Ela encontrava a si mesma e respondia "Você já está inscrito" — todo
jogador com ID FIDE ficava permanentemente sem conseguir editar.

**Correção:** `uuid: { not: infosAntigas.uuid }` no `where`. A proteção contra
duplicata real continua: qualquer **outra** inscrição com o mesmo FIDE no mesmo
torneio ainda bloqueia.

**Nada mais mudou:** `requireUser()`, a leitura escopada por `id_usuario` e o
`updateMany({ where: { uuid, id_usuario } })` da T05 estão intactos.

`tests/editar-inscricao-duplicada.test.ts` (7 testes) usa uma tabela falsa de
`incricao` filtrada pelas mesmas condições do `where`, então o teste roda contra
a semântica da consulta, não contra um retorno fixo. **Mutação:** removendo o
`uuid: { not }`, 4 testes falham (a edição legítima, a forma da consulta, a posse
na gravação e o caso de outro torneio) e o de bloqueio real continua passando.

**Achado relacionado (não corrigido):** a edição também aceita `uuidCat` vindo do
cliente e grava `id_torneio` a partir dele. Um jogador autenticado pode mover a
própria inscrição para outro torneio — inclusive um já encerrado. Mesma raiz da
**T15**, que passa a cobrir os dois fluxos.

### T15 + T17 — Regras de inscrição no servidor (2026-10-30)

**Como as regras funcionavam (levantado antes de mexer).** A escolha de categoria
já existia, no cliente, em **dois** lugares:

- `app/torneios-abertos/[torneio]/form/select-category.ts` (inscrição nova);
- `app/minhas-inscricoes/.../search-cat.ts` (edição).

Ambos seguem o mesmo encadeamento: categoria cuja faixa cobre o ano de nascimento
→ senão a mais próxima; sempre filtrando pela divisão da categoria ser do gênero
do jogador ou `ambos`. Divergem só no desempate **dentro** da faixa (um escolhe o
intervalo mais estreito, o outro a ordem do banco). `vale_fide` e
`just_superior` **não participam de nenhuma regra** — só aparecem no formulário
de edição de torneio — então não foram usados.

**Novo módulo** `lib/regras-inscricao.ts` (puro, sem `'use server'`), com
`validarTorneioAberto`, `validarCategoria` e `validarDivisao`. A validação é **por
propriedade, não por igualdade de uuid**, justamente para não quebrar nenhum dos
dois fluxos.

**Inscrição nova** (`submit-inscription.ts`):
- torneio da categoria precisa estar aberto — sem prazo vencido e sem encerramento
  pelo árbitro. A tela esconde o formulário, mas a action é POST público;
- a categoria precisa estar na lista do torneio, ser do gênero do jogador e
  corresponder à idade (com a regra de "mais próxima" preservada);
- a divisão resolvida precisa ser a da categoria ou a absoluta, e compatível com
  o gênero.

**Edição** (`editar-informacoes/form/action.ts`):
- a categoria escolhida precisa pertencer ao **torneio da inscrição**; `id_torneio`
  deixou de ser escrito, então a inscrição não muda mais de torneio;
- mesma validação de idade/gênero/divisão;
- **o prazo não é conferido** — corrigir uma inscrição antiga continua valendo,
  como pedido.

**UI:** `individual.tsx` passou a exibir a mensagem de recusa (antes só 'Sucesso',
'erro' e 'Você já está inscrito' eram tratados).

**Testes:** `tests/regras-inscricao.test.ts` (22, regras puras),
`tests/inscricao-regras.test.ts` (8) e `tests/editar-inscricao-regras.test.ts` (5).
**Mutações:** (A) desligar `validarTorneioAberto` + a checagem de torneio da
categoria derruba 3 testes; (B) desligar `validarCategoria` derruba 6.

**Decisão registrada (dono, 2026-10-30):** a limitação de o cadastro validar o
torneio **da categoria** (e não o torneio da URL) **não é bloqueante** — inscrever
o próprio jogador em outro torneio aberto e elegível já seria possível pelo
caminho normal, sem ganho de privilégio. Não gera tarefa nova.

### T19 — Gênero gravado errado na análise de jogadores (2026-10-30)

**O problema:** em `client.tsx`, o valor do `<select>` era convertido com
`Boolean(value)`. `Boolean('false')` é `true`, então escolher **Feminino** gravava
**Masculino**. Pior: como a conversão rodava no `onChange`, abrir uma linha que já
era feminina e mexer em **qualquer outro campo** também reenviava o gênero errado.

**Correção:** a conversão saiu da linha inline e virou um módulo puro,
`analisar-jogadores/client/converter-valor.ts`:

- `converterValor(tipo, valor)` — `'boolean'` agora é `valor === 'true'`;
  as demais conversões (texto, número, divisão, data) ficaram idênticas;
- `valorDoGenero(genre)` — o caminho inverso, banco → `<select>`.

Com isso os três momentos ficam cobertos e testáveis: **carregar** (banco →
`'true'`/`'false'`), **alterar** (select → booleano) e **salvar** (booleano →
banco, já validado pela T49).

Nenhum valor do banco foi alterado e a interface é a mesma; só a conversão mudou.

`tests/genero-analise.test.ts` (11 testes): as duas opções, a troca
Masculino → Feminino → Masculino, as outras conversões como guarda de regressão,
e três casos fim a fim passando pela `updateDataBase` (trocar para Feminino grava
`false`, trocar para Masculino grava `true`, não mexer não grava gênero).
**Mutação:** voltando `Boolean(valor)`, **4 testes falham** — incluindo o de
"não mexer no select", que é o efeito real do bug.

### T16 + T18 — Dados oficiais e comprovante (2026-10-30)

**Como era.** `submit-inscription.ts` montava nome, federação, título e ratings a
partir de um campo oculto (`playerFide`/`playerCbx`) — JSON que o navegador
enviava. O servidor já sabia consultar a FIDE e a CBX (`verify-player.ts`, com
`cheerio`), mas só o cliente chamava essas funções: bastava forjar o JSON para
gravar rating e título inventados.

**T16 — dados oficiais.**
- O JSON do navegador **deixou de ser lido**. Nome, federação, título e ratings
  vêm de `verifyFideId`/`verifyCbxId`, chamadas **no servidor**, em paralelo
  (`Promise.all`), a partir dos IDs informados.
- **Serviço indisponível ou jogador não encontrado não bloqueia**: a inscrição
  segue com o nome digitado e sem dados oficiais (`null`) — o árbitro completa
  depois na tela de análise. Foi mantida a regra de que jogador sem FIDE nem CBX
  se inscreve normalmente, e as regras de idade/gênero da T15/T17 continuam
  valendo (a validação roda antes).
- A mesma troca foi feita na **edição** de inscrição, que também lia o JSON.

**T18 — comprovante.**
- **Validação antes de gravar** (`lib/comprovante.ts`, puro): só JPG/PNG
  (aceita MIME **ou** extensão, porque alguns navegadores mandam o tipo vazio) e
  até 5 MB — o `bodySizeLimit` do projeto é 20 MB, então qualquer coisa até lá
  entrava no bucket.
- **Falha de upload deixou de virar "inscrição concluída"**: a inscrição recém-
  criada é **apagada** e o jogador recebe uma mensagem clara. Nenhum e-mail é
  enviado nesse caminho. Na edição, a mensagem diz que os dados foram salvos mas
  o comprovante não foi.
- **Privacidade:** conferido que as URLs de comprovante só são entregues à tela
  de análise de jogadores, que agora é admin-only (PS-13). Nenhuma exposição
  dentro do app foi encontrada.

`tests/dados-oficiais-comprovante.test.ts` (8). **Mutações:** (A) voltar a ler o
JSON do cliente derruba 4 testes; (B) desligar a validação do arquivo derruba os
2 de arquivo inválido.

**Resíduo do T18 (não corrigido, sem tarefa nova):** os comprovantes ficam no
bucket **público** `publics`, junto de pastas e regulamentos. Quem tiver a URL
lê o arquivo — o caminho usa o `uuid` aleatório da inscrição, então não é
enumerável, mas a leitura não é controlada. Corrigir exige **bucket privado +
URLs assinadas**, o que é mudança de infraestrutura (fora do escopo combinado).

#### Ajustes pedidos na revisão da T16/T18 (2026-10-30)

1. **Limite do comprovante voltou para 20 MB** — é o mesmo teto do
   `serverActions.bodySizeLimit` do projeto. Comentário no código registra que o
   multipart soma overhead, então o máximo efetivo da plataforma fica um pouco
   abaixo do teto do arquivo.
2. **Edição preserva os dados oficiais quando o serviço cai.** Antes, FIDE/CBX
   indisponível fazia `ratingParaGravar` devolver `null` e **apagava** o rating
   já gravado. Agora a consulta é tri-estado (`encontrado` / `indisponivel` /
   `sem-id`): encontrado → rating oficial; sem ID → limpa; indisponível →
   **mantém o valor do banco**. Nome, título e federação já não eram tocados na
   edição.
3. **Desfazer a inscrição sem comprovante agora distingue os dois desfechos.**
   Se o `delete` falha, a mensagem diz que a inscrição **ficou registrada sem
   comprovante** em vez de afirmar que não foi concluída.

Testes: 171 no total; dois novos cobrem a preservação do rating e o desfazer que
falha. **Mutações:** apagar o rating na indisponibilidade e "sempre dizer que
desfez" derrubam exatamente esses dois testes.

### T12 — Inscrições duplicadas: verificação no banco (2026-10-30)

**Levantamento feito com consulta somente-leitura** (nenhum dado alterado):

| Item | Valor |
|---|---|
| Inscrições no banco | **13** |
| Usuários / torneios | 3 / 3 |
| Grupos (torneio, usuário) com mais de uma inscrição | **1** |
| Detalhe do grupo | torneio **18** ("Torneio de Teste - Circuito 2026"), usuário **14** (o admin), **13 inscrições** |
| Grupos com o mesmo `id_fide` no torneio | 0 |
| Inscrições apontando para torneio inexistente | 0 |

**O achado importante:** as 13 inscrições do usuário 14 têm **13 nomes
diferentes** (Gabriel Pereira, Isabela Martins, Ana Beatriz…). Não são a mesma
pessoa inscrita 13 vezes — é **uma conta inscrevendo 13 jogadores diferentes**.

Ou seja: hoje o modelo amarra a inscrição à **conta**, e a conta pode inscrever
várias pessoas. Um `@@unique([id_usuario, id_torneio])` **não é aplicável sem
decidir o que fazer com essas 13 linhas** — e, depois de aplicado, a conta do
admin não poderia mais inscrever um segundo jogador no mesmo torneio.

**Por isso a DDL não foi preparada ainda**: a escolha entre (a) exigir uma
inscrição por conta, apagando/arquivando 12 linhas, e (b) manter o modelo atual e
impedir duplicidade só na aplicação, muda o desenho. **Decisão pendente do dono.**

#### Decisão e execução (opção B, 2026-10-30)

**Regra confirmada pelo dono:** uma mesma conta pode inscrever **vários jogadores
diferentes**, inclusive no mesmo torneio. Isso é intencional.

Portanto **não há `@@unique`** — nem `[id_usuario, id_torneio]` nem qualquer outro.
A duplicidade passou a ser verificada na aplicação, por **identidade do jogador**:

- novo módulo `lib/inscricao-duplicada.ts`, com `buscarInscricaoDuplicada`;
- a consulta é `{ id_torneio, OR: [{ id_fide }, { id_cbx }],
  uuid: { not: própria } }` — **a conta nunca entra no filtro**;
- jogador sem FIDE **e** sem CBX não passa pela checagem: comparar por nome
  barraria homônimos (requisito 3);
- usada nos dois fluxos: cadastro (`submit-inscription.ts`) e edição
  (`editar-informacoes/.../action.ts`, ignorando a própria inscrição).

**Correções de comportamento embutidas:** o cadastro só olhava `id_fide`; a
edição só olhava `id_fide` e apenas quando `hasFide === 'true'`. Agora os dois
olham FIDE **e** CBX, independentemente do toggle. As mensagens de tela deixaram
de dizer "Este ID FIDE já está inscrito" e passaram a "Este jogador já está
inscrito neste torneio (mesmo ID FIDE ou CBX)".

**Testes:** `tests/duplicidade-inscricao.test.ts` (8) e 4 casos novos em
`tests/inscricao-regras.test.ts`. Cobrem: sem ID não consulta; FIDE só; CBX só;
os dois; a conta fora do filtro; exclusão da própria inscrição; duplicata por
CBX recusada no cadastro. **Mutação:** ignorar o CBX derruba 3 testes.

**Nada foi alterado no banco.** As 13 inscrições do usuário 14 continuam como
estão — era exatamente o caso que a opção B preserva.

### T11 + PS-03 — Recuperação de senha (2026-10-30)

**O que estava quebrado.** `passwordresettoken.createdby` é `@unique` e a action
fazia `create`. Resultado: a **segunda** solicitação da mesma conta estourava o
índice e a recuperação ficava travada — para sempre, se o token antigo tivesse
expirado. Quando o token ainda valia, a action simplesmente **não enviava nada**
e não avisava.

**O que estava exposto.**

- a resposta ao usuário dizia se o e-mail existia — no cadastro da senha **e** na
  tela de login ("*Este não é um email válido ou de usuário existente*");
- o e-mail de redefinição era disparado **ao abrir a URL** (`useEffect` de
  montagem): um GET com `?email=` bastava para encher a caixa de alguém;
- o token **nunca era apagado** depois do uso;
- o estado do formulário devolvia `values` com a **senha em texto claro**, e o
  formulário ainda a colocava de volta no `defaultValue` do input;
- não havia requisito mínimo de senha.

**O que foi feito.**

- `sendEmailAction` (`esqueci-minha-senha/form/action.ts`): **upsert** em
  `createdby` — cada pedido troca o token e invalida o link anterior, quantas
  vezes forem necessárias. Resposta `{ ok: true }` **sempre**: e-mail existe, não
  existe, foi limitado ou o envio falhou. Limite de **3 pedidos por 10 min por
  e-mail** via `lib/rate-limit.ts` (a infraestrutura que já existia). Validade do
  link passou de 10 para **30 minutos**.
- `esqueci-minha-senha/form/form.tsx`: virou um **formulário com botão**. Sem
  `?email=` na URL nada é enviado; o disparo depende do clique.
- `entrar/form/form.tsx`: só o **formato** do e-mail é conferido antes de ir para
  a tela de recuperação. O arquivo `verify-forgot-password.ts` — uma action
  pública que respondia "esta conta existe" — foi **apagado**.
- `redefinir-senha/form/action.ts`: token inexistente, vazio e expirado têm
  mensagens próprias; a senha é validada por `lib/password.ts` (**8 a 128
  caracteres**, sem ser só espaços); a troca de senha e o **consumo do token**
  acontecem na mesma `$transaction` (uso único); **nada de `values`** no retorno.
- `redefinir-senha/form/form.tsx`: o input perdeu o `defaultValue` que devolvia a
  senha ao HTML, e a mensagem de erro agora é exibida.

**Testes (28 novos):** `tests/senha.test.ts` (5), `tests/recuperar-senha.test.ts`
(14) e `tests/redefinir-senha.test.ts` (11). Cobrem primeira e segunda
solicitação (token diferente a cada uma), e-mail inexistente e inválido com a
**mesma** resposta, limite de solicitações, falha de envio sem vazar a conta,
token válido/expirado/inexistente/vazio, senha curta/vazia, e o hash gravado
verificado com `argon2.verify` — que é o que o login faz.

**Mutações:** `create` no lugar de `upsert` e desligar o limite derrubam 5 testes;
remover o consumo do token, desligar a validação de senha e quebrar a transação
derrubam outros 3.

---

---

## 6. Decisões técnicas e justificativas

| Decisão | Por quê |
|---|---|
| `requireAdmin` relê o banco em vez de confiar no JWT | A flag `admin` fica congelada no token por até 30 dias; admin rebaixado manteria acesso |
| `requireUser`/`requireAdmin` **lançam** | Um retorno `null` pode ser esquecido; exceção não |
| Guarda lança em ações sem canal de retorno, retorna mensagem nas de formulário | Decisão do dono (opção "a" × "b") |
| `findUserByEmail` (insensível) na guarda | Mesma regra do login; evita o bug de caixa do e-mail |
| `updateMany` com `id_usuario` no `where` | Torna a escrita atômica em relação à posse |
| Valor desejado vem do `<select>` | Tela desatualizada invertia a função |
| `alert()` como feedback em `usersTable` | Padrão já usado no projeto (`confirm()`); substituível na T36 |
| `email` mantido em `getplayers` | Necessário para a tabela e para o destinatário da confirmação |
| `select` só com `email` e `admin` na tabela de usuários | `id` e `socio` não são usados pela interface; o critério da T14 foi "exclusivamente o necessário" |
| `requireAdmin` na página, e não só no `proxy` | O proxy decide pelo JWT, cuja flag `admin` fica congelada por até 30 dias |
| `'use server'` removido de `lib/*` | Cada export virava endpoint público |
| `server-only` em vez de `'use server'` | Falha no build se um Client Component importar, em vez de expor |
| Módulos de e-mail sem `'use server'` | Elimina o relay; quem dispara são actions autenticadas |
| Rate limit em memória | Proporcional ao problema, sem schema novo; limitação registrada (PS-02) |
| `vitest` + `server-only` como devDependencies | Testes pedidos pelo dono; não vão para o bundle |
| Stub de `server-only` no vitest | O pacote lança fora da condição `react-server`; sem o stub, 23 testes falhariam por motivo falso |

---

## 7. Limitações conhecidas das implementações

1. **Nenhum fluxo de tela foi exercitado em execução.** Não havia sessão de
   administrador nem de jogador disponível. As verificações foram: tipos, lint,
   build, testes unitários com mocks e análise estática de ordem das instruções.
2. **Os testes usam mocks de `@/auth`, `@/lib/db` e dos módulos de e-mail.**
   Provam a **lógica de autorização**, não o comportamento do banco real.
3. **Sem teste de integração** contra Postgres e Resend reais.
4. **Rate limit por instância** (PS-02).
5. **`editOpenInscri` recebeu opção "a"** (lança) — botão sem canal de retorno;
   um não-admin que clique não vê mensagem.
6. **As mensagens de erro da T02 não aparecem na tela** — `form.tsx` só reage a
   `state.message == 'Sucesso'`. Endereçado na T36.
7. **Admin rebaixado vê erro, não redirect** nas páginas que usam a guarda
   (T04/T05), porque a guarda lança.
8. **A corrida da contagem de administradores continua** (T43).
9. **T14 / PS-13 foram verificadas por teste com mock, não em tela.** A garantia
   de que o hash não chega ao navegador vem do `select` (o Prisma não projeta
   colunas não pedidas) e de um teste de mutação — não de inspeção do payload RSC
   no DevTools. Rebaixar um administrador de verdade e abrir a tela continua
   pendente.
10. **Nenhuma outra página de `/gerenciamento` tem guarda própria** — resolvido
    na extensão da T14: as 5 páginas agora chamam `requireAdmin()`. Ver PS-13.
11. **`updateDataBase` tem lista de campos permitidos** (T49) e **transação**
    (T50), mas **nada disso rodou contra Postgres real**. Em especial, **nenhum
    rollback foi observado**: o `$transaction` dos testes é um dublê.
12. **`updateDataBase` usa isolation level padrão (read committed), sem retry de
    `P2034`.** Uma escrita concorrente entre a leitura de vínculo e o commit não
    é tratada. Comentado no código.
13. **Lote grande numa transação só:** as gravações são sequenciais dentro da
    transação; confirmar muitas inscrições segura a transação por mais tempo. Não
    medido.
14. **Falha de envio de e-mail não chega ao administrador** — só o log do
    servidor registra (PS-08 / T36).
15. **Suíte instável:** 2 de ~17 execuções do Vitest falharam com
    `Tests no tests` / `worker 97%`, sem causa reproduzível (**PS-16 / T51**).
    Toda afirmação de "testes verdes" neste documento vale para as execuções que
    de fato passaram.
16. **T09 — a proteção no banco ainda não existe.** O código não apaga mais
    categoria com inscrição, mas a FK continua `Cascade` até a DDL ser aplicada
    (preparada e **não executada**). Enquanto isso, um `delete` de categoria
    feito por fora do app (painel, SQL) ainda apaga inscrições.
17. **T09 — renomear categoria/divisão que já tem inscrições é recusado.**
    O formulário não devolve o `uuid`/`id`, então renomear é indistinguível de
    excluir e criar. A edição é bloqueada com mensagem, nunca apaga. Corrigir
    exigiria mandar a identidade no payload (mudança no componente de categorias)
    — não feito.
18. **T15/T17 — o cadastro ainda valida o torneio da categoria, não o da URL.**
    Um payload forjado pode inscrever o próprio jogador em outro torneio
    **aberto** e elegível — o que já seria possível pelo caminho normal, sem
    ganho de privilégio. **Decisão do dono (2026-10-30): não bloqueante**, sem
    tarefa nova.
19. **T15/T17 — `playerFide`/`playerCbx` continuam vindos do cliente** (T16):
    nome, título, federação e ratings do JSON oculto ainda são gravados. Fora do
    escopo desta tarefa. — **resolvido na T16 (2026-10-30)**; a linha fica como
    histórico.
20. **T16 — a inscrição agora faz duas consultas externas** (FIDE e CBX, 7 s de
    timeout cada, em paralelo). Com os serviços fora do ar, a inscrição ainda
    passa, mas demora até ~7 s e grava sem rating/título. Não medido em produção.
21. **T18 — comprovantes no bucket público.** A leitura não é controlada: quem
    tem a URL abre o arquivo. Exige bucket privado + URLs assinadas (infra), fora
    do escopo. Registrado na seção T18/T18 acima.
22. **T12 — a duplicidade é checada só na aplicação.** Sem `@@unique` (decisão
    do dono: a conta pode ter vários jogadores), **duas requisições simultâneas**
    do mesmo jogador podem passar as duas pela checagem e gravar duas
    inscrições. Risco residual aceito; fechar exigiria outra chave de banco.
23. **T12 — nenhum índice foi criado.** A checagem faz `findFirst` por
    `id_torneio + id_fide/id_cbx` sem índice; com muitas inscrições isso vira
    varredura. Faz parte da parte de índices da T12/T13, não executada.
24. **T11 — limite de solicitações em memória.** Vale por instância (mesma
    limitação da PS-02). Em serverless, várias instâncias = limite mais frouxo.
25. **T11 — o token vai na URL** (`/redefinir-senha?token=…`), então fica no
    histórico do navegador e em logs de acesso. Mudar exigiria outro desenho de
    fluxo; não foi feito.
26. **T11 — validade do link passou de 10 para 30 minutos.** Mudança de
    comportamento declarada: 10 min derrubava quem demorava para abrir o e-mail.
20. **T15/T17 — dois cálculos de categoria convivem.** `selectCategory` (cadastro)
    e `searchCat` (edição, e é uma Server Action pública) podem escolher
    categorias diferentes quando mais de uma cobre o ano. A validação aceita as
    duas para não quebrar nenhum fluxo; unificar é limpeza (T39/T22).

---

## 8. Alterações fora do escopo original (declaradas)

| Alteração | Onde | Motivo |
|---|---|---|
| Remoção do prontuário `Player` enviado ao cliente | `inscriptions-list.tsx`, `minhas-inscricoes/page.tsx` | Ficou morto após a T07; minimização de dados |
| `ButtonCancelSolicitation` deixou de ser `async` | `buttonCancelSolicitation.tsx` | Componente client assíncrono é inválido em React (bug latente) |
| Remoção de imports mortos (`supabase`, `Player`) | `individual.tsx` | Dead imports previstos na T06 |
| Criação de infraestrutura de teste | `tests/`, `vitest.config.mts`, `package.json` | Testes pedidos explicitamente |
| Stub `server-only` para testes | `tests/stubs/server-only.ts` | Necessário para o vitest |
| Espaço em branco removido | `updateDataBase.ts`, linha do `nameTournment` | Efeito colateral de edição; cosmético |

---

## 9. Dependências entre tarefas

```
T01 (guarda)
 ├── T02, T03, T04, T05, T07   [todas concluídas]
 └── T43 (usa requireAdmin)

T12 (índices/constraints) ──► T13 (migrations) ──► PS-07 (RLS versionado)
T12 ──► T09 (Restrict precisa de constraint)
T32 (email normalizado) ──► T27 (busca unificada)
T05 ──► PS-01 (testes de autorização da gravação)
T07 ──► PS-02 (rate limit compartilhado)
T11 / T28 / T30 ──► PS-03 (recuperação de senha)
T14 = PS-05 + PS-13 · T43 = PS-06 · T08 = PS-11 · T49 = PS-14 · T50 = PS-15 · T51 = PS-16
T08 ✅ (PS-11 fechada; resta a PS-14, sem whitelist de campos)
```

---

## 9.1 Sequência recomendada (substitui a ordem numérica original)

O dono definiu a prioridade: **segurança → integridade → autenticação →
confiabilidade → desempenho → interface/limpeza**. A ordem original (numérica)
não respeita isso: deixaria o hash de senha (T14) e a perda de inscrições (T09)
para depois de itens de performance.

### Etapa 1 — Segurança imediata (barata, alto impacto)

| Ordem | Tarefa | Por quê |
|---|---|---|
| 1 | **T14** (=PS-05) | Hash de senha de todos os usuários indo para o navegador. Um arquivo, risco quase nulo. — ✅ **concluída em 2026-10-30**, junto com a PS-13 |
| 2 | **T44** (=PS-07, nova) | RLS em `usuario`. DDL mínima, mas **exige backup**. |
| 3 | **T08** (=PS-11) | Duas correções no fluxo central: `await` na gravação (hoje as alterações podem se perder) e destinatário do e-mail vindo do banco. — ✅ **concluída em 2026-10-30** |

### Etapa 2 — Integridade estrutural (protege dados que existem)

| Ordem | Tarefa | Por quê |
|---|---|---|
| 4 | **T09** | Editar categoria **apaga todas as inscrições** por cascade. É perda de dados em produção. — ✅ **código em 2026-10-30**; a DDL de `onDelete: Restrict` está preparada e **não aplicada** |
| 5 | **T12** | Índices + `@@unique([id_usuario, id_torneio])`. Sem isso não há como impedir inscrição dupla. |
| 6 | **T13** (=PS-12) | Migrations completas. Depois da T12; **exige backup e validação em banco vazio**. |
| 6b | **T50** (=PS-15) | Transação no `updateDataBase` + vínculo categoria × torneio. **Prioridade alta**: é o fluxo em que um admin confirma dezenas de pagamentos de uma vez, e hoje uma falha no meio deixa metade gravada e nenhum e-mail enviado. Separada da T10 por decisão do dono. — ✅ **concluída em 2026-10-30** |

### Etapa 3 — Autenticação e contas

| Ordem | Tarefa | Por quê |
|---|---|---|
| 7 | **T11** + **PS-03** | Recuperação de senha: token travado, enumeração, abuso, envio por GET. |
| 8 | **T28, T29, T30, T31** | Proxy bloqueando reset de quem está logado, redirecionamento aberto, disparo por GET, senha no `FormState`. |
| 9 | **T32** (=PS-10) | Normalizar e-mail. **Exige backup** (mexe em dados). |

### Etapa 4 — Regra de negócio da inscrição

| Ordem | Tarefa | Por quê |
|---|---|---|
| 10 | **T15, T16, T17, T18** | Hoje o servidor aceita categoria, preço, rating e nome vindos do navegador, e o comprovante vai para bucket público. |
| 11 | **T27** | Unificar busca de usuário (depende da T32). |

### Etapa 5 — Confiabilidade das operações

| Ordem | Tarefa | Por quê |
|---|---|---|
| 12 | **T10** + **T43** (=PS-06) | Transações nos fluxos de torneio e na contagem de administradores. |
| 13 | **T46** (=PS-01, nova) | Testes da autorização de gravação da T05 — fecha a lacuna de verificação. |
| 14 | **T45** (=PS-09, nova) e **T36** (=PS-08) | Redirect em vez de erro; mensagens de erro visíveis nos formulários. |

### Etapa 6 — Desempenho

15. **T33, T34, T35** (N+1 de Storage, rotas dinâmicas, `revalidatePath`).

### Etapa 7 — Bugs funcionais

16. **T19–T26** (gênero errado, TXT exportando tudo, `classifyTime`, `searchCat`,
    caminho de upload, `contentType`, cancelamento sem estado, "já inscrito").

### Etapa 8 — Interface e limpeza

17. **T37, T38** (PIX, links de e-mail), **T39–T42** (código morto, `console.log`,
    `imask`, duplicatas), **T47** (=PS-02, rate limit persistente),
    **T48** (=PS-04, escape nos e-mails).

**Regra prática:** nenhuma tarefa das etapas 2 a 8 começa antes de a etapa 1
estar concluída e verificada — são as três correções que fecham exposição real de
dados com o menor esforço.

---

## 10. Testes e validação

### Existem e são executados

```
npm run test      # vitest run  → 208 testes, 19 arquivos
npx tsc --noEmit  # typecheck
npm run lint      # eslint (falha por erros PRÉ-EXISTENTES em files.tsx/individual.tsx/selectCategorie.tsx/usersTable.tsx)
npm run build     # next build
```

| Arquivo | Cobre |
|---|---|
| `tests/auth-guard.test.ts` (6) | sem sessão; sessão sem linha no banco; comum; admin; admin revogado no banco mas presente no token |
| `tests/cancel-solicitation.test.ts` (8) | sem sessão; inscrição de outro; uuid vazio; posse no `where`; legítimo; status inalterado; falha do Resend; 4ª solicitação bloqueada |
| `tests/change-function.test.ts` (6) | sem admin; promoção; último admin; segundo admin; e-mail inexistente; idempotência |
| `tests/rate-limit.test.ts` (3) | limite; chaves isoladas; liberação após a janela |
| `tests/users-page.test.ts` (6) | página sem sessão, comum e **admin revogado** — `findMany` não é chamado; `select` sem `password`; linhas entregues ao cliente com só `email`/`admin`; e-mail do filtro vindo do banco |
| `tests/admin-pages-guard.test.ts` (14) | as 4 páginas administrativas × (sem sessão, comum, admin revogado) sem tocar em banco/Storage; 2 casos positivos com admin válido |
| `tests/update-database.test.ts` (47) | T08 + T49 + T50: gravação aguardada; ordem `update → findUnique → email`; destinatário e título do banco; BigInt→number; os 14 campos legítimos; identificadores e campos inventados ignorados; 13 valores inválidos; transação (gravação por `tx`, falha sem commit, payload vazio); vínculo categoria/divisão × torneio |
| `tests/sincronizar-categorias.test.ts` (12) | T09: atualização preserva `uuid`/`id`; recusa remover categoria/divisão com inscrições sem escrever nada; cria nova; remove sem inscrição; valor em reais; gênero |
| `tests/editar-torneio-action.test.ts` (3) | T09: recusa não grava torneio nem e-mails; edição legítima grava; sem mudança de categorias não consulta o catálogo |
| `tests/editar-inscricao-duplicada.test.ts` (7) | T26: edita a própria inscrição sem falso "já inscrito"; a consulta exclui o próprio uuid; outra inscrição do mesmo torneio com mesmo FIDE ainda bloqueia; outro torneio não bloqueia; posse (T05) na leitura e na gravação; sem sessão |
| `tests/regras-inscricao.test.ts` (22) | T15/T17: torneio aberto (prazo e encerramento), faixa de idade, regra da categoria mais próxima, gênero da divisão, divisão padrão × absoluta × terceira |
| `tests/inscricao-regras.test.ts` (8) | T15/T17 na action de cadastro: torneio fechado e prazo vencido recusados; categoria de fora do torneio, idade e gênero recusados; inscrição válida grava |
| `tests/editar-inscricao-regras.test.ts` (5) | T15/T17 na edição: categoria de outro torneio recusada; `id_torneio` não é escrito; prazo vencido não bloqueia; gênero e idade recusados |
| `tests/genero-analise.test.ts` (11) | T19: banco → select, select → booleano, troca entre as opções, demais conversões, e o gênero chegando ao banco pela `updateDataBase` |
| `tests/dados-oficiais-comprovante.test.ts` (8) | T16: payload forjado ignorado, serviço fora do ar não bloqueia, jogador sem ID não consulta. T18: arquivo inválido/grande recusado antes de gravar, upload com falha desfaz a inscrição e não envia e-mail |
| `tests/duplicidade-inscricao.test.ts` (8) | T12: sem ID não consulta; FIDE só, CBX só, os dois; conta fora do filtro; exclusão da própria inscrição na edição |
| `tests/senha.test.ts` (5) | T11: mínimo, máximo, vazio, só espaços |
| `tests/recuperar-senha.test.ts` (14) | T11: primeira e segunda solicitação (upsert, token novo), resposta genérica igual para conta existente/inexistente/inválida, falha de envio sem vazar, limite de 3 por janela |
| `tests/redefinir-senha.test.ts` (11) | T11: sucesso grava hash argon2 verificável, consome o token, não devolve senha/token; token inválido, expirado e vazio; senha curta e vazia; falha de transação |

### Ainda sem testes

- Toda a T02 (actions de torneio) — só verificação estática.
- T04 (`getInformations`) — só verificação estática; `updateDataBase` passou a
  ter 12 testes na T08.
- T05 gravação recusada para outro dono (**PS-01**).
- Renderização de qualquer página — a T14 testa a **função** `Users()` e o que ela
  entrega ao Client Component, não o HTML renderizado nem o payload RSC real.
- Qualquer integração com Postgres, Supabase Storage ou Resend.

### Riscos de regressão

- Alterar assinaturas das actions que hoje têm guarda (todas mantiveram a
  assinatura, por isso não houve mudança nos chamadores).
- Mexer em `lib/types.ts` (consumido por cliente e servidor).
- Reintroduzir `'use server'` em `lib/*` ou importar módulos sensíveis em Client
  Components — hoje o build barra isso, mas só se `server-only` continuar lá.
- Qualquer DDL no banco (T09/T12/T13/PS-07) — **exige backup**.

### Checklist para encerrar a auditoria de verdade

- [ ] Todas as tarefas do bloco de segurança concluídas e **exercitadas em tela**
- [ ] Testes de autorização para cada action (sem sessão / outro usuário / dono)
- [ ] Teste de integração com Postgres real
- [ ] `npm run lint` sem erros (hoje falha por itens pré-existentes)
- [ ] `npm run build` verde
- [ ] Backup do banco antes de qualquer migration
- [ ] Migrations versionadas e aplicáveis do zero (T13)
- [ ] RLS ligado em todas as tabelas (PS-07)
- [ ] Fluxo completo de inscrição → pagamento → confirmação testado ponta a ponta

---

## 11. Estado real do repositório

| Item | Valor |
|---|---|
| Raiz do repositório | `C:/Users/Henrique/Desktop/playground/tcc-teste2` |
| Raiz da aplicação | `.../tcc-teste2/projeto` |
| Branch | `main` (sem alteração; **nenhum commit feito**) |
| Último commit | `1954877 — "Antes da auditoria"` (Henrique Fischborn) |
| Sincronia com `origin/main` | 0 à frente, 0 atrás |
| Remoto | `git@github.com:HenriqueRosaFischborn/tcc-teste2.git` |
| Node / npm | v22.17.0 / 10.9.2 |
| Servidor de dev | rodando em `http://localhost:3000` (responde 200) |

**28 arquivos modificados, 1 excluído, 7 novos** (incluindo a pasta `tests/` e os
dois documentos `.md`). Lista completa em `git status`.

**Dependências instaladas durante a auditoria** (apenas `devDependencies`):
`vitest@^5.0.5`, `server-only@^0.0.1`. Script novo: `"test": "vitest run"`.

**Comandos de verificação**

```bash
git -C ../ status --short
git -C ../ log --oneline -3
npm run test && npx tsc --noEmit && npm run build
```

---

## 12. Texto para colar na próxima conversa

```
Retomando a auditoria do sistema de torneios de xadrez (tcc-teste2).

Antes de qualquer coisa, leia integralmente:
1. projeto/CONTINUIDADE_AUDITORIA.md  (estado completo, tarefas, decisões)
2. projeto/PENDENCIAS.md              (o que ficou para depois, com IDs PS-*)
3. projeto/AGENTS.md                  (regras do projeto e da versão do Next)

Depois, confirme o estado real no código: git status, git log, os arquivos
mencionados nos dois documentos e os testes em projeto/tests/. Não confie
apenas nos documentos: verifique no código antes de agir.

Regras desta conversa:
- Uma tarefa por vez. Não avance sem a minha autorização explícita.
- Preserve as funcionalidades existentes; mudanças mínimas e justificadas.
- Não instale dependências nem altere o banco sem me perguntar.
- Nenhuma migração ou DDL sem backup e validação prévia.
- Me informe imediatamente qualquer vulnerabilidade nova que encontrar.
- Ao terminar cada tarefa: rodar tsc, eslint dos arquivos afetados, os testes
  (npm run test) e, quando fizer sentido, npm run build.
- Diga sempre o que foi TESTADO de verdade e o que é apenas análise estática ou
  baseada em mocks. Nunca declare algo "seguro" só porque o TypeScript passou.
- Vulnerabilidade documentada NÃO é vulnerabilidade corrigida. Atualize o
  PENDENCIAS.md só quando a correção estiver implementada e verificada.
- Não faça commits automaticamente.

Comece me dizendo qual é a próxima tarefa recomendada no documento e por quê.
Não implemente nada ainda.
```
