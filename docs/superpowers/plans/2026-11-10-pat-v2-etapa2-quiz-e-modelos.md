# PAT v2 · Etapa 2 — Quiz do negócio, quiz do mês e geração por modelos prontos · Plano de construção

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A administradora define o ramo de cada cliente no cadastro. O cliente preenche o quiz do negócio (nome, itens com fotos, tom, horário, logo, @, assinatura, cores), escolhe a estratégia do mês e recebe o mês inteiro de posts para Instagram, Facebook, TikTok/Reels e WhatsApp, montado com os modelos prontos do PAT atual e salvo no Supabase. O app mostra a lista do mês, com o botão de copiar a legenda.

**Architecture:** Os modelos do PAT (`bancada/index.html`) viram módulos TypeScript puros em `supabase/functions/_shared/modelos/`, sem dependências. A Edge Function `gerar-mes` (que na Etapa 3 vai chamar o Claude primeiro) e o app (via Vite, que importa `.ts`) usam os mesmos módulos. A função decide o mês-alvo, gera, valida e grava tudo de uma vez pela RPC `criar_mes`, que só a chave de serviço executa. O quiz grava `negocios` e `produtos` direto pelo supabase-js, protegido por RLS. Logo e fotos vão reduzidas para o bucket privado `marcas`.

**Tech Stack:** O mesmo da Etapa 1: Vite 6, Vitest 3, `@supabase/supabase-js` 2, Supabase CLI v3 (`--remote --yes`), Edge Functions em Deno.

**Spec:** `docs/superpowers/specs/2026-11-06-pat-v2-design.md`. Seções usadas:
- 3.1: quiz do negócio, quiz do mês, geração;
- 3.3: tabelas `negocios`, `produtos`, `meses` e `posts`, storage, `gerar-mes`;
- 3.4: o que é aproveitado do PAT;
- 4: conteúdo do mês e mistura por estratégia;
- 5: passos 1 a 4, só com modelos;
- 6: foto grande;
- 7;
- 8: testes das regras;
- 9: item 2.

**Fora desta etapa:**

| Assunto | Fica para |
|---|---|
| IA (Claude) | Etapa 3 |
| Revisão (aprovar, editar, gerar outro) | Etapa 3 |
| Desenho das artes no canvas | Etapa 4, com o "baixar arte" |
| Montagem dos vídeos no aparelho | Etapa 4 |
| Calendário visual, "✓ Postei", modo sem internet, notificações | Etapa 4 |
| Pergunta de resultados do mês anterior | Etapa 5 |
| Textos em espanhol | Etapa 5 |
| Painel com dados do negócio | Etapa 5 |

Nesta etapa os clientes `es` veem as telas e os posts em português.

## Global Constraints

- Trabalhar no branch `v2-etapa2`, criado a partir de `v2-etapa1` na Tarefa 1.
- Nada é enviado ao GitHub sem a usuária pedir. O push, quando pedido, é feito com `git -c http.sslBackend=schannel push`.
- A alteração pendente em `bancada/index.html` não entra em nenhum commit.
- O `bancada/` só é lido, nunca alterado.
- Os textos de interface ficam em `app/src/textos.js`, na chave `pt`. Os textos de conteúdo (posts) ficam em `supabase/functions/_shared/modelos/`.
- **O ramo é escolhido pela administradora** ao criar o cliente, e ela pode trocá-lo no painel. O cliente nunca escolhe nem altera o ramo: o quiz já chega com ele definido. Ele fica gravado em `clientes.ramo`.
- **Ramos escaláveis.** Cada ramo é um arquivo `supabase/functions/_shared/modelos/ramos/<id>.ts`, registrado em `ramos/index.ts` (`RAMOS`). Incluir um ramo novo significa criar o arquivo e registrá-lo; não precisa de migração, nem de mexer em telas, na função ou nos testes:
  - as telas e o painel listam os ramos a partir de `RAMOS`;
  - o banco só confere o formato do id;
  - os testes de contrato percorrem todos os ramos registrados.

  Os ramos de hoje são `ferramentas`, `turismo`, `beleza`, `psicologia` e `advocacia`. Nenhum código fora de `ramos/` cita um ramo pelo nome; as regras especiais vêm dos campos `noPromo` e `textOnly`.
- As estratégias são `vender`, `crescer`, `credibilidade` e `tempo`. Os rótulos são "Vender mais", "Crescer o perfil", "Credibilidade" e "Economizar tempo". Em psicologia e advocacia, `vender` aparece como **"Atrair contatos"**.
- Em ramos com `noPromo`, que são psicologia e advocacia, nenhum post contém preço, `%`, "promo", "desconto", "oferta" ou "black friday", sem distinção de maiúsculas. Isso vale mesmo que o cliente tenha informado um preço.
- A agenda do mês, por rede, com o máximo de cada item, segue §4 da spec:

| Rede e tipo | Dias | Máximo |
|---|---|---|
| Feed do Instagram | segunda, quarta e sexta | 12 |
| Stories | nos mesmos dias do feed | 12 |
| Feed do Facebook | nos mesmos dias, com o mesmo conteúdo | 12 |
| Vídeos TikTok/Reels | terça (em `crescer`: terça e quinta) | 4 (em `crescer`: 6) |
| Status do WhatsApp | terça e quinta | 8 |
| Mensagens para a lista do WhatsApp | 1ª quinta dos dias 1–15 e 1ª quinta dos dias 16–fim | 2 |

  Só entram datas a partir da data de início.
- Os vídeos se dividem entre `montagem` (feitos com as fotos) e `gravar` (roteiro para gravar), conforme a estratégia: `vender` 2 e 2, `tempo` 3 e 1, `crescer` 2 e 4, `credibilidade` 2 e 2.
- A mistura de pilares do feed, por estratégia, é a seguinte:
  - `vender`: {demo .5, aprox .2, need .3};
  - `tempo`: {demo .4, aprox .3, need .3};
  - `crescer`: {demo .2, aprox .45, need .35};
  - `credibilidade`: {demo .25, aprox .5, need .25}.

  A escolha segue o algoritmo de pontuação do PAT (`bancada/index.html:920`): pontuação = peso × n − usados, com −0,6 quando o pilar é igual ao anterior.
- Mês-alvo, calculado com a data de hoje em `America/Sao_Paulo`:
  - Até o dia 20, se o mês atual ainda não foi gerado, gera o mês atual a partir de hoje.
  - Fora desse caso, gera o mês seguinte inteiro, se ele ainda não foi gerado.
  - Se nenhum dos dois casos vale, não há mês para gerar.
