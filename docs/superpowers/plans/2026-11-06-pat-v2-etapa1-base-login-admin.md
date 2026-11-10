# PAT v2 · Etapa 1 — Base, login e painel mínimo · Plano de construção

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A administradora cria clientes num painel; o cliente entra no app, troca a senha provisória e chega a uma tela inicial (ou à tela "acesso pausado" se estiver bloqueado). Cada acesso fica registrado.

**Architecture:** Projeto Vite (JS puro, módulos ES) com duas páginas, `app/index.html` (cliente) e `app/admin.html` (painel). Os dados ficam no Supabase (Auth + Postgres com RLS). Criar cliente e redefinir senha exigem a chave de serviço, então passam pela Edge Function `admin-clientes`. O papel `admin` fica em `app_metadata.role` do usuário, que só a chave de serviço consegue gravar.

**Tech Stack:** Node 26 · Vite 6 · Vitest 3 · `@supabase/supabase-js` 2 · Supabase CLI via `npx supabase` (sem Docker: tudo roda contra o projeto remoto `pat-dev`) · Edge Functions em Deno/TypeScript · Netlify.

**Spec:** `docs/superpowers/specs/2026-11-06-pat-v2-design.md` (seções 3.1 "Entrar", 3.2 "Criar cliente" e ações de senha/bloqueio, 3.3 Auth/RLS, 6 "Cliente bloqueado", 7, 9 item 1).

**Fora desta etapa** (cada uma tem seu próprio plano depois): quiz, geração, IA, calendário, "✓ Postei", notificações, painel completo com alertas, espanhol, PWA. As tabelas `negocios`, `produtos`, `meses`, `posts`, `postagens`, `resultados` e `push_inscricoes` nascem nas etapas que as usam.

## Global Constraints

- Idioma de todas as telas nesta etapa: português (Brasil). Textos de interface ficam em `app/src/textos.js` (a etapa 5 acrescenta `es`).
- Identidade visual: tema escuro único, `--bg:#000000`, `--ink:#FFFFFF`, `--pri:#CEFB14`, `--pri-ink:#000000`, `--surface:#141414`, `--line:#2E2E2E`, `--muted:#A3A3A3`, `--bad:#FF6B70`; fontes "Bricolage Grotesque" (títulos) e "Nunito Sans" (texto). Copiar de `bancada/index.html:10-19`.
- Logo: copiar `bancada/img/pat-logo.png` e `bancada/img/pat-icon.png` para `app/public/img/`.
- `clientes.idioma` ∈ {`pt`, `es`}; `clientes.situacao` ∈ {`ativo`, `bloqueado`} ("parado" é calculado na etapa 5, nunca gravado).
- Telefone gravado só com dígitos, com DDI: 10 a 15 dígitos (ex.: `5511987654321`).
- E-mail gravado com `trim()` + minúsculas.
- Senha provisória: 10 caracteres, sem caracteres ambíguos (`0 O o 1 l I`).
- A chave de serviço (`SUPABASE_SERVICE_ROLE_KEY`) nunca aparece em arquivo de `app/` nem em variável `VITE_*`.
- O `bancada/` continua intacto nesta etapa. A alteração pendente em `bancada/index.html` não entra em nenhum commit deste plano.
- Trabalhar no branch `v2-etapa1` (criado na Tarefa 1); nada é enviado ao GitHub sem a usuária pedir. Push, quando pedido: `git -c http.sslBackend=schannel push`.

## Review Focus

1. **Cliente tenta se desbloquear** gravando `situacao='ativo'` ou `senha_provisoria=false` direto na própria linha → o banco recusa. Teste na Tarefa 2.
2. **E-mail repetido ao criar cliente** → mensagem "Já existe um cliente com este e-mail." e nenhum usuário/linha órfã. Se o insert em `clientes` falhar depois de criar o usuário no Auth, o usuário é apagado. Testes na Tarefa 3.
3. **Cliente (não admin) chama a função `admin-clientes` ou abre `admin.html`** → a função responde 403 e a página mostra "Esta área é só para a administração." Testes nas Tarefas 3 e 5.
4. **Cliente bloqueado enquanto já estava logado** → ao reabrir o app vê a tela "Seu acesso está pausado", porque a situação é lida do banco a cada abertura, não da sessão. Teste na Tarefa 4.
5. **E-mail com maiúsculas/espaços e telefone com máscara** ("(11) 98765-4321") → normalizados antes de gravar; telefone sem DDI recebe `55` quando o idioma é `pt` e é recusado quando é `es`. Teste na Tarefa 3.

