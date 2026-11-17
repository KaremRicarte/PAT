# Etapa 4A — Posts profissionais com IA — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Os posts passam a ser escritos pela IA (Claude Opus 5.5) a partir da foto de cada post, em segundo plano depois de o mês aparecer, com fotos de tema geral vindas das fotos do cliente, do banco próprio da administradora, do Pexels ou do Pixabay.

**Architecture:** Regras puras em `supabase/functions/_shared/ia/` (instruções, esquema da resposta, validação, escolha de imagem, custo), sempre com a IA e as buscas injetadas como funções (`deps`) — o SDK `npm:@anthropic-ai/sdk` e o `fetch` real só aparecem nos `index.ts` das funções Deno, para o Vitest conseguir importar as regras. Uma fila no banco (colunas novas em `posts`) é processada pela função `melhorar-posts`, chamada pelo pg_cron a cada minuto e "cutucada" logo depois de gerar/refazer/trocar estratégia. Toda gravação da IA é condicional: se o cliente mexeu no post, a IA não grava.

**Tech Stack:** Vite + JS puro (app/), Supabase Postgres + Storage + Edge Functions (Deno) + pg_cron/pg_net, Claude API (`claude-opus-5-5`), Pexels API, Pixabay API, Vitest.

**Spec:** `docs/superpowers/specs/2026-11-17-pat-etapa4a-posts-profissionais-design.md`

## Global Constraints