- Limites de hashtags por post: até 5 no Instagram, até 3 no Facebook e nenhuma no WhatsApp.
- Limites de tamanho: legenda com até 2.200 caracteres e no mínimo 1; título com até 90.
- Os textos dos posts nunca inventam preço nem desconto. A oferta usa só o preço que o cliente informou ("A partir de R$ 299,90"). Sem preço, a oferta não cita valor.
- Formato dos dados:
  - o mês é gravado no formato `AAAA-MM`;
  - datas no formato `AAAA-MM-DD`;
  - horário no formato `HH:MM`;
  - cores em hex `#RRGGBB`.
- Fotos: o lado maior fica com no máximo 1600 px, em JPEG com qualidade 0,85. A logo fica com o lado maior de no máximo 800 px, em PNG, para manter a transparência. Tudo é reduzido no aparelho antes do envio.
- O app tem no máximo 12 itens (produtos, serviços ou temas) por negócio e no mínimo 1.

## Review Focus

1. **Mês gerado no meio do mês.**
   - No dia 16 de novembro, só entram datas a partir do dia 16, com quantidades menores.
   - A partir do dia 21, gera dezembro inteiro.
   - Testes na Tarefa 4.
2. **Psicologia ou advocacia com preço preenchido num item.** Nenhum post tem preço nem palavra de promoção, em nenhuma estratégia. Teste na Tarefa 5.
3. **Clique duplo em "Gerar" ou duas abas abertas.** Fica um único mês gravado. A segunda chamada recebe 409 e o app recarrega o mês já existente. Testes nas Tarefas 1 e 6.
4. **Cliente bloqueado, ou ainda com senha provisória, tentando gerar ou gravar o negócio.** É recusado:
   - pela função, com 403;
   - pela RLS, que impede gravar em `negocios`, `produtos` e `marcas`.

   Testes nas Tarefas 1 e 6.
5. **Item fora da biblioteca** (ex.: "Bolo de pote" em ferramentas), **um único item**, **nome com aspas ou emoji**. Os posts usam o texto genérico do ramo (`gen`), sem `undefined` e sem `{prod}` sobrando. O mesmo título não aparece em dois dias seguidos do feed. Teste na Tarefa 5.

---

### Tarefa 1: Tabelas, RLS e bucket

**Files:**
- Create: `supabase/migrations/20261111000001_negocio_mes.sql`
- Modify: `tests/int/ajuda.js` (helper `novoNegocio`)
- Test: `tests/int/negocio-rls.test.js`

**Interfaces:**
- Produces:
  - **`public.cliente_ativo() returns boolean`.**
    - Security definer, `search_path ''`.
    - Retorna `exists(clientes where id = auth.uid() and situacao = 'ativo')`.
  - **`clientes.ramo text null`.**
    - Check: `ramo ~ '^[a-z][a-z0-9_]{1,29}$'`. Só o formato; a lista válida fica no código.
    - É nulo para os clientes criados antes desta etapa; a administradora define pelo painel.
    - O cliente não altera (a Etapa 1 já não dá a ele update em `clientes`).
  - **`negocios`.**
    - `cliente_id uuid pk → clientes(id) on delete cascade`.
    - Sem coluna de ramo: o ramo vem de `clientes`.
    - `nome text` (check: 2 a 80 caracteres).
    - `insta text null` (check: `^@?[A-Za-z0-9._]{1,30}$`).
    - `assinatura` (check: `logo`, `insta` ou `ambos`; default `ambos`).
    - `tom` (check: `proximo`, `tecnico` ou `promo`; default `proximo`).
    - `horario text` (check: `07:00`, `12:00` ou `19:00`; default `19:00`).
    - `cor1` e `cor2 text` (check: `^#[0-9A-Fa-f]{6}$`).
    - `logo_path text null`.
    - `atualizado_em timestamptz default now()`.
  - **`produtos`.**
    - `id uuid pk default gen_random_uuid()`.
    - `cliente_id → negocios(cliente_id) on delete cascade`.
    - `nome text` (check: 2 a 80 caracteres).
    - `descricao text null` (até 300).
    - `preco numeric(10,2) null` (check: maior que 0).
    - `foto_path text null`.
    - `ordem int default 0`.
  - **`meses`.**
    - `id uuid pk`.
    - `cliente_id → clientes(id) on delete cascade`.
    - `ano_mes text` (check: `^\d{4}-(0[1-9]|1[0-2])$`).
    - `estrategia` (check: os 4 ids).
    - `origem` (check: `ia` ou `modelo`).
    - `gerado_em timestamptz default now()`.
    - `unique (cliente_id, ano_mes)`.
  - **`posts`.**
    - `id uuid pk`.
    - `mes_id → meses(id) on delete cascade`.
    - `data date`.
    - `rede` (check: `instagram`, `facebook`, `tiktok` ou `whatsapp`).
    - `tipo` (check: `feed`, `stories`, `video`, `status` ou `lista`).
    - `formato` (check: `arte`, `carrossel`, `montagem`, `gravar` ou `texto`).
    - `pilar` (check: `demo`, `aprox` ou `need`).
    - `titulo text`.
    - `legenda text`.
    - `hashtags text[] default '{}'`.
    - `horario text`.
    - `roteiro text null`.
    - `produto_id uuid null → produtos(id) on delete set null`.
    - `estado` (check: `gerado`, `aprovado` ou `editado`; default `gerado`).
    - `trocas int default 0`.
    - `ordem int`.
    - Índice em `(mes_id, data)`.
  - **`public.criar_mes(p_cliente uuid, p_ano_mes text, p_estrategia text, p_origem text, p_posts jsonb) returns uuid`.**
    - Insere o mês e os posts na mesma transação; os posts vêm de `jsonb_to_recordset` com as colunas de `posts` menos `id`, `mes_id`, `estado` e `trocas`.
    - `revoke` de `public`, `anon` e `authenticated`; `grant execute` só para `service_role`.
    - Um mês repetido levanta 23505.
  - **Grants:**
    - `revoke all` de `anon` e `authenticated` nas 4 tabelas.
    - `authenticated` recebe `select, insert, update, delete` em `negocios` e `produtos`.
    - `authenticated` recebe só `select` em `meses` e `posts`.
  - **Políticas:**
    - O cliente lê o que é dele: em `negocios` e `produtos`, `cliente_id = auth.uid()`; em `posts`, pelo `mes_id` de um mês dele.
    - O admin lê tudo, com `is_admin()`.
    - O cliente grava `negocios` e `produtos` só com `cliente_id = auth.uid() and cliente_ativo()`.
  - **`eventos_registrar`:** passa a exigir `cliente_ativo()`, o que resolve a pendência (b) da Etapa 1.
  - **Bucket `marcas`:**
    - privado, com limite de 5 MB e os tipos `image/jpeg`, `image/png` e `image/webp`;
    - políticas em `storage.objects` para `authenticated`:
      - select, insert, update e delete exigem `bucket_id = 'marcas' and (storage.foldername(name))[1] = auth.uid()::text`;
      - insert, update e delete exigem também `cliente_ativo()`;
      - o admin tem select.
  - **Helper `novoNegocio(cliente, extra?)`** em `tests/int/ajuda.js`: via `servico()`, grava `clientes.ramo = 'ferramentas'` e um negócio com 2 produtos, e retorna `{ produtos }`.