---

### Tarefa 0: Contas e chaves (feita pela usuária, com orientação)

Não é código; o executor guia a usuária passo a passo e espera a confirmação.

- [x] **Passo 1:** Criar conta em supabase.com e um projeto chamado `pat-dev`, região *South America (São Paulo)*. Anotar a senha do banco num lugar seguro.
- [x] **Passo 2:** Em *Project Settings → API*, copiar `Project URL`, a chave `anon public` e a chave `service_role`. Em *Account → Access Tokens*, gerar um token.
- [x] **Passo 3:** Em *Authentication → Providers → Email*, desligar "Confirm email" (os clientes são criados já confirmados pela função) e em *Authentication → Sign In / Up* desligar "Allow new users to sign up" (ninguém se cadastra sozinho).
- [x] **Passo 4:** A própria usuária cria `PAT/.env.local` (o executor não recebe as chaves pelo chat):

```
VITE_SUPABASE_URL=https://<ref>.supabase.co
VITE_SUPABASE_ANON_KEY=<anon>
SUPABASE_SERVICE_ROLE_KEY=<service_role>
SUPABASE_ACCESS_TOKEN=<token>
SUPABASE_PROJECT_REF=<ref>
```

Verificação: `node -e "require('fs').readFileSync('.env.local','utf8').split('\n').filter(Boolean).forEach(l=>console.log(l.split('=')[0], l.split('=')[1]?.length>10?'ok':'FALTA'))"` mostra `ok` nas 5 linhas.

---

### Tarefa 1: Estrutura do projeto

**Files:**
- Create: `package.json`, `vite.config.js`, `vitest.config.js`, `vitest.int.config.js`, `.gitignore`, `.env.example`, `app/index.html`, `app/admin.html`, `app/src/supabase.js`, `app/src/textos.js`, `app/src/estilo.css`, `app/public/img/pat-logo.png`, `app/public/img/pat-icon.png`
- Test: `tests/unit/textos.test.js`

**Interfaces:**
- Produces:
  - `supabase` (default export de `app/src/supabase.js`): cliente criado com `import.meta.env.VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY`.
  - `t(chave: string, vars?: Record<string,string>): string` em `app/src/textos.js`; substitui `{nome}` por `vars.nome`; chave inexistente lança `Error("texto ausente: <chave>")`.
  - Scripts npm: `dev`, `build`, `test` (unit), `test:int` (integração, lê `.env.local`).

- [x] **Passo 1:** `git checkout -b v2-etapa1`.
- [x] **Passo 2:** `npm init -y`; instalar `vite@6 vitest@3 supabase` (dev) e `@supabase/supabase-js@2`. `vite.config.js`: `root: 'app'`, `envDir: '..'`, `build.outDir: '../dist'`, `build.rollupOptions.input` com `index.html` e `admin.html`. `vitest.config.js`: `include: ['tests/unit/**/*.test.{js,ts}']`. `vitest.int.config.js`: `include: ['tests/int/**/*.test.js']`, `testTimeout: 30000`, `fileParallelism: false`, `env` carregado de `.env.local` via `loadEnv(mode, process.cwd(), '')`. Scripts: `test` = `vitest run`, `test:int` = `vitest run --config vitest.int.config.js`.
- [x] **Passo 3:** `.gitignore`: `node_modules/`, `dist/`, `.env.local`, `.env*.local`, `supabase/.temp/`. `.env.example` com as 5 chaves vazias.
- [x] **Passo 4: Teste que falha** — `tests/unit/textos.test.js`:

```js
import { t } from '../../app/src/textos.js'
test('substitui variáveis', () => {
  expect(t('inicio.ola', { nome: 'Ana' })).toBe('Olá, Ana!')
})
test('chave ausente lança erro', () => {
  expect(() => t('nao.existe')).toThrow('texto ausente: nao.existe')
})
```