- Modelo: `claude-opus-5-5` em todas as chamadas; `output_config.effort: "medium"`; resposta estruturada com `output_config.format` (`type: "json_schema"`); recusa: `betas: ["server-side-fallback-2026-07-01"]` + `fallbacks: "default"` (via `client.beta.messages.create`); sempre checar `stop_reason` antes de ler o conteúdo (`refusal`/`max_tokens` → tratar como falha). Nunca enviar `temperature`, `budget_tokens` nem `thinking: {type:"disabled"}`.
- Segredos (Supabase): `ANTHROPIC_API_KEY`, `PEXELS_API_KEY`, `PIXABAY_API_KEY`. Sem chave → a IA/fonte é tratada como indisponível (posts seguem com modelo, sem erro).
- A IA **nunca** inventa depoimentos, números, prêmios, garantias ou preços; preço só nos posts que já têm `preco_de`/`preco_por`; ramos `noPromo` sem preço/promoção. Todo texto da IA passa por `validarPost(post, ramo, textosDoCliente)` (`_shared/modelos/validar.ts`); reprovado → 1 nova tentativa → senão fica o modelo.
- Fila: só posts com `estado in ('gerado','reprovado')`, `postado_em is null`, `data >= hoje (São Paulo)`. Gravação condicional: só grava se `legenda`, `foto_path`, `estado` e `postado_em` estiverem iguais ao que foi lido.
- Limite: 400 chamadas à IA por cliente por mês do calendário (todas contam: fotos, posts, novas tentativas, trocas). Estourou → modelos, em silêncio.
- Fotos de banco público (Pexels/Pixabay) não se repetem entre clientes; banco próprio pode repetir entre clientes, mas não para o mesmo cliente em 90 dias. Fotos subidas pelo cliente só servem aos posts dele.
- Ordem das imagens de post geral (sem `produto_id`): fotos do cliente (Minhas fotos + serviços) → banco próprio do ramo → Pexels → Pixabay → só texto.
- Textos de tela em `app/src/textos.js`; reutilizar classes CSS existentes; toque ≥ 44px.
- Funções Edge: padrão `acoes.ts` (puro, deps) + `index.ts` (Deno). Migrações `supabase/migrations/20261118xxxxxx_*.sql`. Testes automáticos **nunca** chamam a IA, o Pexels ou o Pixabay de verdade.
- Publicar no pat-dev (db push, deploy, segredos, testes de integração) é do controlador.
- Commits terminam com `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

## Review Focus

1. Cliente aprova/troca imagem/posta enquanto a IA escreve o mesmo post: a ação do cliente vence (nada sobrescrito).
2. Função de fila cai no meio (timeout): posts presos em "trabalhando" voltam para a fila depois de alguns minutos; nenhum post é processado duas vezes ao mesmo tempo.
3. Sem chave da Anthropic / limite estourado / IA recusa: o mês funciona inteiro com modelos e a faixa "Melhorando…" termina.
4. Ramo `noPromo` (psicologia, advocacia): nenhum texto da IA com preço/promoção chega ao banco.
5. Foto de outro cliente nunca é enviada à IA nem gravada num post de outro cliente.

---

### Task 1: Banco de dados da 4A

**Files:**
- Create: `supabase/migrations/20261118000001_ia_posts.sql`
- Test: `tests/int/ia-banco.test.js`

**Interfaces (Produces):**
- `posts`: `origem text not null default 'modelo' check (origem in ('modelo','ia'))`; `ia_estado text not null default 'fila' check (ia_estado in ('fila','trabalhando','pronto','pulado','desistiu'))`; `ia_em timestamptz`. Backfill: posts com `data >= (now() at time zone 'America/Sao_Paulo')::date`, `estado in ('gerado','reprovado')`, `postado_em is null` → `'fila'`; demais → `'pulado'`. O cliente **não** pode alterar essas colunas (não entram no `grant update` de `posts`).
- Trigger (ou regra na função de fila) que tira da fila (`'pulado'`) um post que fica aprovado ou postado.
- `pegar_posts_para_ia(p_limite int) returns setof posts` (só `service_role`): `for update skip locked`, ordena por `data, ordem`, pega `ia_estado='fila'` elegíveis e `'trabalhando'` com `ia_em < now() - interval '5 minutes'`, marca `'trabalhando'` + `ia_em=now()`.
- `negocios.fotos text[] not null default '{}' check (cardinality(fotos) <= 30)` (Minhas fotos; caminhos `{uid}/negocio/{uuid}.jpg`).
- Tabela `fotos_ia (path text primary key, cliente_id uuid null references clientes on delete cascade, origem text check in ('cliente','banco','pexels','pixabay'), ramo text null, externo_id text null, autor text null, descricao text, serve boolean, motivo text, criado_em timestamptz default now())`, `unique (origem, externo_id)`. RLS: cliente lê e apaga as dele (`cliente_id = auth.uid()`); admin (`is_admin()`) lê e apaga todas; inserir/alterar só pelo serviço.
- Tabela `fotos_usadas (cliente_id uuid references clientes on delete cascade, path text, usado_em timestamptz default now())` (para os 90 dias do banco próprio). Só serviço.
- Tabela `uso_ia (id bigserial, cliente_id uuid null, tipo text check in ('foto','post','troca','imagem'), tokens_entrada int, tokens_saida int, custo_usd numeric(10,5), criado_em timestamptz default now())`. Admin lê; escrita só serviço. Função `uso_ia_no_mes(p_cliente uuid) returns int` (conta do mês do calendário, São Paulo).
- Bucket `banco` (privado, imagens, 5 MB): admin insere/lê/apaga; clientes nada.
- Agenda pg_cron `melhorar-posts` a cada minuto chamando a função via pg_net (mesmo padrão de `20261112000002_agenda_lembretes.sql`).

- [ ] Step 1: Teste de integração: (a) post novo nasce `origem='modelo'`, `ia_estado='fila'`; (b) cliente não consegue alterar `origem`/`ia_estado`; (c) `pegar_posts_para_ia` só com serviço, não devolve post aprovado nem de dia passado, e duas chamadas seguidas não devolvem o mesmo post; (d) cliente lê só as próprias linhas de `fotos_ia`; (e) cliente não lê `uso_ia` nem o bucket `banco`; (f) `negocios.fotos` com 31 itens é recusado.
- [ ] Step 2: Implementar a migração. Step 3: `npm test` (unidade, sem mudança) ok. Step 4: Commit. (O controlador aplica e roda o int.)

### Task 2: Núcleo da IA (puro) — escrever post e descrever foto

**Files:**
- Create: `supabase/functions/_shared/ia/instrucoes.ts`, `supabase/functions/_shared/ia/escrever.ts`, `supabase/functions/_shared/ia/descrever.ts`, `supabase/functions/_shared/ia/custo.ts`
- Test: `tests/unit/ia-escrever.test.ts`, `tests/unit/ia-descrever.test.ts`

**Interfaces (Produces):**
- `type ChamarIA = (pedido: { sistema: string, conteudo: Array<{tipo:'texto',texto:string}|{tipo:'imagem',url:string}>, esquema: object, maxTokens: number }) => Promise<{ ok: true, dados: unknown, tokensEntrada: number, tokensSaida: number } | { ok: false, motivo: 'recusa'|'limite'|'erro'|'tempo', tokensEntrada?: number, tokensSaida?: number }>` — o adaptador real (Task 4) faz a chamada ao SDK; aqui só o tipo.
- `escreverPost(chamar: ChamarIA, entrada: EntradaPost): Promise<{ post: CamposDaIA, tentativas: number, tokens: {entrada,saida} } | null>` — monta as instruções (§4 do spec: estrutura gancho/retenção/desejo/reputação, peso por estratégia, formato por rede/tipo, proibições, preço só quando `preco_de/preco_por` vierem, regras do ramo), pede JSON no esquema `{ titulo, gancho, meio, convite, hashtags: string[], roteiro: string|null }`, monta `legenda` no mesmo formato de parágrafos que `gerar.ts` usa (gancho, meio, preço, convite…), roda `validarPost`; reprovou → 1 nova chamada com os problemas listados; reprovou de novo ou `ok:false` → `null`. `EntradaPost` = `{ ramo, negocio:{nome,insta,tom}, estrategia, lugar:{data,rede,tipo,formato,pilar,preco_de,preco_por}, produto: {nome,descricao}|null, foto: {url,descricao}|null, textoModelo: string, textosDoCliente: string[] }`. `CamposDaIA = { titulo, legenda, hashtags, roteiro }`.
- `descreverFoto(chamar, { url, contexto: string }): Promise<{ descricao: string, serve: boolean, motivo: string|null, tokens } | null>` — esquema `{ descricao, serve, motivo }`; "serve" = nítida, iluminada, sem pessoas desconhecidas em destaque, sem texto/marca de terceiros dominando.
- `custoUsd(tokensEntrada, tokensSaida): number` — US$ 4 / 1M entrada, US$ 20 / 1M saída.

- [ ] Step 1: Testes com `chamar` falso: (a) resposta válida vira `legenda` com parágrafos e os campos certos; (b) ramo `psicologia` + resposta com "promoção" → 2ª chamada recebe os problemas; 2ª também ruim → `null`; (c) `ok:false` (recusa) → `null` sem 2ª chamada; (d) post de preço passa `preco_de/preco_por` nas instruções e o texto de valor no formato de `gerar.ts` (`brl`); post sem preço não menciona preço nas instruções; (e) instruções sempre contêm a proibição de inventar depoimentos/números/garantias; (f) `descreverFoto` devolve `serve:false` com motivo quando a IA diz que está escura; (g) `custoUsd(1_000_000, 0) === 4`.
- [ ] Step 2: FALHA. Step 3: Implementar. Step 4: `npm test` PASSA. Step 5: Commit.

### Task 3: Escolha de imagem (pura) — foto do post e post geral

**Files:**
- Create: `supabase/functions/_shared/ia/imagens.ts`
- Test: `tests/unit/ia-imagens.test.ts`

**Interfaces (Produces):**
- `fotoDoLugar({ post, produtos, fotosInfo }): string | null` — mesma regra de `fotoDoPost` (`app/src/cliente/situacao.js`) para posts de serviço (fotos do serviço revezando pela `ordem`), **pulando** paths com `fotosInfo[path].serve === false`; `post.foto_path` já escolhido pelo cliente vence. Post sem `produto_id` → `null` (vai para `escolherImagemGeral`).
- `escolherImagemGeral(deps, { clienteId, ramo, temaDoPost: string, fotosDoCliente: Array<{path,descricao,serve}>, hoje }): Promise<{ path: string, origem, externo?: {id,autor,url} , descricao } | null>` — ordem: fotos do cliente (escolha pela descrição via `deps.escolher`) → banco próprio do ramo sem uso pelo cliente nos últimos 90 dias (`deps.bancoDoRamo`, `deps.usadasPeloCliente`) → `deps.buscarPexels(tema)` sem ids já usados (`deps.idsUsados('pexels')`) → `deps.buscarPixabay(tema)` idem → `null`. `deps.escolher(candidatas:{id,descricao|url}[], tema) → id|null` é a IA vendo as candidatas (Task 4 implementa com `ChamarIA`).
- `temaDaImagem(post): string` — tema curto em português a partir do título/pilar do modelo (usado na busca; a IA pode refinar em Task 4).

- [ ] Step 1: Testes com deps falsas: ordem das fontes; foto reprovada nunca escolhida; banco próprio respeita 90 dias por cliente e pode repetir entre clientes; Pexels/Pixabay pulam ids já usados; tudo vazio → `null`; `post.foto_path` do cliente vence em `fotoDoLugar`.
- [ ] Step 2: FALHA. Step 3: Implementar. Step 4: PASSA. Step 5: Commit.

### Task 4: Adaptadores reais + função `descrever-fotos`

**Files:**
- Create: `supabase/functions/_shared/ia/adaptadores.ts` (só Deno: SDK `npm:@anthropic-ai/sdk`, `fetch` do Pexels/Pixabay, URL assinada do Storage, cópia de imagem externa para `{uid}/banco/{origem}-{id}.jpg`, gravação em `uso_ia`, checagem de `uso_ia_no_mes` ≤ 400)
- Create: `supabase/functions/descrever-fotos/acoes.ts`, `supabase/functions/descrever-fotos/index.ts`
- Modify: `supabase/config.toml` (entrada da função, como as outras)
- Test: `tests/unit/descrever-fotos.test.ts`

**Interfaces:**
- Consumes: `ChamarIA`, `descreverFoto`, `custoUsd` (Task 2); tabelas da Task 1.
- Produces Edge `descrever-fotos`: POST `{ paths: string[] }` (até 30). Cliente: só paths que começam com `{uid}/`; admin (`is_admin`): paths do bucket `banco` com `{ ramo }`. Descreve só os que ainda não estão em `fotos_ia`, grava `fotos_ia` e `uso_ia`, responde `{ descritas: n, fotos: [{path, serve, motivo}] }`. Sem chave/limite → `{ descritas: 0, fotos: [] }` com 200.
- `criarChamarIA(apiKey): ChamarIA` em `adaptadores.ts`: `client.beta.messages.create({ model:'claude-opus-5-5', max_tokens, betas:['server-side-fallback-2026-07-01'], fallbacks:'default', output_config:{ effort:'medium', format:{ type:'json_schema', schema } }, system, messages })`; imagens como `{type:'image', source:{type:'url', url}}`; checa `stop_reason`; `JSON.parse` do bloco de texto; timeout por chamada (60 s fila, 20 s trocas — parâmetro).

- [ ] Step 1: Testes de `acoes.ts` (deps falsas): path de outro cliente é recusado (403 se só houver paths alheios); já descritos não chamam a IA; limite estourado → 0 sem chamar; admin com `ramo` grava `origem:'banco'`, `cliente_id:null`.
- [ ] Step 2: FALHA. Step 3: Implementar. Step 4: `npm test` PASSA. Step 5: Commit.

### Task 5: Fila `melhorar-posts` (segundo plano)

**Files:**
- Create: `supabase/functions/melhorar-posts/acoes.ts`, `supabase/functions/melhorar-posts/index.ts`
- Modify: `supabase/functions/gerar-mes/index.ts`, `supabase/functions/refazer-posts/acoes.ts` (+ index), `supabase/functions/trocar-estrategia/index.ts` — depois de gravar, "cutucar" `melhorar-posts` (fetch sem esperar, com a chave de serviço); `refazer-posts` passa a gravar `origem:'modelo', ia_estado:'fila'` nos posts refeitos.
- Modify: `supabase/config.toml`
- Test: `tests/unit/melhorar-posts.test.ts`

**Interfaces:**
- Consumes: `escreverPost`, `descreverFoto` (T2), `fotoDoLugar`, `escolherImagemGeral`, `temaDaImagem` (T3), adaptadores (T4), `pegar_posts_para_ia` (T1).
- Produces Edge `melhorar-posts`: chamada só com a chave de serviço (pg_cron e cutucadas; qualquer outro → 401). Pega até 6 posts por vez e trabalha até ~110 s; para cada post: carrega cliente/negócio/produtos/mês; limite do cliente estourado → `ia_estado:'desistiu'`; escolhe a imagem (serviço: `fotoDoLugar`, descrevendo a foto na hora se ainda não houver `fotos_ia`; geral: `escolherImagemGeral`, registrando `fotos_usadas` e `fotos_ia` da externa); chama `escreverPost`; grava **condicionalmente** `{ titulo, legenda, hashtags, roteiro, foto_path, origem:'ia', ia_estado:'pronto' }` (ou só `ia_estado:'desistiu'` se `null`); se a gravação condicional não pegar nenhuma linha, apenas segue (o cliente mexeu). Erro inesperado num post não derruba os outros.
- `melhorarUmPost(deps, post): Promise<'pronto'|'desistiu'|'cliente-mexeu'>` em `acoes.ts` (testável).

- [ ] Step 1: Testes de `melhorarUmPost` com deps falsas: caminho feliz grava `origem:'ia'` com a foto escolhida; IA `null` → `'desistiu'`, nada além do estado; gravação condicional sem linha → `'cliente-mexeu'`; limite estourado não chama a IA; post geral sem imagem → grava texto com `foto_path:null`; foto de serviço reprovada é pulada.
- [ ] Step 2: FALHA. Step 3: Implementar. Step 4: `npm test` PASSA. Step 5: Commit.

### Task 6: App — faixa "Melhorando…", selo e avisos de foto

**Files:**
- Modify: `app/src/cliente/calendario.js` (COLUNAS ganham `origem, ia_estado`), `app/src/cliente/post.js`, `app/src/cliente/importarTela.js` (`faixaDeFotos`), `app/src/cliente/situacao.js`, `app/src/cliente/negocio.js` (após salvar fotos, chamar `descrever-fotos` sem esperar), `app/src/textos.js`, `app/src/estilo.css`
- Test: `tests/unit/situacao.test.js`, `tests/unit/ia-app.test.js`

**Interfaces:**
- Produces puras: `progressoIA(posts, hoje) → { feitos, total, ativo }` (total = posts do mês de hoje em diante que estão ou estiveram na fila: `ia_estado in ('fila','trabalhando','pronto','desistiu')`; feitos = `pronto|desistiu`; ativo = algum `fila|trabalhando`); `fotosQueServem(paths, fotosInfo)`.
- Calendário: com `ativo`, faixa "✨ Melhorando seus posts… {feitos} de {total}" no topo e recarga dos posts a cada 15 s enquanto ativo (parar ao sair da tela). Post com `origem='ia'`: selo "✨ Escrito para você".
- `servicosSemFoto` e `fotoDoPost` (app) passam a ignorar fotos com `serve === false` (o ctx carrega `fotosInfo` de `fotos_ia` do cliente). Ao apagar fotos do Storage (`salvarItens`), apagar também as linhas de `fotos_ia` desses paths (spec §7.11).
- `faixaDeFotos`: foto com `serve === false` mostra o aviso "Esta foto ficou {motivo}; se puder, envie outra." (texto curto).

- [ ] Step 1: Testes das funções puras (`progressoIA`, `fotosQueServem`, `servicosSemFoto` com foto reprovada).
- [ ] Step 2: FALHA. Step 3: Implementar. Step 4: PASSA + build. Step 5: Commit.

### Task 7: "Gerar outro" e "Trocar imagem" com IA

**Files:**
- Modify: `supabase/functions/trocar-post/acoes.ts` (+ index): depois de `gerarTroca`, tenta `escreverPost` (timeout 20 s, foto do lugar) e, se der, grava o texto da IA com `origem:'ia', ia_estado:'pronto'`; se não, o modelo como hoje (`origem:'modelo', ia_estado:'pulado'`).
- Create: `supabase/functions/reescrever-post/acoes.ts`, `supabase/functions/reescrever-post/index.ts`: POST `{ post_id }` do dono; reescreve a legenda para a foto atual do post (20 s); devolve `{ post }` ou `{ post: null }` (sem mudança) — nunca erro por causa da IA.
- Modify: `app/src/cliente/trocarFoto.js` (depois de gravar a foto: "Escrevendo…" e chama `reescrever-post`; aplica o post devolvido), `app/src/cliente/acoesPost.js` (estado "Escrevendo…" no Gerar outro), `app/src/textos.js`, `supabase/config.toml`
- Test: `tests/unit/trocar-post.test.ts`, `tests/unit/reescrever-post.test.ts`, `tests/unit/trocarFoto.test.js`

- [ ] Step 1: Testes: troca com IA ok grava texto da IA e conta a troca; IA falha → modelo (como hoje); reescrever de post alheio → 404; IA falha → `{ post: null }` 200; app aplica o post devolvido.
- [ ] Step 2: FALHA. Step 3: Implementar. Step 4: PASSA. Step 5: Commit.

### Task 8: Minhas fotos (Meu negócio)

**Files:**
- Modify: `app/src/cliente/meuNegocio.js`, `app/src/cliente/perguntas.js` (pergunta `'fotos'` com a `faixaDeFotos` e limite 30), `app/src/cliente/negocio.js` (`carregarNegocio` lê `fotos`; `salvarFotosDoNegocio(supabase, uid, fotos, aoProgredir)` envia para `{uid}/negocio/{uuid}.jpg`, desfaz envios em caso de erro, apaga do Storage as removidas e chama `descrever-fotos`), `app/src/textos.js`
- Test: `tests/unit/negocio.test.js`, `tests/unit/meuNegocio.test.js`

- [ ] Step 1: Testes: `salvarFotosDoNegocio` grava os caminhos e remove os tirados; linha "Minhas fotos" no resumo mostra "N fotos"; limite 30.
- [ ] Step 2: FALHA. Step 3: Implementar. Step 4: PASSA + build. Step 5: Commit.

### Task 9: Banco de imagens no painel da administradora

**Files:**
- Create: `app/src/admin/banco.js`
- Modify: `app/src/admin/telas.js` (botão/área "Banco de imagens"), `app/src/admin/dados.js`, `app/src/textos.js`, `app/src/estilo.css`
- Test: `tests/unit/admin-banco.test.js`

**Interfaces:**
- Tela: escolher o ramo (`listaRamos`), subir várias fotos (reduzidas como as do cliente, para `banco/{ramo}/{uuid}.jpg`), chamar `descrever-fotos` com `{ paths, ramo }`, grade com miniatura, descrição e selo "serve / não serve", botão remover (apaga do bucket e de `fotos_ia`), aviso fixo "Use só fotos suas ou com licença que permita uso nos posts de vários clientes."
- Pura testável: `resumoDoBanco(fotos) → { total, servem }`.

- [ ] Step 1: Teste da função pura. Step 2: Implementar. Step 3: PASSA + build. Step 4: Commit.

### Task 10: Guia de configuração

**Files:**
- Create: `docs/como-configurar-a-ia.md` — passo a passo em português simples para criar a chave da Anthropic (console, crédito, chave), a do Pexels e a do Pixabay, e como colocá-las nos segredos do Supabase (`npx supabase secrets set ...`), mais como ver o uso em `uso_ia`.

- [ ] Step 1: Escrever o guia. Step 2: Commit.