- [ ] **Passo 1:** `git checkout v2-etapa1 && git checkout -b v2-etapa2`.
- [ ] **Passo 2: Teste que falha.** Criar `tests/int/negocio-rls.test.js`, com estes testes:
  - `cliente grava e lê o próprio negócio e produtos`;
  - `cliente não lê negócio nem posts de outro`: o resultado é `[]`;
  - `cliente bloqueado não grava negócio`: o erro tem `code` `42501`;
  - `cliente não altera o próprio ramo`: o `update` não muda a linha;
  - `admin define o ramo de um cliente`;
  - `cliente não insere em meses nem posts`: o erro é `42501`;
  - `cliente não executa criar_mes`: o erro existe;
  - `admin lê negócios de todos`;
  - `cliente envia arquivo só na própria pasta do bucket marcas`:
    - `upload` em `${id}/x.png` funciona;
    - em `${outroId}/x.png` dá erro.
  - `cliente bloqueado não registra evento`: `insert` em `eventos` dá erro;
  - `criar_mes pela chave de serviço grava mês e posts, e repetir dá 23505`.
- [ ] **Passo 3:** Rodar `npm run test:int -- negocio-rls`.
  Expected: FAIL. Por exemplo, `relation "public.negocios" does not exist`.
- [ ] **Passo 4:** Escrever a migração conforme a Interface.
- [ ] **Passo 5:** Aplicar com `npx supabase db push --remote --yes`.
  Expected: a migração aparece como aplicada.
- [ ] **Passo 6:** Rodar `npm run test:int`.
  Expected: todos passam, inclusive os 14 da Etapa 1.
  - Se o `main.js` do cliente tratava como fatal o erro do insert de `acesso`, isso precisa mudar: para cliente bloqueado o evento não grava, e o app precisa seguir em silêncio.
- [ ] **Passo 7: Commit.**
  ```bash
  git add supabase/migrations/20261111000001_negocio_mes.sql tests/int/ajuda.js tests/int/negocio-rls.test.js
  git commit -m "feat: tabelas do negócio e do mês, RLS e bucket marcas"
  ```

---

### Tarefa 2: Biblioteca de modelos por ramo

**Files:**
- Create:
  - `supabase/functions/_shared/modelos/tipos.ts`
  - `supabase/functions/_shared/modelos/ramos/padroes.ts`: os tons padrão e as perguntas padrão.
  - `supabase/functions/_shared/modelos/ramos/{ferramentas,turismo,beleza,psicologia,advocacia}.ts`: um arquivo por ramo, cada um com `export default` de um `Ramo`.
  - `supabase/functions/_shared/modelos/ramos/index.ts`: o registro.
  - `docs/como-incluir-um-ramo.md`: o passo a passo, em linguagem simples.
- Test: `tests/unit/ramos.test.ts`

**Interfaces:**
- Produces, em `tipos.ts`:
  ```ts
  export type RamoId = string   // de propósito: a lista válida é o registro, não um tipo fechado
  export type Estrategia = 'vender'|'crescer'|'credibilidade'|'tempo'
  export type Tom = 'proximo'|'tecnico'|'promo'
  export type Pilar = 'demo'|'aprox'|'need'
  export type Item = { k: string, nome: string, cat: string, art?: string, curto: string, titulo?: string,
    gancho: string, demo: string, beneficio: string, dor: string, dorG: string, dorT: string, sol: string }
  export type Aprox = { tema: string, fmt: 'Stories'|'Reels'|'Carrossel'|'Post', poll?: string[], t: string, f: [string, string][] }
  export type Ramo = { id: RamoId, nome: string, desc: string, assunto: string, itens: string, itensQ: string,
    itemOne: string, nomeQ: string, quem: string, lib: Item[], aprox: Aprox[], tags: string[],
    ptags: Record<Pilar, string>, convite: Record<Tom, string>, tons: [Tom, string, string][],
    titulo: (it: Item) => string, gen: (nome: string, curto: string) => Omit<Item, 'k'|'nome'|'cat'|'curto'>,
    textOnly: boolean, noPromo: boolean, cores: { cor1: string, cor2: string } }
  ```
- Produces, em `ramos/index.ts`:
  - `RAMOS: Readonly<Record<string, Ramo>>`. É montado a partir da lista de imports, com a chave = `ramo.id`.
  - `ramoValido(id: unknown): id is string`.
  - `listaRamos(): { id: string, nome: string, desc: string }[]`, em ordem alfabética de `nome`. Alimenta o painel.
  - `itemDoProduto(ramo: Ramo, nome: string): Item`: busca no `lib` o item cuja `k` está contida no nome em minúsculas; se nenhum casar, usa `ramo.gen(nome, nome.toLowerCase())` com `k: 'gen'`, `cat: 'Geral'` e `curto: nome.toLowerCase()`.
  - `ENGAJA_CTA: string[]` (`bancada/index.html:826`).

**Como portar** (`bancada/index.html:481-804`):
- Copiar `*_LIB`, `*_APROX` e os campos de `NICHES`.
- Retirar tudo o que é próprio de novembro ou da demonstração: `datas`, `esp`, `bf`, `def`, `sample`, `sug`, `tipo`, `publico`, `mixO`, `promo`, `p1`, `p2`, `IMGK`, `PRECO`, `APROX_IMG`, `POOL`, `CREDITS`.
- O título de ferramentas fica sempre "em casa", sem depender de `publico`.
- Os ramos sem `tons` próprios recebem os tons padrão de `bancada/index.html:818`.
- Os ramos sem `nomeQ` recebem "Qual é o nome do seu negócio?".
- Os ramos sem `quem` recebem "o cliente".
- `cores` de ferramentas: `#F2A21B` e `#151925`; de turismo: `#1FA3B8` e `#0F2233`.