- [x] **Passo 5:** `npm test` → FAIL (módulo não existe).
- [x] **Passo 6:** Implementar `app/src/textos.js` com um objeto `pt` plano (`'inicio.ola': 'Olá, {nome}!'`, mais as chaves que as Tarefas 4 e 5 listam) e `t()`.
- [x] **Passo 7:** `npm test` → PASS. `npm run build` → gera `dist/index.html` e `dist/admin.html` sem erro.
- [x] **Passo 8:** Commit `chore: estrutura do PAT v2 (Vite, Vitest, Supabase)`.

---

### Tarefa 2: Banco — tabelas, RLS e primeira administradora

**Files:**
- Create: `supabase/config.toml` (via `npx supabase init`), `supabase/migrations/20261106000001_base.sql`, `scripts/criar-admin.mjs`
- Test: `tests/int/ajuda.js`, `tests/int/rls.test.js`

**Interfaces:**
- Produces (banco):
  - `public.clientes(id uuid pk → auth.users on delete cascade, nome text not null, email text unique not null, telefone text not null check ~ '^[0-9]{10,15}$', idioma text not null default 'pt' check in ('pt','es'), situacao text not null default 'ativo' check in ('ativo','bloqueado'), senha_provisoria boolean not null default true, criado_em timestamptz not null default now())`
  - `public.eventos(id bigint identity pk, cliente_id uuid not null → clientes on delete cascade, tipo text not null check in ('acesso'), criado_em timestamptz not null default now())`
  - `public.is_admin() returns boolean` — `coalesce(auth.jwt()->'app_metadata'->>'role','') = 'admin'`, `stable`.
  - RPC `public.marcar_senha_trocada() returns void` — `security definer`, `set search_path = ''`; faz `update public.clientes set senha_provisoria = false where id = auth.uid()`.
  - Políticas: `clientes` → SELECT se `id = auth.uid() or is_admin()`; UPDATE só `is_admin()`; sem INSERT/DELETE (só a chave de serviço). `eventos` → INSERT se `cliente_id = auth.uid()`; SELECT só `is_admin()`.
- Produces (testes): em `tests/int/ajuda.js`, `servico()` (cliente com a chave de serviço), `async novoCliente(dados?) → { id, email, senha, db }` (cria usuário + linha em `clientes`, devolve um cliente supabase já logado como ele), `async novaAdmin() → { id, db }`, `async limpar(ids: string[])`.
- `scripts/criar-admin.mjs <email> <senha>`: cria (ou atualiza) o usuário com `app_metadata: { role: 'admin' }` e `email_confirm: true`.

- [x] **Passo 1:** `npx supabase init` e `npx supabase link --project-ref $SUPABASE_PROJECT_REF`.
- [x] **Passo 2: Testes que falham** — `tests/int/rls.test.js`:

```js
test('cliente lê só a própria linha', async () => {
  const a = await novoCliente(), b = await novoCliente()
  const { data } = await a.db.from('clientes').select('id')
  expect(data.map(r => r.id)).toEqual([a.id])
})
test('cliente não consegue se desbloquear nem limpar a senha provisória', async () => {
  const a = await novoCliente({ situacao: 'bloqueado' })
  await a.db.from('clientes').update({ situacao: 'ativo', senha_provisoria: false }).eq('id', a.id)
  const { data } = await servico().from('clientes').select('situacao,senha_provisoria').eq('id', a.id).single()
  expect(data).toEqual({ situacao: 'bloqueado', senha_provisoria: true })
})
test('marcar_senha_trocada afeta só quem chama', async () => {
  const a = await novoCliente(), b = await novoCliente()
  await a.db.rpc('marcar_senha_trocada')
  const { data } = await servico().from('clientes').select('id,senha_provisoria').in('id', [a.id, b.id])
  expect(Object.fromEntries(data.map(r => [r.id, r.senha_provisoria]))).toEqual({ [a.id]: false, [b.id]: true })
})
test('evento só com o próprio id; só a admin lê eventos', async () => {
  const a = await novoCliente(), b = await novoCliente(), adm = await novaAdmin()
  expect((await a.db.from('eventos').insert({ cliente_id: a.id, tipo: 'acesso' })).error).toBeNull()
  expect((await a.db.from('eventos').insert({ cliente_id: b.id, tipo: 'acesso' })).error).not.toBeNull()
  expect((await a.db.from('eventos').select('id')).data).toEqual([])
  expect((await adm.db.from('eventos').select('id').eq('cliente_id', a.id)).data).toHaveLength(1)
})
test('admin lê todos e bloqueia', async () => {
  const a = await novoCliente(), adm = await novaAdmin()
  await adm.db.from('clientes').update({ situacao: 'bloqueado' }).eq('id', a.id)
  const { data } = await servico().from('clientes').select('situacao').eq('id', a.id).single()
  expect(data.situacao).toBe('bloqueado')
})
```

