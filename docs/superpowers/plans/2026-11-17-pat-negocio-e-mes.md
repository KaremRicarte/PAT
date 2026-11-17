# Meu negócio × Este mês — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Separar a configuração fixa do negócio (⚙ Meu negócio, no topo) da configuração do mês (cartão "Este mês" no calendário), com as redes definidas pela administradora no painel (o cliente só vê) e troca de estratégia no meio do mês.

**Architecture:** As perguntas do quiz viram blocos independentes (`perguntas.js`) que rodam sozinhos ("Alterar") ou em sequência (primeiro acesso) por um executor genérico de passos. As redes passam para `clientes.redes` (só a administradora altera, pelo painel), lidas no servidor pela gerar-mes. Uma função nova `trocar-estrategia` regera os posts que faltam numa transação SQL.

**Tech Stack:** Vite + JS puro (app/), Supabase Postgres + Edge Functions em Deno (supabase/), Vitest (`npm test` unidade; `npm run test:int -- <arquivo>` integração, um arquivo por vez).

**Spec:** `docs/superpowers/specs/2026-11-17-pat-negocio-e-mes-design.md`

## Global Constraints

- Todo texto de tela em português, em `app/src/textos.js` (chave ausente faz `t()` lançar erro).
- Estilo visual: reutilizar classes existentes (`cartao`, `selo`, `acoes`, `secundario`, `muted`, `chips`) em `app/src/estilo.css`; layout simples, uma coluna, botões de toque ≥ 44px.
- Redes válidas: `instagram`, `facebook`, `tiktok`, `whatsapp` (`REDES` em `supabase/functions/_shared/modelos/tipos.ts`); mínimo 1.
- Estratégias: `vender`, `crescer`, `credibilidade`, `tempo`; rótulo via `rotuloEstrategia(e, ramo)` (noPromo: "Atrair contatos").
- Nunca alterar/apagar post com `postado_em` não nulo; nunca mexer em dias < hoje (`hojeEmSaoPaulo()`).
- Funções Edge seguem o padrão `acoes.ts` (regras puras, deps injetadas, testadas no Vitest) + `index.ts` (Deno, chave de serviço, cliente pelo token). Migrações novas em `supabase/migrations/20261117xxxxxx_*.sql`.
- Publicar no pat-dev: `npx supabase db push --remote --yes` e `npx supabase functions deploy <fn> --project-ref bvliykfmrgbrqimmdria --yes` (token `SUPABASE_ACCESS_TOKEN` em `PAT/.env.local`). Isso é do controlador, não dos implementadores.
- Commits pequenos; terminar a mensagem com `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

## Review Focus

1. Cliente atual (negócio salvo, mês gerado) abre o app depois da mudança: cai no calendário com o cartão, sem perder nada; `clientes.redes` = redes do mês mais recente.
6. Cliente tentando gravar `clientes.redes` direto pela API (com o token dele) é recusado.
2. Trocar estratégia com posts postados hoje/futuro: o postado fica, nenhum post novo duplica o mesmo dia/rede/tipo.
3. "Alterar" uma pergunta e tocar Voltar: nada é gravado; Salvar grava só aquela parte (não apaga itens nem fotos).
4. Cliente sem serviços e sem mês vai para "Seu mês" (serviços primeiro), nunca para um laço de telas.
5. Mês já terminado: estratégia sem botão "Trocar"; mês futuro: troca refaz o mês inteiro.

---

### Task 1: Redes no cadastro do cliente (painel) + gerar-mes lê essas redes

**Files:**
- Create: `supabase/migrations/20261117000001_redes_do_cliente.sql`
- Modify: `supabase/functions/gerar-mes/acoes.ts`, `supabase/functions/gerar-mes/index.ts`
- Modify: `app/src/admin/dados.js`, `app/src/admin/telas.js`, `app/src/textos.js` (coluna Redes no painel)
- Modify: `app/src/cliente/main.js` (o select de `clientes` passa a ler `redes`)
- Test: `tests/unit/gerar-mes.test.ts`, `tests/int/gerar-mes.test.js`, `tests/int/rls.test.js`

**Interfaces:**
- Produces: coluna `clientes.redes text[] not null default '{instagram,facebook,tiktok,whatsapp}'` com `check (cardinality(redes) > 0 and redes <@ array['instagram','facebook','tiktok','whatsapp']::text[])`; preenchida para clientes existentes com as `redes` do mês mais recente (se houver). Só a administradora altera: a política atual `clientes_admin_altera` deve cobrir; conferir que o cliente não consegue mudar `redes` com o token dele e, se conseguir, restringir.
- Produces: `DepsMes.cliente()` passa a devolver também `redes: string[]`. `gerarMesDoCliente` usa `cliente.redes` (filtradas pela ordem de `REDES`, sem repetidas; vazias/ inválidas → as 4) e **ignora** `entrada.redes`. Erro 'Escolha pelo menos uma rede.' deixa de existir.
- Produces painel: `definirRedes(id, redes) → { erro? }` em `admin/dados.js`; `listarClientes` lê `redes`; na tabela, coluna 'Redes' com 4 caixinhas (Instagram, Facebook, TikTok, WhatsApp) por cliente; desmarcar a última é recusado com o aviso 'Deixe pelo menos uma rede.'; cada mudança grava na hora; erro → mensagem geral. Cliente novo nasce com as 4 (padrão da coluna).
- Produces app do cliente: `ctx.cliente.redes` disponível (main.js lê a coluna).

- [ ] Step 1: Testes unitários: (a) `cliente.redes = ['tiktok']` → `salvar` chamado com redes `['tiktok']` e só posts do tiktok, mesmo com `entrada.redes = ['instagram']`; (b) `cliente.redes` ausente → as 4. Remover/adaptar os testes que esperavam 400 por redes vazias.
- [ ] Step 2: Rodar `npx vitest run tests/unit/gerar-mes.test.ts` → FALHA.
- [ ] Step 3: Implementar a migração e o código. `lerRedes` pode ficar para validar `cliente.redes`.
- [ ] Step 4: `npm test` → PASSA.
- [ ] Step 5: Adaptar `tests/int/gerar-mes.test.js`: o teste "só com o TikTok" grava `redes: ['tiktok']` em `clientes` (chave de serviço) antes de gerar; teste novo: o cliente não consegue alterar as próprias `redes`; o teste "redes vazias → 400" vira "redes enviadas pelo app são ignoradas". (O controlador aplica a migração/deploy e roda o int.)
- [ ] Step 6: Commit.

### Task 2: Função `trocar-estrategia`

**Files:**
- Create: `supabase/migrations/20261117000002_trocar_estrategia.sql`
- Create: `supabase/functions/trocar-estrategia/acoes.ts`, `supabase/functions/trocar-estrategia/index.ts`
- Test: `tests/unit/trocar-estrategia.test.ts`, `tests/int/trocar-estrategia.test.js`

**Interfaces:**
- Produces SQL: `public.trocar_estrategia_mes(p_mes uuid, p_estrategia text, p_desde date, p_posts jsonb) returns int` (security definer não necessário; `execute` só para `service_role`, revogado de public/anon/authenticated). Numa transação: `update meses set estrategia`; `delete from posts where mes_id = p_mes and data >= p_desde and postado_em is null`; `insert` dos `p_posts` (mesmas colunas de `criar_mes`, mais `preco_de`, `preco_por`) **exceto** os que tenham (data, rede, tipo) igual a um post que ficou; devolve quantos inseriu.
- Produces Edge: POST `{ mes_id: uuid, estrategia }` → `200 { refeitos: n }`. Erros: 403 acesso (mesma regra da gerar-mes), 400 ramo, 404 'Mês não encontrado.' (inexistente ou de outro cliente), 400 'Escolha uma estratégia.', 409 'Este mês já terminou.' quando `ano_mes` < mês de hoje, 400 'Complete o cadastro do seu negócio antes.'.
- Regra do início: `desde = hoje` se `ano_mes` é o mês de hoje; senão `${ano_mes}-01`. Posts gerados com `gerarMes({ ramo, estrategia, anoMes, inicio: desde, negocio, produtos, redes: mes.redes })`, validados com `validarPost(p, ramo, textosDoCliente)` (como na gerar-mes; problema → 500 'Não foi possível montar o mês.' sem gravar).
- `DepsTrocaEstrategia = { cliente, mes(id) → { id, cliente_id, ano_mes, estrategia, redes } | null, negocio, produtos, hoje, gravar(mesId, estrategia, desde, posts) → Promise<number> }`.

- [ ] Step 1: Testes unitários de `acoes.ts` para cada erro acima; mês atual → `gravar` com `desde = hoje` e só posts com data ≥ hoje nas redes do mês; mês futuro → `desde = AAAA-MM-01`; id não-uuid → 404 sem consultar.
- [ ] Step 2: Rodar → FALHA. Step 3: Implementar (migração + acoes + index). Step 4: `npm test` → PASSA.
- [ ] Step 5: Teste de integração: mês gerado (helper `novoMes`), marcar um post futuro como postado, trocar para `crescer` → mês com `estrategia = 'crescer'`, o postado intacto, sem dois posts com o mesmo (data, rede, tipo) de hoje em diante, posts de dias passados intactos; cliente B → 404.
- [ ] Step 6: Commit.

### Task 3: Perguntas como blocos + executor de passos + salvar separado

**Files:**
- Create: `app/src/cliente/perguntas.js`
- Modify: `app/src/cliente/quiz.js` (vira o executor e reaproveita os blocos), `app/src/cliente/negocio.js`
- Test: `tests/unit/perguntas.test.js`, `tests/unit/negocio.test.js`

**Interfaces:**
- Produces `negocio.js`:
  - `salvarDadosNegocio(supabase, uid, dados) → Promise<void>`: grava a linha de `negocios` (nome, insta, assinatura, tom, horario, cor1, cor2, logo_path, atualizado_em), enviando o logo se `dados.logoBlob`. Não toca em produtos.
  - `salvarItens(supabase, uid, itens, aoProgredir, opcoes) → Promise<void>`: a parte de produtos/fotos de hoje (com o desfazer de envios e a limpeza segura).
  - `salvarNegocio` continua existindo = `salvarDadosNegocio` + `salvarItens` (os testes atuais continuam valendo).
- Produces `perguntas.js`:
  - `estadoDoNegocio(negocio, produtos, ramo) → estado` (o mesmo objeto `estado` que o quiz monta hoje).
  - `PERGUNTAS_FIXAS = ['nome', 'marca', 'tom', 'horario', 'cores']` e `pergunta(chave, { ramo, estado, supabase }) → { titulo, corpo, validar? }` para essas chaves e também `'itens'` (o passo de itens atual, com importação e faixa de fotos).
  - `resumoDaPergunta(chave, estado, ramo) → string` para a página-resumo: nome; "logo · @insta" (ou "sem logo"); rótulo do tom; rótulo do horário; "" para cores (a tela desenha os quadradinhos).
  - `nomesDasRedes(redes) → string`: 'Instagram, Facebook, TikTok, WhatsApp' na ordem de `REDES`.
- Produces `quiz.js`: `telaPassos({ titulo?, perguntas: string[], ctx: { ramo, estado, supabase }, rotuloFinal, aoSalvar: (estado) => Promise, aoCancelar? })` — o executor genérico (contador "Passo n de N" só quando há mais de uma pergunta; Voltar no primeiro passo chama `aoCancelar`; erro de `aoSalvar` mostra `erro.geral` e reabilita). `telaQuiz` deixa de existir ou vira um atalho sobre `telaPassos`.

- [ ] Step 1: Testes: `resumoDaPergunta` para cada chave; `estadoDoNegocio` (redes padrão; itens com fotos e `foto_path` antigo); `salvarDadosNegocio` não chama `from('produtos')`; `salvarItens` mantém o comportamento dos testes atuais de `salvarNegocio` (mover/duplicar os casos de fotos).
- [ ] Step 2: Rodar → FALHA. Step 3: Implementar movendo o código existente (sem mudar textos nem comportamento dos passos). Step 4: `npm test` → PASSA; `cd app && npm run build` sem erro.
- [ ] Step 5: Commit.

### Task 4: ⚙ Meu negócio (página-resumo) e primeiro acesso em duas etapas

**Files:**
- Create: `app/src/cliente/meuNegocio.js`
- Modify: `app/src/cliente/telas.js`, `app/src/cliente/tela.js`, `app/src/cliente/calendario.js` (só o topo), `app/src/textos.js`, `app/src/estilo.css`
- Test: `tests/unit/tela.test.js`, `tests/unit/meuNegocio.test.js` (só partes puras)

**Interfaces:**
- Consumes: `telaPassos`, `pergunta`, `resumoDaPergunta`, `PERGUNTAS_FIXAS`, `estadoDoNegocio`, `salvarDadosNegocio` (Task 3).
- Produces `telaMeuNegocio(ctx)`: título 'Meu negócio', uma linha por chave de `PERGUNTAS_FIXAS` com rótulo, resumo e botão 'Alterar'; por último a linha 'Redes' com `nomesDasRedes(ctx.cliente.redes)`, **sem botão**, e o texto 'Para mudar as redes, fale com a administração.'; botão 'Voltar' → `ctx.atualizar()`. 'Alterar' abre `telaPassos` com só aquela pergunta, `rotuloFinal: 'Salvar'`; salvar → `salvarDadosNegocio` → recarrega o negócio (`carregarNegocio`) → volta à página-resumo; Voltar → página-resumo sem gravar.
- Topo do calendário: `[logo] … [⚙ Meu negócio] [sino] [Sair]`; o botão "Editar meu negócio" sai das ações do calendário.
- `telaInicial`: `!negocio → 'quiz-negocio'`; `!mes → 'quiz-mes'`; senão `'mes'` (sem itens deixa de levar ao quiz do negócio).
- 'quiz-negocio' = `telaPassos` com `PERGUNTAS_FIXAS`, `rotuloFinal: 'Salvar e continuar'`, salva com `salvarDadosNegocio` e chama `atualizar` (que leva a 'quiz-mes').

- [ ] Step 1: Testes de `telaInicial` (negócio sem itens e sem mês → 'quiz-mes'; negócio + mês → 'mes'; sem negócio → 'quiz-negocio').
- [ ] Step 2: Rodar → FALHA. Step 3: Implementar. Step 4: `npm test` → PASSA; build ok.
- [ ] Step 5: Commit.

### Task 5: "Seu mês" (serviços → estratégia → gerar) sem a pergunta das redes

**Files:**
- Modify: `app/src/cliente/mes.js`, `app/src/textos.js`
- Test: `tests/unit/mes.test.js`

**Interfaces:**
- Consumes: `telaPassos`, `pergunta('itens', …)`, `salvarItens` (Task 3).
- Produces `telaQuizMes(ctx)`: passo 1 'itens' (título do ramo `ramo.itensQ`; ao continuar, `salvarItens`), passo 2 estratégia (os cartões atuais com "Sugerido"), botão final 'Gerar meu mês de {mes}' → `telaGerando` sem `redes` no corpo. Sem `alvo` → `atualizar()` como hoje. Voltar no passo 1 só aparece se já houver mês.
- Remover a pergunta das redes do quiz do mês, `escolhaRedes`, `alternarTodas`, `sugestaoRedes` (e seus testes) e as chaves `mesq.redes.*` que ficarem sem uso.

- [ ] Step 1: Ajustar testes de mes.js (remover os de redes do quiz do mês; manter os de estratégia).
- [ ] Step 2: Implementar. Step 3: `npm test` → PASSA; build ok.
- [ ] Step 4: Commit.

### Task 6: Cartão "Este mês", tela de serviços e troca de estratégia

**Files:**
- Create: `app/src/cliente/esteMes.js`
- Modify: `app/src/cliente/calendario.js`, `app/src/cliente/telas.js` (remover `editarNegocio`), `app/src/cliente/refazer.js` (se precisar), `app/src/textos.js`, `app/src/estilo.css`
- Test: `tests/unit/esteMes.test.js`

**Interfaces:**
- Consumes: `pergunta('itens')`, `telaPassos`, `salvarItens`, `estadoDoNegocio`, `depoisDeSalvar` (refazer.js), função `trocar-estrategia` (Task 2), `rotuloEstrategia`.
- Produces puras (testadas): `podeTrocarEstrategia(mes, hoje) → boolean` (ano_mes ≥ mês de hoje); `postsQueMudam(posts, mes, hoje) → number` (não postados com data ≥ desde, onde desde = hoje no mês atual ou `AAAA-MM-01` num mês futuro); `resumoServicos(produtos, ramo) → string` ('4 itens · 1 sem foto' / '1 item' — usar `ramo.itens`/`ramo.itemOne` se fizer sentido, e `servicosSemFoto`).
- Cartão (seção com título 'Este mês', logo abaixo do h1 do mês): linha Estratégia + botão 'Trocar' (só se `podeTrocarEstrategia`); linha Serviços + botão 'Editar/Importar'; linha 'Redes: …' (redes do mês, sem botão). O botão "Gerar o mês de …" continua abaixo do cartão.
- 'Editar/Importar' e o botão do aviso de fotos abrem `telaPassos` só com 'itens', `rotuloFinal: 'Salvar'`; salvar → `salvarItens` → `depoisDeSalvar({ supabase, cliente, produtos: antes, meses, atualizar })`; Voltar → `atualizar`.
- 'Trocar' → tela com os cartões de estratégia (atual marcada) e botão 'Continuar'; escolher a mesma → volta; outra → confirmação: 'Os {n} posts que faltam serão refeitos com a estratégia {estrategia}, inclusive os aprovados. Os já postados não mudam.' [Trocar e refazer] [Cancelar] (n = `postsQueMudam`; se n = 0, texto 'A estratégia do mês muda para {estrategia}.'). Sucesso → `aviso('Estratégia trocada. {n} posts refeitos.')` e `atualizar()`; erro → mensagem da função (mesmo tratamento de `chamar` em refazer.js).

- [ ] Step 1: Testes das três funções puras.
- [ ] Step 2: Rodar → FALHA. Step 3: Implementar. Step 4: `npm test` → PASSA; build ok.
- [ ] Step 5: Commit.

### Task 7: Fechamento

**Files:** `docs/como-incluir-um-ramo.md` (nada muda), `app/src/` (código morto: `editarNegocio`, chaves de texto sem uso como `mes.editar`, `mesq.redes.*` se mudaram de lugar)

- [ ] Step 1: Procurar e remover código e textos sem uso (grep por cada chave/ função removida). `npm test` e build ok.
- [ ] Step 2: Commit.