- [ ] **Passo 1: Teste que falha.** Criar `tests/unit/ramos.test.ts`. Os testes de contrato usam `describe.each(Object.values(RAMOS))`, para que um ramo novo seja testado sem mudar o arquivo de teste:
  - `id no formato do banco e igual à chave`: `/^[a-z][a-z0-9_]{1,29}$/`;
  - `tem pelo menos 8 itens e 8 aproximações, e os 3 convites`;
  - `tem ao menos 2 aproximações Stories e 2 Reels`, porque a geração precisa delas;
  - `cores em hex`;
  - `se noPromo, nenhum texto tem palavra de promoção`. Esse teste está descrito mais abaixo.

  E estes:
  - `os 5 ramos atuais estão registrados`;
  - `psicologia e advocacia têm noPromo e textOnly; os outros não`;
  - `ramoValido aceita 'beleza' e recusa 'padaria', '' e null`;
  - `itemDoProduto acha "Furadeira Bosch" no lib de ferramentas`, com `k === 'furadeira'`;
  - `itemDoProduto usa gen para item desconhecido`:
    - `itemDoProduto(RAMOS.ferramentas, 'Bolo de pote')` retorna `k === 'gen'`;
    - o `gancho` contém `bolo de pote`.
  - o teste de contrato `se noPromo, nenhum texto tem palavra de promoção`:
    - percorre todas as strings de `lib`, `aprox`, `convite` e `gen('x','x')`;
    - aplica `/R\$|\d+\s?%|promo|desconto|oferta|black friday/i`.
- [ ] **Passo 2:** Rodar `npx vitest run tests/unit/ramos.test.ts`.
  Expected: FAIL, porque o módulo não existe.
- [ ] **Passo 3:** Portar conforme as regras acima.
  - Se o último teste encontrar uma palavra proibida num texto antigo, reescrever a frase sem ela e registrar um Ruling.
  - O convite `promo` desses ramos, "Agende uma consulta…", não tem palavra proibida. Manter.
  - Escrever `docs/como-incluir-um-ramo.md` em 4 passos:
    1. copiar o arquivo de um ramo parecido;
    2. trocar os textos;
    3. registrar o ramo em `index.ts`;
    4. rodar `npm test`.

    O documento também explica que `noPromo` e `textOnly` existem para profissões com regras de conselho.
- [ ] **Passo 4:** Rodar o teste.
  Expected: PASS.
- [ ] **Passo 5: Commit.**
  ```bash
  git add supabase/functions/_shared/modelos/tipos.ts supabase/functions/_shared/modelos/ramos docs/como-incluir-um-ramo.md tests/unit/ramos.test.ts
  git commit -m "feat: biblioteca de modelos dos 5 ramos"
  ```

---

### Tarefa 3: O ramo é escolhido pela administradora

**Files:**
- Modify:
  - `supabase/functions/_shared/validacao.ts`
  - `supabase/functions/admin-clientes/index.ts`
  - `app/src/admin/dados.js`
  - `app/src/admin/telas.js`
  - `app/src/textos.js`
- Test:
  - `tests/unit/validacao.test.ts`
  - `tests/unit/admin-ramo.test.js`
  - `tests/int/admin-clientes.test.js`

**Interfaces:**
- Consumes: `ramoValido` e `listaRamos` (Tarefa 2), e a coluna `clientes.ramo` (Tarefa 1).
- Produces:
  - **`validarNovoCliente`:**
    - recebe também `ramo`;
    - confere o ramo depois do idioma e antes do telefone;
    - ramo inválido → `{ ok:false, erro:'Escolha o ramo do negócio.' }`;
    - `NovoCliente` ganha `ramo: string`.
  - **`admin-clientes` (ação `criar`):** grava `ramo` na linha de `clientes`.
  - **`definirRamo(id: string, ramo: string)`** em `dados.js`. Faz um `update` direto em `clientes`, permitido ao admin pela política da Etapa 1.
  - **`nomeDoRamo(id: string|null): string`** em `dados.js`. Retorna `RAMOS[id].nome` ou `'—'`.
  - **Painel:**
    - o formulário "Novo cliente" ganha um `<select>` obrigatório de ramo, alimentado por `listaRamos()`, com a primeira opção vazia "Escolha o ramo";
    - a lista de clientes ganha a coluna "Ramo";
    - em cada cliente, um `<select>` permite trocar o ramo:
      - pede confirmação: "Trocar o ramo muda os próximos meses gerados. Continuar?";
      - quando o ramo está vazio, o cliente aparece com o selo "Sem ramo".

- [ ] **Passo 1: Teste que falha.**
  - Ampliar `tests/unit/validacao.test.ts`:
    - `ramo ausente ou desconhecido → 'Escolha o ramo do negócio.'`;
    - `ramo válido é devolvido em dados`.
  - Criar `tests/unit/admin-ramo.test.js`: `nomeDoRamo('beleza')` → `'Beleza e bem-estar'`; `nomeDoRamo(null)` → `'—'`.
  - Em `tests/int/admin-clientes.test.js`:
    - `novo()` passa a enviar `ramo: 'beleza'`;
    - o 1º teste confere `ramo: 'beleza'` na linha gravada;
    - novo teste `criar sem ramo → 400 'Escolha o ramo do negócio.'`.
- [ ] **Passo 2:** Rodar `npm test`.
  Expected: FAIL nos novos testes.
- [ ] **Passo 3:** Implementar.
- [ ] **Passo 4:** Rodar `npm test`.
  Expected: PASS.
- [ ] **Passo 5:** Publicar com `npx supabase functions deploy admin-clientes --remote --yes`, depois rodar `npm run test:int`.
  Expected: todos passam.
- [ ] **Passo 6: Teste manual com a usuária.**
  1. Criar um cliente escolhendo o ramo.
  2. Trocar o ramo de um cliente antigo.
  3. Conferir a coluna "Ramo" na lista.
- [ ] **Passo 7: Commit.**
  ```bash
  git add supabase/functions app/src tests
  git commit -m "feat: ramo do negócio definido pela administradora"
  ```

---

### Tarefa 4: Agenda do mês e mês-alvo

**Files:**
- Create: `supabase/functions/_shared/modelos/calendario.ts`
- Test: `tests/unit/calendario.test.ts`