Cada teste chama `limpar()` no `afterEach` com os ids criados.

- [x] **Passo 3:** `npm run test:int` → FAIL (tabela `clientes` não existe).
- [x] **Passo 4:** Escrever a migração conforme o bloco Interfaces (com `alter table ... enable row level security` nas duas tabelas e `revoke execute on function public.marcar_senha_trocada from anon`). `npx supabase db push`.
- [x] **Passo 5:** `npm run test:int` → 5 PASS.
- [x] **Passo 6:** Implementar `scripts/criar-admin.mjs` (lê `.env.local`). A usuária roda `node scripts/criar-admin.mjs <email dela> <senha>`; verificação: `npm run test:int` continua verde e, no painel do Supabase, o usuário aparece com `role: admin` em *Raw app meta data*.
- [x] **Passo 7:** Commit `feat: tabelas clientes e eventos com RLS`.

---

### Tarefa 3: Função `admin-clientes` (criar cliente e redefinir senha)

**Files:**
- Create: `supabase/functions/_shared/senha.ts`, `supabase/functions/_shared/validacao.ts`, `supabase/functions/admin-clientes/acoes.ts`, `supabase/functions/admin-clientes/index.ts`
- Test: `tests/unit/senha.test.ts`, `tests/unit/validacao.test.ts`, `tests/unit/acoes.test.ts`, `tests/int/admin-clientes.test.js`

**Interfaces:**
- Produces:
  - `gerarSenha(aleatorio?: (n: number) => Uint8Array): string` — 10 caracteres do alfabeto `ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789`.
  - `validarNovoCliente(entrada: unknown): { ok: true, dados: { nome, email, telefone, idioma } } | { ok: false, erro: string }` — erros exatos: `"Informe o nome."` (nome com menos de 2 caracteres após trim), `"E-mail inválido."`, `"Telefone inválido. Use DDD e número."`, `"Idioma deve ser pt ou es."`. Telefone: remove tudo que não é dígito; 10–11 dígitos + idioma `pt` → prefixa `55`; 10–11 dígitos + idioma `es` → `"Inclua o código do país no telefone."`; resultado precisa ter 12–15 dígitos.
  - `criarCliente(deps: Deps, entrada: unknown): Promise<Resposta>` e `redefinirSenha(deps: Deps, id: string): Promise<Resposta>` em `acoes.ts`, onde `Deps = { criarUsuario(email, senha): Promise<{ id } | { erro: 'email_existe' | string }>, apagarUsuario(id), inserirCliente(linha): Promise<{ erro?: string }>, trocarSenha(id, senha): Promise<{ erro?: string }>, marcarProvisoria(id): Promise<{ erro?: string }>, senha(): string }` e `Resposta = { status: number, corpo: object }`.
  - HTTP `POST /functions/v1/admin-clientes` com corpo `{ acao: 'criar', nome, email, telefone, idioma }` → `201 { id, senhaProvisoria }`; `{ acao: 'redefinir_senha', id }` → `200 { senhaProvisoria }`; erros de validação → `400 { erro }`; e-mail repetido → `409 { erro: "Já existe um cliente com este e-mail." }`; quem chama sem `app_metadata.role === 'admin'` → `403 { erro: "Só a administração pode fazer isso." }`; ação desconhecida → `400 { erro: "Ação desconhecida." }`.

- [x] **Passo 1: Testes que falham (unit)**

```ts
// senha.test.ts
test('10 caracteres sem ambíguos', () => {
  for (let i = 0; i < 200; i++) expect(gerarSenha()).toMatch(/^[A-HJ-NP-Za-km-np-z2-9]{10}$/)
})
// validacao.test.ts
test('normaliza e-mail e telefone brasileiro', () => {
  expect(validarNovoCliente({ nome: ' Ana ', email: ' Ana@X.com ', telefone: '(11) 98765-4321', idioma: 'pt' }))
    .toEqual({ ok: true, dados: { nome: 'Ana', email: 'ana@x.com', telefone: '5511987654321', idioma: 'pt' } })
})
test('espanhol sem DDI é recusado', () => {
  expect(validarNovoCliente({ nome: 'Luz', email: 'l@x.mx', telefone: '55 1234 5678', idioma: 'es' }))
    .toEqual({ ok: false, erro: 'Inclua o código do país no telefone.' })
})
test.each([
  [{ nome: 'A', email: 'a@x.com', telefone: '11987654321', idioma: 'pt' }, 'Informe o nome.'],
  [{ nome: 'Ana', email: 'ana@', telefone: '11987654321', idioma: 'pt' }, 'E-mail inválido.'],
  [{ nome: 'Ana', email: 'a@x.com', telefone: '123', idioma: 'pt' }, 'Telefone inválido. Use DDD e número.'],
  [{ nome: 'Ana', email: 'a@x.com', telefone: '11987654321', idioma: 'en' }, 'Idioma deve ser pt ou es.'],
])('recusa %o', (e, erro) => expect(validarNovoCliente(e)).toEqual({ ok: false, erro }))
// acoes.test.ts — deps falsos
test('e-mail repetido → 409 sem inserir', async () => {
  const deps = falsos({ criarUsuario: async () => ({ erro: 'email_existe' }) })
  expect(await criarCliente(deps, valido)).toEqual({ status: 409, corpo: { erro: 'Já existe um cliente com este e-mail.' } })
  expect(deps.inserirCliente).not.toHaveBeenCalled()
})
test('falha no insert apaga o usuário criado', async () => {
  const deps = falsos({ inserirCliente: async () => ({ erro: 'x' }) })
  expect((await criarCliente(deps, valido)).status).toBe(500)
  expect(deps.apagarUsuario).toHaveBeenCalledWith('u1')
})
test('sucesso devolve id e senha', async () => {
  expect(await criarCliente(falsos(), valido)).toEqual({ status: 201, corpo: { id: 'u1', senhaProvisoria: 'Senha12345' } })
})
test('redefinir marca a senha como provisória', async () => {
  const deps = falsos()
  expect(await redefinirSenha(deps, 'u1')).toEqual({ status: 200, corpo: { senhaProvisoria: 'Senha12345' } })
  expect(deps.marcarProvisoria).toHaveBeenCalledWith('u1')
})
```

`falsos(sobrescrever)` monta `Deps` com `vi.fn()` que dão certo (`criarUsuario → { id: 'u1' }`, `senha → 'Senha12345'`).

- [x] **Passo 2:** `npm test` → FAIL.
- [x] **Passo 3:** Implementar `senha.ts` (usa `crypto.getRandomValues` por padrão), `validacao.ts` e `acoes.ts` sem nenhuma API do Deno (para o Vitest importar).
- [x] **Passo 4:** `npm test` → PASS.
- [x] **Passo 5:** `index.ts`: trata CORS (`OPTIONS` → 200 com `Access-Control-Allow-Origin: *` e `Allow-Headers: authorization, content-type, apikey, x-client-info`); lê o usuário do header `Authorization` com `supabase.auth.getUser(jwt)`; confere `app_metadata.role`; monta `Deps` reais com o cliente de serviço (`auth.admin.createUser({ email, password, email_confirm: true })` — mensagem de erro com "already" vira `email_existe`; `auth.admin.deleteUser`; `auth.admin.updateUserById(id, { password })`; inserts/updates em `clientes`); despacha pela `acao`.
- [x] **Passo 6: Teste de integração que falha** — `tests/int/admin-clientes.test.js`: admin cria cliente → 201 e consegue logar com `senhaProvisoria`; mesmo e-mail com maiúsculas → 409; cliente comum chamando → 403; redefinir → senha antiga deixa de funcionar e a nova funciona, `senha_provisoria` volta a `true`.
- [x] **Passo 7:** `npx supabase functions deploy admin-clientes` e `npm run test:int` → todos PASS.
- [x] **Passo 8:** Commit `feat: função admin-clientes (criar e redefinir senha)`.