**Interfaces:**
- Produces:
  - `type Agenda = { feed: string[], videos: string[], status: string[], lista: string[] }`. São datas `AAAA-MM-DD` em ordem.
  - `agendaDoMes(anoMes: string, inicio: string, estrategia: Estrategia): Agenda`. Segue as regras das Global Constraints. As datas são calculadas em UTC (`Date.UTC`), sem fuso.
  - `mesAlvo(hoje: string, gerados: string[]): { anoMes: string, inicio: string } | null`.
  - `hojeEmSaoPaulo(agora?: Date): string`. Usa `Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' })`.
  - `nomeDoMes(anoMes: string): string`. Exemplo: `'2026-11'` vira `'novembro de 2026'`.

- [ ] **Passo 1: Teste que falha.** Criar `tests/unit/calendario.test.ts`, com estes testes:
  - **`mês inteiro de dezembro de 2026`.** `agendaDoMes('2026-12','2026-12-01','vender')` retorna:
    - `feed` com 12 datas, de `2026-12-02` a `2026-12-28`, sem `2026-12-30`;
    - `videos` = `['2026-12-01','2026-12-08','2026-12-15','2026-12-22']`;
    - `status` com 8 datas, começando por `2026-12-01` e `2026-12-03`;
    - `lista` = `['2026-12-03','2026-12-17']`.
  - **`crescer tem até 6 vídeos em terças e quintas`.** Em dezembro, `videos` tem 6 itens, o primeiro `2026-12-01` e o segundo `2026-12-03`.
  - **`começando no dia 16 de novembro`.** `agendaDoMes('2026-11','2026-11-16','tempo')` retorna:
    - `feed` = `['2026-11-16','2026-11-18','2026-11-20','2026-11-23','2026-11-25','2026-11-27','2026-11-30']`;
    - `videos` = `['2026-11-17','2026-11-24']`;
    - `status` = `['2026-11-17','2026-11-19','2026-11-24','2026-11-26']`;
    - `lista` = `['2026-11-19']`.
  - **`mesAlvo`:**
    - `('2026-11-10', [])` → `{anoMes:'2026-11', inicio:'2026-11-10'}`;
    - `('2026-11-21', [])` → `{anoMes:'2026-12', inicio:'2026-12-01'}`;
    - `('2026-11-10', ['2026-11'])` → `null`;
    - `('2026-11-25', ['2026-11'])` → `{anoMes:'2026-12', inicio:'2026-12-01'}`;
    - `('2026-12-22', ['2026-12'])` → `{anoMes:'2027-01', inicio:'2027-01-01'}`;
    - `('2026-11-25', ['2026-11','2026-12'])` → `null`.
  - **`hojeEmSaoPaulo`.** `new Date('2026-11-11T02:30:00Z')` vira `'2026-11-10'`.
  - **`nomeDoMes`.** `'2027-01'` vira `'janeiro de 2027'`.
- [ ] **Passo 2:** Rodar `npx vitest run tests/unit/calendario.test.ts`.
  Expected: FAIL.
- [ ] **Passo 3:** Implementar.
- [ ] **Passo 4:** Rodar o teste.
  Expected: PASS.
- [ ] **Passo 5: Commit.**
  ```bash
  git add supabase/functions/_shared/modelos/calendario.ts tests/unit/calendario.test.ts
  git commit -m "feat: agenda do mês e escolha do mês-alvo"
  ```

---

### Tarefa 5: Geração do mês por modelos e validação

**Files:**
- Create:
  - `supabase/functions/_shared/modelos/gerar.ts`
  - `supabase/functions/_shared/modelos/validar.ts`
- Test:
  - `tests/unit/gerar.test.ts`
  - `tests/unit/validar.test.ts`

**Interfaces:**
- Consumes: `RAMOS` e `itemDoProduto` (Tarefa 2), `agendaDoMes` (Tarefa 4).
- Produces:
  - **Os tipos do pacote:**
    ```ts
    export type Pacote = { ramo: RamoId, estrategia: Estrategia, anoMes: string, inicio: string,
      negocio: { nome: string, insta: string|null, tom: Tom, horario: string },
      produtos: { id: string, nome: string, descricao: string|null, preco: number|null }[] }
    export type PostGerado = { data: string, rede: 'instagram'|'facebook'|'tiktok'|'whatsapp',
      tipo: 'feed'|'stories'|'video'|'status'|'lista', formato: 'arte'|'carrossel'|'montagem'|'gravar'|'texto',
      pilar: Pilar, titulo: string, legenda: string, hashtags: string[], horario: string,
      roteiro: string|null, produto_id: string|null, ordem: number }
    ```
  - **`gerarMes(p: Pacote): PostGerado[]`.**
    - É determinística: o mesmo pacote dá o mesmo resultado.
    - Ordena por `data` e depois por `ordem`.
    - `ordem` é sequencial a partir de 0.
  - **`validarPost(post: PostGerado, ramo: Ramo): string[]`.** Lista os problemas encontrados; uma lista vazia quer dizer que está ok. Confere as regras das Global Constraints: tamanhos, hashtags por rede e as palavras proibidas com `noPromo` (em `titulo`, `legenda` e `roteiro`).
  - **`validarMes(posts: PostGerado[], agenda: Agenda): string[]`.** Confere se as quantidades por rede e tipo batem com a agenda:
    - `instagram/feed`, `instagram/stories` e `facebook/feed` = `agenda.feed.length`;
    - `tiktok/video` = `videos`;
    - `whatsapp/status` = `status`;
    - `whatsapp/lista` = `lista`.

**Como montar cada post** (a partir de `bancada/index.html:869-933` e `1114-1119`):

- **Feed (Instagram).** A cada data de `feed`, escolher o pilar pela mistura da estratégia.
  - **`demo`:**
    - item = próximo produto em rodízio;
    - título = `ramo.titulo(item)`;
    - formato `arte`;
    - legenda = `gancho`, depois `beneficio`, depois o convite.
  - **`need`:**
    - título = `item.dor`;
    - o formato alterna entre `arte` e `carrossel`;
    - legenda = `dorG`, depois `dorT`, depois o convite.
  - **`aprox`:**
    - próxima aproximação em rodízio, com `{prod}` e `{loja}` substituídos;
    - em `credibilidade`, começar pelos temas com "Bastidores", "Equipe", "História", "Nossa história" e "Cliente feliz";
    - `Carrossel` vira `carrossel` e o resto vira `arte`;
    - legenda = Gancho, depois Conexão, depois Convite.
  - **Convite:**
    - padrão: `ramo.convite[tom]`;
    - em `crescer`: rodízio de `ENGAJA_CTA`; com `insta`, acrescenta "Siga {insta} para mais conteúdo sobre {assunto}.".
  - **Oferta das sextas:** em `vender`, sem `noPromo`, o post `demo` de sexta ganha o título "Oferta da semana: …" e a linha "Condição especial esta semana."; com preço, ganha também "A partir de R$ 299,90" (formato `pt-BR`).
  - **Aspas e produto:** tirar as aspas do início e do fim dos textos antigos. `produto_id` = o id do produto usado.