---

### Tarefa 4: App do cliente — entrar, trocar senha, pausado, início

**Files:**
- Create: `app/src/cliente/tela.js`, `app/src/cliente/main.js`, `app/src/cliente/telas.js`
- Modify: `app/index.html`, `app/src/textos.js`
- Test: `tests/unit/tela.test.js`

**Interfaces:**
- Consumes: `supabase`, `t()` (Tarefa 1); tabela `clientes`, `eventos`, RPC `marcar_senha_trocada` (Tarefa 2).
- Produces: `telaInicial({ sessao, cliente }): 'entrar' | 'trocar-senha' | 'pausado' | 'inicio' | 'erro'` — `sessao` nula → `entrar`; sessão sem linha em `clientes` (ex.: a admin) → `erro`; `situacao === 'bloqueado'` → `pausado` (vence a senha provisória); `senha_provisoria` → `trocar-senha`; senão `inicio`.

- [x] **Passo 1: Teste que falha**

```js
const c = (x = {}) => ({ situacao: 'ativo', senha_provisoria: false, nome: 'Ana', ...x })
test.each([
  [{ sessao: null, cliente: null }, 'entrar'],
  [{ sessao: {}, cliente: null }, 'erro'],
  [{ sessao: {}, cliente: c({ situacao: 'bloqueado', senha_provisoria: true }) }, 'pausado'],
  [{ sessao: {}, cliente: c({ senha_provisoria: true }) }, 'trocar-senha'],
  [{ sessao: {}, cliente: c() }, 'inicio'],
])('%o → %s', (e, tela) => expect(telaInicial(e)).toBe(tela))
```

- [x] **Passo 2:** `npm test` → FAIL. **Passo 3:** implementar `tela.js`. **Passo 4:** `npm test` → PASS.
- [x] **Passo 5:** `main.js`: ao abrir e a cada `onAuthStateChange`, busca a sessão e **sempre** relê a linha em `clientes` do banco; chama `telaInicial`; ao chegar em `inicio` insere `{ cliente_id, tipo: 'acesso' }` em `eventos` uma vez por abertura do app. `telas.js` desenha cada tela num `<main>` com `textContent` (nunca `innerHTML` com dados do usuário):
  - **entrar:** logo, e-mail, senha, botão "Entrar". Erro de login → `t('entrar.erro')` = "E-mail ou senha incorretos."
  - **trocar-senha:** "Crie sua senha" + dois campos; mínimo 8 caracteres (`"A senha precisa ter pelo menos 8 caracteres."`) e iguais (`"As senhas não são iguais."`); `auth.updateUser({ password })` e depois `rpc('marcar_senha_trocada')`.
  - **pausado:** "Seu acesso está pausado." + "Fale com a administração para reativar." + botão "Sair".
  - **inicio:** "Olá, {nome}!" + "Em breve: seu mês de posts aparece aqui." + botão "Sair".
  - **erro:** "Não encontramos seu cadastro. Fale com a administração." + "Sair".
- [x] **Passo 6: Verificação manual** com `npm run dev` (o executor roda e conta à usuária o que viu): cliente criado na Tarefa 3 → entra com a senha provisória → cai em "Crie sua senha" → troca → "Olá, …!"; sair e entrar com a nova senha vai direto para "Olá"; bloquear pelo painel do Supabase e recarregar → "Seu acesso está pausado"; em *Table editor → eventos* há uma linha `acesso`. Testar em largura de celular (390 px) sem rolagem horizontal.
- [x] **Passo 7:** Commit `feat: app do cliente com login, troca de senha e acesso pausado`.

---

### Tarefa 5: Painel de administração mínimo

**Files:**
- Create: `app/src/admin/acesso.js`, `app/src/admin/dados.js`, `app/src/admin/main.js`, `app/src/admin/telas.js`
- Modify: `app/admin.html`, `app/src/textos.js`
- Test: `tests/unit/acesso.test.js`