- **Stories (Instagram), na mesma data do feed.**
  - Rodízio das aproximações com `fmt: 'Stories'`.
  - Título = `t`.
  - Legenda = Gancho, depois Conteúdo, depois as opções da enquete ("Enquete: A / B").
  - Formato `arte`, pilar `aprox`, sem hashtags.
- **Facebook, na mesma data do feed.**
  - Mesmo título e formato do feed.
  - A legenda acrescenta, no meio, o parágrafo do 2º campo (Demonstração, Problema ou Conteúdo).
  - Hashtags: `[tagLoja, ramo.tags[0]]`.
- **Vídeos (`tiktok`).** As primeiras N datas são `montagem` e as seguintes são `gravar`, na divisão da estratégia.
  - **`montagem`:**
    - item demo em rodízio;
    - roteiro em linhas numeradas: "1. Abertura (texto na tela): {gancho}", "2. Fotos de {produto}: {demo}", "3. Fechamento: {convite}".
  - **`gravar`:**
    - aproximações com `fmt: 'Reels'` em rodízio;
    - roteiro = os 4 campos numerados, no formato "1. Gancho: …".
  - Legenda = gancho, depois o convite.
  - Hashtags do Instagram.
- **Status (WhatsApp).** Rodízio entre `need` e `demo`. Legenda = gancho, depois o convite. Formato `texto`, sem hashtags.
- **Lista (WhatsApp).**
  - Legenda = "Oi! Aqui é {nome}.", depois o benefício de um item, depois o convite.
  - Em `vender` sem `noPromo`, acrescenta "Condição especial esta semana." e o preço, se houver.
  - Formato `texto`, pilar `demo`.
- **Hashtags do Instagram:** `[...ramo.tags, ramo.ptags[pilar], tagLoja]`, onde `tagLoja` = `#` + o nome sem acentos, sem símbolos e em minúsculas (`bancada/index.html:855`).
- **Horário:** `negocio.horario` em todos os posts.

- [ ] **Passo 1: Teste que falha.** Criar `tests/unit/gerar.test.ts` com um pacote base: ferramentas, dezembro de 2026, início `2026-12-01`, 2 produtos (um com preço 299.9). Testes:
  - **`mês de dezembro em vender tem 50 posts`.** As quantidades por rede/tipo são 12/12/12/4/8/2, e `validarMes` retorna `[]`.
  - **`todo post passa em validarPost`.** Vale para os 5 ramos × 4 estratégias.
  - **`psicologia com preço informado nunca mostra preço nem promoção`.** Em `vender`, com `preco: 150`, nenhum post contém `R$` nem `oferta`.
  - **`vender põe "Oferta da semana" e o preço informado na sexta`.** O post de feed de `2026-12-04` tem o título começando com "Oferta da semana" e a legenda com "R$ 299,90".
  - **`crescer usa o convite de engajamento e cita o @`.** Com `insta: '@loja'`, algum post de feed contém "Siga @loja".
  - **`credibilidade tem mais aproximação que demonstração no feed`.**
  - **`tempo tem 3 montagens e 1 roteiro para gravar`.**
  - **`item desconhecido e único não deixa sobras`.** Com o produto único "Bolo de pote "da vó" 🍰", nenhum texto contém `undefined`, `{prod}` nem `{loja}`. Dois dias seguidos do feed nunca têm o mesmo título.
  - **`é determinística`.** `gerarMes(p)` é igual a `gerarMes(p)`.
- [ ] **Passo 2:** Criar `tests/unit/validar.test.ts`, com estes testes:
  - `acusa hashtag no WhatsApp`;
  - `acusa 6 hashtags no Instagram`;
  - `acusa legenda vazia e legenda com 2201 caracteres`;
  - `acusa "desconto" em advocacia, mas não em beleza`;
  - `validarMes acusa falta de stories`.
- [ ] **Passo 3:** Rodar `npx vitest run tests/unit/gerar.test.ts tests/unit/validar.test.ts`.
  Expected: FAIL.
- [ ] **Passo 4:** Implementar `validar.ts`, depois `gerar.ts`.
- [ ] **Passo 5:** Rodar `npm test`.
  Expected: todos passam.
- [ ] **Passo 6: Commit.**
  ```bash
  git add supabase/functions/_shared/modelos/gerar.ts supabase/functions/_shared/modelos/validar.ts tests/unit/gerar.test.ts tests/unit/validar.test.ts
  git commit -m "feat: geração do mês pelos modelos prontos e validação"
  ```

---

### Tarefa 6: Função `gerar-mes`

**Files:**
- Create:
  - `supabase/functions/gerar-mes/acoes.ts`
  - `supabase/functions/gerar-mes/index.ts`
- Modify: `supabase/config.toml` (`[functions.gerar-mes] verify_jwt = false`)
- Test:
  - `tests/unit/gerar-mes.test.ts`
  - `tests/int/gerar-mes.test.js`

**Interfaces:**
- Consumes: `gerarMes`, `validarPost`, `validarMes`, `agendaDoMes`, `mesAlvo`, `hojeEmSaoPaulo` e `RAMOS`.
- Produces:
  - **`gerarMesDoCliente(entrada: unknown, deps: DepsMes): Promise<Resposta>`**, em `acoes.ts`. O tipo `Resposta` é o mesmo de `admin-clientes/acoes.ts`.
  - **`DepsMes`:**
    ```ts
    type DepsMes = {
      cliente: () => Promise<{ id: string, situacao: string, senha_provisoria: boolean, ramo: string|null } | null>,
      negocio: () => Promise<{ nome: string, insta: string|null, tom: Tom, horario: string } | null>,
      produtos: () => Promise<Pacote['produtos']>,
      mesesGerados: () => Promise<string[]>,
      hoje: () => string,
      salvar: (anoMes: string, estrategia: Estrategia, posts: PostGerado[]) => Promise<{ id: string } | 'repetido'>,
    }
    ```
  - **Respostas, nesta ordem:**

    | Situação | Status | Corpo |
    |---|---|---|
    | Sem cliente, bloqueado ou com senha provisória | 403 | `{erro:'Seu acesso não permite gerar o mês.'}` |
    | `!ramoValido(cliente.ramo)` | 400 | `{erro:'Seu ramo ainda não foi definido. Fale com a administração.'}` |
    | `estrategia` inválida | 400 | `{erro:'Escolha uma estratégia.'}` |
    | Sem negócio ou sem produtos | 400 | `{erro:'Complete o cadastro do seu negócio antes.'}` |
    | `mesAlvo` nulo | 409 | `{erro:'O próximo mês fica disponível a partir do dia 21.'}` |
    | A validação falhou | 500 | `{erro:'Não foi possível montar o mês.'}`, com os problemas no `console.error` |
    | `salvar` respondeu `'repetido'` | 409 | `{erro:'Este mês já foi gerado.'}` |
    | Deu certo | 201 | `{ id, anoMes, total }` |

  - **`index.ts`:** CORS, `getUser(jwt)` e as deps reais com a chave de serviço; `salvar` chama `rpc('criar_mes', …, origem 'modelo')`; o código `23505` vira `'repetido'`.
  - **No app:** `supabase.functions.invoke('gerar-mes', { body: { estrategia } })`.