**Interfaces:**
- Consumes: `supabase`, `t()`; tabela `clientes` (SELECT/UPDATE como admin); função `admin-clientes` (Tarefa 3).
- Produces:
  - `ehAdmin(sessao): boolean` — `sessao?.user?.app_metadata?.role === 'admin'`.
  - Em `dados.js`: `listarClientes(): Promise<Cliente[]>` (ordenados por `nome`), `criarCliente(dados): Promise<{ id, senhaProvisoria } | { erro }>`, `redefinirSenha(id): Promise<{ senhaProvisoria } | { erro }>`, `definirSituacao(id, situacao: 'ativo'|'bloqueado'): Promise<{ erro? }>`. As duas do meio usam `supabase.functions.invoke('admin-clientes', { body })` e devolvem o `erro` do corpo quando o status não é 2xx.

- [x] **Passo 1: Teste que falha**

```js
test('só role admin entra', () => {
  expect(ehAdmin({ user: { app_metadata: { role: 'admin' } } })).toBe(true)
  expect(ehAdmin({ user: { app_metadata: {} } })).toBe(false)
  expect(ehAdmin(null)).toBe(false)
})
```

- [x] **Passo 2:** `npm test` → FAIL. **Passo 3:** implementar `acesso.js`. **Passo 4:** `npm test` → PASS.
- [x] **Passo 5:** Implementar `dados.js`, `telas.js` e `main.js`:
  - Sem sessão → formulário de login (mesmos textos do cliente). Sessão sem `ehAdmin` → "Esta área é só para a administração." + "Sair".
  - **Lista:** tabela com nome, e-mail, telefone, idioma, situação (selo verde "Ativo" / vermelho "Bloqueado") e "Senha provisória" quando `senha_provisoria`. Em celular, cada linha vira um cartão.
  - **Novo cliente:** formulário nome, e-mail, telefone, idioma (Português / Español). Ao criar, mostra um quadro "Senha provisória: XXXXX" com botão "Copiar" e a frase "Envie ao cliente. Ela não aparece de novo." Erros da função aparecem acima do botão.
  - **Ações por cliente:** "Redefinir senha" (confirma antes; mostra o mesmo quadro), "Bloquear" / "Reativar" (confirma antes; atualiza a linha na lista).
- [x] **Passo 6: Verificação manual** com `npm run dev` → `/admin.html`: entrar como admin; criar cliente com telefone "(11) 98765-4321" → aparece `5511987654321`; criar de novo com o mesmo e-mail em maiúsculas → "Já existe um cliente com este e-mail."; bloquear → no app do cliente aparece "acesso pausado"; reativar → volta ao "Olá"; redefinir senha → o cliente é levado de novo a "Crie sua senha"; entrar no `/admin.html` com a conta de um cliente → "Esta área é só para a administração." Testar em 390 px.
- [x] **Passo 7:** Commit `feat: painel de administração mínimo`.

---

### Tarefa 6: Publicação no Netlify

**Files:**
- Create: `netlify.toml`

- [x] **Passo 1:** `netlify.toml`: `[build] command = "npm run build"`, `publish = "dist"`, `[build.environment] NODE_VERSION = "22"`; header `X-Frame-Options = "DENY"` e `Referrer-Policy = "strict-origin-when-cross-origin"` para `/*`.
- [x] **Passo 2:** Commit `chore: configuração do Netlify` e, **com autorização da usuária**, push do branch (`git -c http.sslBackend=schannel push -u origin v2-etapa1`).
- [x] **Passo 3 (usuária, com orientação):** no Netlify, *Add new site → Import from GitHub → PAT*, branch `v2-etapa1`; em *Environment variables* cadastrar só `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY`. No Supabase, *Authentication → URL Configuration*: colocar o endereço do Netlify em *Site URL*.
- [x] **Passo 4: Verificação:** repetir no endereço público o roteiro das Tarefas 4 e 5 pelo celular da usuária; conferir que `dist/` publicado não contém `service_role` (`grep -r service_role dist` vazio no build local).
- [x] **Passo 5:** Atualizar a memória do projeto com o endereço do site e o estado da etapa.