- [ ] **Passo 1: Teste que falha.** Criar `tests/unit/gerar-mes.test.ts`, com deps falsas. É um teste por linha da tabela de respostas, mais `salva com o mês-alvo e as datas a partir de hoje`: com `hoje` `'2026-11-16'`, `salvar` recebe `'2026-11'` e o primeiro post é do dia `2026-11-16` ou depois.
- [ ] **Passo 2:** Rodar `npx vitest run tests/unit/gerar-mes.test.ts`.
  Expected: FAIL.
- [ ] **Passo 3:** Implementar `acoes.ts` e `index.ts`, e acrescentar o bloco no `config.toml`.
- [ ] **Passo 4:** Rodar `npm test`.
  Expected: PASS.
- [ ] **Passo 5:** Publicar com `npx supabase functions deploy gerar-mes --remote --yes`.
- [ ] **Passo 6: Teste de integração.** Criar `tests/int/gerar-mes.test.js`, com estes testes:
  - `cliente com negócio gera o mês`: a resposta é 201, `total > 0` e os posts são lidos pelo próprio cliente;
  - `segunda chamada → 409 'Este mês já foi gerado.' e continua um mês só`;
  - `outro cliente não vê os posts`;
  - `cliente bloqueado → 403`;
  - `sem negócio → 400`;
  - `cliente sem ramo → 400`.

  O mês-alvo vem de `mesAlvo(hojeEmSaoPaulo(), [])`, importado de `calendario.ts`.
- [ ] **Passo 7:** Rodar `npm run test:int`.
  Expected: todos passam.
- [ ] **Passo 8: Commit.**
  ```bash
  git add supabase/functions/gerar-mes supabase/config.toml tests/unit/gerar-mes.test.ts tests/int/gerar-mes.test.js
  git commit -m "feat: função gerar-mes com modelos prontos"
  ```

---

### Tarefa 7: Quiz do negócio no app

**Files:**
- Create:
  - `app/src/cliente/quiz.js` (telas)
  - `app/src/cliente/negocio.js` (dados e fotos)
- Modify:
  - `app/src/textos.js`
  - `app/src/estilo.css`
  - `app/src/cliente/tela.js`
  - `app/src/cliente/telas.js`
  - `app/src/cliente/main.js`
- Test:
  - `tests/unit/negocio.test.js`
  - `tests/unit/tela.test.js` (amplia)

**Interfaces:**
- Consumes:
  - `RAMOS` (importado de `../../../supabase/functions/_shared/modelos/ramos/index.ts`);
  - `el`, `campo`, `mostrar` e `aoEnviar` de `comum.js`.
- Produces:
  - **`telaInicial({ sessao, cliente, negocio, mes })`.** Depois de `trocar-senha`:
    - `!ramoValido(cliente.ramo)` → `'sem-ramo'`. Essa tela mostra o texto "Seu cadastro ainda está sendo preparado. Fale com a administração." e o botão Sair;
    - `!negocio` → `'quiz-negocio'`;
    - `!mes` → `'quiz-mes'`;
    - senão → `'mes'`.

    As regras existentes continuam valendo antes destas.
  - **`medidaReduzida(largura: number, altura: number, maximo: number): { largura, altura }`.** Mantém a proporção e nunca aumenta a imagem.
  - **`validarItens(itens: {nome, preco}[]): string|null`.**
    - Retorna a chave de texto do erro: `quiz.itens.min`, `quiz.itens.max` ou `quiz.itens.nome`.
    - O nome é aparado e precisa ter 2 a 80 caracteres.
  - **`precoDoTexto(s: string): number|null`.** `"299,90"` → `299.9`; `"R$ 1.299,90"` → `1299.9`; `""` → `null`.
  - **`reduzirFoto(arquivo: File, maximo: number, tipo: 'image/jpeg'|'image/png'): Promise<Blob>`.** Usa canvas, `createImageBitmap` e `toBlob`, com qualidade 0,85. Sem teste unitário: é conferido no teste manual.
  - **`salvarNegocio(supabase, uid, dados, itens)`.**
    - Faz `upsert` de `negocios`.
    - Apaga os produtos removidos e faz `upsert` dos demais com `ordem`.
    - Envia a logo e as fotos novas para `marcas/${uid}/logo.png` e `marcas/${uid}/produtos/${id}.jpg`, com `upsert: true`.
  - **`carregarNegocio(supabase, uid) → { negocio, produtos }`.**
- **Telas do quiz:** uma pergunta por tela, com Voltar, Continuar e o progresso "Passo N de 6". O ramo **não é perguntado**: vem de `cliente.ramo` e aparece no topo ("Ramo: Beleza e bem-estar"), só para leitura. Os passos, na ordem:
  1. nome (`ramo.nomeQ`);
  2. itens (`ramo.itensQ`):
     - cada item tem nome, descrição opcional, preço opcional (escondido se `noPromo`) e foto opcional;
     - atalhos com os nomes do `ramo.lib`;
  3. tom (`ramo.tons`, pergunta "Como você gosta de falar com {ramo.quem}?");
  4. horário (as 3 opções de `bancada/index.html:822`);
  5. logo + @ do Instagram + assinatura (`logo`, `insta` ou `ambos`);
  6. cores: dois `input type=color`, com os valores iniciais de `ramo.cores`.

  O último passo salva e segue para o quiz do mês. A tela `'mes'` tem o link "Editar meu negócio", que reabre o quiz preenchido.

- [ ] **Passo 1: Teste que falha.** Criar `tests/unit/negocio.test.js` com os testes de `medidaReduzida`:
  - `(4000,3000,1600)` → `{1600,1200}`;
  - `(800,600,1600)` → `{800,600}`;
  - `(1000,3000,1600)` → `{533,1600}`, com arredondamento.

  E os de `validarItens`:
  - `[]` → `quiz.itens.min`;
  - 13 itens → `quiz.itens.max`;
  - nome `' a '` → `quiz.itens.nome`.

  E os de `precoDoTexto`, com os casos da Interface.

  Ampliar `tela.test.js` com as quatro novas rotas. Uma delas é `cliente.ramo` nulo ou desconhecido (`'padaria'`), que leva a `'sem-ramo'`.
- [ ] **Passo 2:** Rodar `npm test`.
  Expected: FAIL nos novos testes.
- [ ] **Passo 3:** Implementar `negocio.js`, `tela.js`, as telas do quiz, os textos (todas as chaves `quiz.*`, sem texto fixo nas telas) e o CSS dos cartões de opção. A ordem de carregamento no `main.js` é: cliente → negócio → último mês.
- [ ] **Passo 4:** Rodar `npm test && npm run build`.
  Expected: PASS, e o build sem erro. Isso confirma que o Vite importa o `.ts` de fora de `app/`.
- [ ] **Passo 5: Teste manual.** `npm run dev`, depois entrar com um cliente de teste e responder o quiz. Conferir:
  - com uma foto grande, o arquivo no bucket tem no máximo 1600 px;
  - "Editar meu negócio" volta preenchido;
  - em psicologia não aparece o campo de preço.

  Sem ferramenta de navegador, quem faz é a usuária, com o roteiro passo a passo.
- [ ] **Passo 6: Commit.**
  ```bash
  git add app/src tests/unit
  git commit -m "feat: quiz do negócio com logo, cores e fotos"
  ```

---

### Tarefa 8: Quiz do mês, geração e lista do mês

**Files:**
- Create: `app/src/cliente/mes.js`
- Modify:
  - `app/src/cliente/telas.js`
  - `app/src/cliente/main.js`
  - `app/src/textos.js`
  - `app/src/estilo.css`
- Test: `tests/unit/mes.test.js`

**Interfaces:**
- Consumes: `mesAlvo`, `hojeEmSaoPaulo` e `nomeDoMes` (Tarefa 4), `RAMOS`, e a função `gerar-mes` (Tarefa 6).
- Produces:
  - **`rotuloEstrategia(estrategia: Estrategia, ramo: Ramo): string`.** Retorna "Atrair contatos" para `vender` com `noPromo`.
  - **`agruparPorDia(posts): { data: string, titulo: string, posts: Post[] }[]`.**
    - O título do dia é "Ter, 1 de dez".
    - Os posts do dia ficam na ordem Instagram, Facebook, TikTok, WhatsApp, e dentro de cada rede por `ordem`.
  - **`sugestaoEstrategia(mesAnterior: {estrategia}|null): Estrategia`.** Retorna a estratégia do mês anterior; sem mês anterior, `'tempo'`.
- **Telas:**
  - **`quiz-mes`:**
    - 4 cartões de estratégia, cada um com uma frase de §4 da spec;
    - o cartão sugerido leva o selo "Sugerido";
    - botão "Gerar meu mês de {nomeDoMes}".
  - **`gerando`:**
    - lista de passos animada ("Lendo seus itens", "Separando os dias do mês", "Escrevendo legendas e roteiros");
    - enquanto a função roda, o botão fica desligado;
    - em 409 "Este mês já foi gerado.", recarrega e mostra o mês;
    - nos outros erros, mostra a mensagem da função ou `erro.geral`, com Tentar de novo.
  - **`mes`:**
    - cabeçalho "Seu mês: novembro de 2026 · {estratégia}";
    - os dias em ordem, cada um com os chips de rede e os títulos;
    - tocar num post abre a legenda, as hashtags, o roteiro (se houver) e o botão "Copiar legenda", que copia a legenda e as hashtags com `navigator.clipboard`;
    - quando `mesAlvo(hoje, meses)` não é nulo, aparece "Gerar o mês de {nomeDoMes}", que leva ao `quiz-mes`.

- [ ] **Passo 1: Teste que falha.** Criar `tests/unit/mes.test.js`, com estes testes:
  - `rotuloEstrategia('vender', RAMOS.advocacia)` → `'Atrair contatos'`;
  - o mesmo com `RAMOS.beleza` → `'Vender mais'`;
  - `agruparPorDia` ordena as redes e escreve "Ter, 1 de dez" para `2026-12-01`;
  - `sugestaoEstrategia(null)` → `'tempo'`;
  - `sugestaoEstrategia({ estrategia: 'crescer' })` → `'crescer'`.
- [ ] **Passo 2:** Rodar `npm test`.
  Expected: FAIL.
- [ ] **Passo 3:** Implementar `mes.js`, as três telas e os textos.
- [ ] **Passo 4:** Rodar `npm test && npm run build`.
  Expected: PASS.
- [ ] **Passo 5: Teste manual com a usuária.** O caminho completo:
  1. criar o cliente no painel;
  2. entrar e trocar a senha;
  3. responder o quiz;
  4. escolher a estratégia e gerar;
  5. ver a lista;
  6. copiar uma legenda;
  7. clicar em gerar de novo em outra aba e ver o mês sem duplicar.

  Repetir com um cliente de psicologia e conferir que não aparece preço.
- [ ] **Passo 6: Commit.**
  ```bash
  git add app/src tests/unit/mes.test.js
  git commit -m "feat: quiz do mês, geração e lista do mês"
  ```

---

### Tarefa 9: Publicação

- [ ] **Passo 1:** Rodar `npm test && npm run test:int && npm run build`.
  Expected: tudo passa.
- [ ] **Passo 2:** Rodar `npx supabase migration list --remote` e `npx supabase functions list --remote`.
  Expected: a migração da Tarefa 1 está aplicada, e `gerar-mes` e `admin-clientes` estão ativas.
- [ ] **Passo 3:** Conferir que a chave secreta não está no build:
  - `grep -r "sb_secret_" dist` só mostra o prefixo do supabase-js;
  - `grep -r "PAT_SECRET_KEY\|SERVICE_ROLE" dist` não mostra nada.
- [ ] **Passo 4:** Perguntar à usuária se pode enviar o branch `v2-etapa2` ao GitHub.
  - O Netlify publica a production branch. Combinar com ela a troca de `v2-etapa1` para `v2-etapa2`, ou juntar a `v2-etapa1` na `main` antes.
  - Só depois do "pode": `git -c http.sslBackend=schannel push -u origin v2-etapa2`.
- [ ] **Passo 5:** A usuária repete o teste manual da Tarefa 8 no endereço do Netlify.
