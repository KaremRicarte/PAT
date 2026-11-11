# PAT v2 · Etapa 3 — Calendário, artes, aprovação, vídeo e lembretes — Plano de implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** a lista do mês vira um calendário com a arte de cada post, aprovação/reprovação, troca de imagem, edição do vídeo enviado, "✓ Postei" e lembretes por notificação.

**Architecture:** as artes e os vídeos são desenhados no aparelho (canvas + MediaRecorder), com o código do `bancada/index.html` reescrito em módulos pequenos sob `app/src/artes/`. O banco só guarda as escolhas (situação, foto, postado). Duas funções novas no Supabase: `trocar-post` (gerar outro com os modelos prontos) e `lembrete` (web push, chamada pelo `pg_cron`).

**Tech Stack:** Vite + JS puro no app; Supabase (Postgres, RLS, Storage, Edge Functions em Deno, pg_cron + pg_net); Vitest; web push com chaves VAPID.

**Spec:** `docs/superpowers/specs/2026-11-11-pat-v2-etapa3-calendario-artes-design.md`

## Global Constraints

- Branch novo `v2-etapa3`, criado a partir de `v2-etapa2`. **Commit só com a autorização da Karem** (pedir antes do primeiro commit da sessão; push sempre com autorização e com `git -c http.sslBackend=schannel push`).
- Nesta máquina não há Python nem `gh`: scripts em Node ou PowerShell.
- O CLI do Supabase v3 exige `--remote --yes` (ex.: `npx supabase db push --remote --yes`). As funções `trocar-post`, `lembrete` e `lembrete-teste` são publicadas com `--no-verify-jwt`; cada uma confere o token ou o segredo por conta própria, como a `gerar-mes`.
- Os dados do usuário entram na tela sempre como texto (`el(..., { texto })`), nunca como HTML.
- Todos os textos de interface ficam em `app/src/textos.js` (chaves planas, `{var}`), em português; o espanhol é da Etapa 5.
- Usabilidade (spec §3.0):
  - toque mínimo de 48 px;
  - ícone sempre com texto ou número;
  - aviso no rodapé por 3 s depois de cada ação;
  - Desfazer no descarte e no "Postei";
  - cartão de 3 dicas na primeira visita (chave `pat-dicas-vistas` no `localStorage`, com try/catch).
- Medidas das artes:
  - feed: 1080×1350;
  - Stories e Status: 1080×1920;
  - vídeo: 720×1280.
- Vídeo enviado: até 60 s, sem música, o original não sobe.
- Limite de trocas: 10 por mês (soma de `posts.trocas` do mês).
- Lembretes:
  - 11:00 UTC (8h em São Paulo) e 23:00 UTC (20h);
  - textos exatos do spec §3.5.
- Cores das bolinhas, por prioridade:
  1. azul (`postado`): todos os não descartados foram postados;
  2. amarela (`pendente`): tem pendente;
  3. vermelha (`reprovado`): tem reprovado;
  4. verde (`aprovado`): os outros casos.

  Os descartados não contam. Um dia só com descartados é vermelho.

## Review Focus

1. **Mês com poucos dias de post e mês futuro** (gerado no dia 21+): o calendário deve abrir no primeiro dia com post, não num dia vazio. Teste em `diaInicial` (Task 3).
2. **Cliente que só tem 1 produto pede "Gerar outro"**: o post novo não pode sair idêntico ao anterior. Teste em `gerarTroca` (Task 2).
3. **Foto enviada em HEIC/arquivo que o navegador não abre ou vídeo sem duração legível (`NaN`/`Infinity`)**: a mensagem certa aparece, sem travar a tela. Teste em `validarDuracao` (Task 5); o HEIC é tratado pelo `reduzirFoto` já existente (rejeita → mensagem).
4. **Dois toques rápidos em "Aprovar"/"Postei" ou falha de rede no meio**: o ícone volta ao estado do banco e não fica "meio aprovado". Teste em `proximoEstado` + reversão (Task 7).
5. **Lembrete para cliente bloqueado, com inscrição velha (410) ou sem post no dia**: não envia e apaga a inscrição morta. Testes em `quemAvisar` (Task 9) e na integração.

---

### Task 1: Banco — situação, foto, postado e inscrições de push

**Files:**
- Create: `supabase/migrations/20261112000001_etapa3_posts.sql`
- Test: `tests/int/posts-cliente.test.js`
- Modify: `tests/int/ajuda.js` (ajudante `novoMes`)

**Interfaces:**
- Produces:
  - colunas `posts.foto_path text`, `posts.sem_foto boolean not null default false` e `posts.postado_em timestamptz`;
  - o `estado` passa a aceitar `'reprovado'`;
  - tabela `push_inscricoes(id uuid pk default gen_random_uuid(), cliente_id uuid not null references clientes on delete cascade, endpoint text unique not null, p256dh text not null, auth text not null, criado_em timestamptz default now())`;
  - ajudante `novoMes(cliente): Promise<{ mesId, posts: {id}[] }>`, que gera pela função `gerar-mes` (como no `gerar-mes.test.js`).

- [ ] **Step 1: Branch.** `git switch -c v2-etapa3 v2-etapa2` (no repo `PAT/`).
- [ ] **Step 2: Testes de integração que falham** em `tests/int/posts-cliente.test.js`:
  - `'cliente aprova, reprova e marca foto dos próprios posts'`: o update `{estado:'aprovado'}`, depois `{estado:'reprovado'}` e depois `{foto_path:`${id}/posts/x.jpg`, sem_foto:false}` dá certo, e o select relê os valores.
  - `'postado_em é sempre a hora do servidor'`: o update `{postado_em:'2000-01-01T00:00:00Z'}` é gravado com ano ≥ 2026; `{postado_em:null}` volta a `null`.
  - `'cliente não altera legenda, não grava editado e não usa foto de outra pasta'`: `{legenda:'x'}` dá erro (permissão de coluna); `{estado:'editado'}` dá erro; `{foto_path:'outro-uid/posts/x.jpg'}` dá erro.
  - `'cliente não altera post de outro e bloqueado não altera nada'`: o update do cliente B no post de A afeta 0 linhas; depois de `situacao='bloqueado'` (chave de serviço), o update do próprio A afeta 0 linhas.
  - `'push_inscricoes: cada um vê e apaga só as suas'`: A insere; B faz select e vê 0; B faz delete e afeta 0; A apaga.
- [ ] **Step 3: Rodar** `npm run test:int -- posts-cliente` → FAIL (colunas inexistentes).
- [ ] **Step 4: Migração.**
  - Trocar o check de `estado` para `('gerado','aprovado','editado','reprovado')`.
  - Adicionar as 3 colunas.
  - `grant update (estado, foto_path, sem_foto, postado_em) on public.posts to authenticated`.
  - Política `posts_alterar` for update: `using/with check (cliente_ativo() and exists (select 1 from meses m where m.id = mes_id and m.cliente_id = auth.uid()))`.
  - Gatilho `before update` `posts_cliente_regras()` (security invoker), que só age quando `auth.role() = 'authenticated'`:
    - erro se o `new.estado` não estiver em `('gerado','aprovado','reprovado')` e tiver mudado;
    - erro se o `new.foto_path` não for null e não começar com `auth.uid()::text || '/'`;
    - `new.postado_em := case when new.postado_em is null then null when old.postado_em is not null then old.postado_em else now() end`.
  - `push_inscricoes`:
    - RLS ligada;
    - `grant select, insert, delete` para authenticated;
    - políticas: ler (`cliente_id = auth.uid() or is_admin()`), inserir (`cliente_id = auth.uid() and cliente_ativo()`), apagar (`cliente_id = auth.uid()`).
  - `create extension if not exists pg_cron; create extension if not exists pg_net;`
- [ ] **Step 5: Aplicar** `npx supabase db push --remote --yes` e rodar `npm run test:int -- posts-cliente` → PASS; `npm run test:int` → tudo verde.
- [ ] **Step 6: Commit** `feat: banco da etapa 3 (situação, foto, postado, push)`.

### Task 2: "Gerar outro" — `gerarTroca` e função `trocar-post`

**Files:**
- Modify: `supabase/functions/_shared/modelos/gerar.ts` (opção `deslocamento` em `Pacote`)
- Create: `supabase/functions/_shared/modelos/troca.ts`, `supabase/functions/trocar-post/acoes.ts`, `supabase/functions/trocar-post/index.ts`
- Test: `tests/unit/troca.test.ts`, `tests/int/trocar-post.test.js`

**Interfaces:**
- Consumes: `gerarMes(p: Pacote)`, `PostGerado`, `RAMOS`, `validarPost` (Etapa 2).
- Produces:
  - `Pacote.deslocamento?: number`: gira a lista de produtos e as listas de temas (`aproxFeed`, `aproxStories`, `aproxGravar`, `ENGAJA_CTA`) em `n` posições antes de montar;
  - `gerarTroca(p: Pacote, alvo: { data: string, rede: string, tipo: string, ordem: number }, n: number): PostGerado` em `troca.ts`;
  - `trocarPostDoCliente(entrada: unknown, deps: DepsTroca): Promise<Resposta>` em `trocar-post/acoes.ts`;
  - a função HTTP `trocar-post`, que recebe `{ post_id }` e responde:
    - 200 `{ post }`;
    - 401, 403;
    - 404 `{erro:'Post não encontrado.'}`;
    - 429 `{erro:'Você já usou as 10 trocas deste mês.'}`.
  - `DepsTroca`:
    - `{ cliente(), post(id) → {id, mes_id, data, rede, tipo, formato, horario, ordem, trocas, cliente_id, ano_mes, estrategia} | null, trocasDoMes(mesId) → number, negocio(), produtos(), gravar(id, campos) }`;
    - os campos gravados são `titulo, legenda, hashtags, roteiro, pilar, produto_id`, mais `estado:'gerado'`, `foto_path:null`, `sem_foto:false` e `trocas: post.trocas+1`.

- [ ] **Step 1: Testes de unidade que falham** (`tests/unit/troca.test.ts`), usando um pacote `ferramentas` com 2 produtos e outro com 1 produto:
  - `'mesma data, rede, tipo, formato e horário do post original'` para um `feed`, um `stories`, um `video/gravar` e um `status`;
  - `'n=1 muda a legenda'` (2 produtos);
  - `'com 1 produto, n=1 ainda muda a legenda'` (temas giram);
  - `'n=1 e n=2 diferentes entre si'`;
  - `'advocacia: troca nunca tem preço nem promoção'` (`validarPost(x, RAMOS.advocacia)` vazio para n de 1 a 5);
  - `'deslocamento 0 = gerarMes de hoje'`: igualdade com a saída atual, o que protege a Etapa 2.
- [ ] **Step 2: Rodar** `npx vitest run tests/unit/troca.test.ts` → FAIL.
- [ ] **Step 3: Implementar.**
  - `deslocamento` em `gerarMes`: girar com `girar(lista, n) = [...lista.slice(n % len), ...lista.slice(0, n % len)]`.
  - `gerarTroca`: chama `gerarMes({ ...p, deslocamento: n })` e escolhe o post com a mesma `data/rede/tipo`, o mais próximo de `alvo.ordem`. Devolve com o `formato` e o `horario` do original (o formato de `feed` pode mudar entre arte e carrossel: forçar o do original).
  - Se a legenda sair igual à atual, tentar `n+1` até `n+5`.
- [ ] **Step 4: Rodar** → PASS; `npx vitest run` → todos verdes.
- [ ] **Step 5: `trocarPostDoCliente`** com as mesmas regras de acesso da `gerar-mes`:
  - 403 se não ativo ou com senha provisória;
  - 404 se o post não é dele;
  - 429 se `trocasDoMes ≥ 10`.

  Ela monta o `Pacote` com `estrategia` e `anoMes` do mês do post e `n = post.trocas + 1`. O `index.ts` segue o modelo de `gerar-mes/index.ts` (CORS, token, chave de serviço).
- [ ] **Step 6: Integração** (`tests/int/trocar-post.test.js`):
  - `'troca muda o texto, mantém a data e soma 1'`;
  - `'post de outro cliente → 404'`;
  - `'bloqueado → 403'`;
  - `'11ª troca → 429'` (colocar `trocas=10` num post pela chave de serviço).
- [ ] **Step 7: Publicar** `npx supabase functions deploy trocar-post --no-verify-jwt` e rodar `npm run test:int -- trocar-post` → PASS.
- [ ] **Step 8: Commit** `feat: gerar outro post (trocar-post)`.

### Task 3: Regras puras do calendário e do post

**Files:**
- Create: `app/src/cliente/situacao.js`
- Test: `tests/unit/situacao.test.js`

**Interfaces:**
- Produces:
  - `situacaoDoPost(post): 'postado'|'aprovado'|'pendente'|'reprovado'`:
    - `postado_em` preenchido → `'postado'`;
    - `estado='reprovado'` → `'reprovado'`. Na tela ele aparece como "Descartado": o "gerar outro" volta o post para `gerado`, então o único reprovado que fica é o descartado;
    - `aprovado` → `'aprovado'`;
    - `gerado`/`editado` → `'pendente'`.
  - `corDoDia(posts): 'postado'|'pendente'|'reprovado'|'aprovado'|null` (null = dia sem post).
  - `resumoDoMes(posts): { postado, aprovado, pendente, reprovado }`.
  - `diaInicial(anoMes, hoje, posts): 'AAAA-MM-DD'`.
  - `gradeDoMes(anoMes): (string|null)[]`: `null` nos dias antes do dia 1 (a semana começa no domingo); o tamanho é múltiplo de 7.
  - `fotoDoPost(post, produtos, ramo): string|null`:
    - `sem_foto` e `ramo.textOnly` → null;
    - senão, o `foto_path`;
    - senão, a foto do produto `produto_id`;
    - senão, a primeira foto de produto (exceto nos ramos `textOnly`).
  - `pecasDaArte(post, negocio, ramo): { rotulo, titulo, gancho, meio, convite, assinatura: { texto: string|null, logo: boolean } }`:
    - os parágrafos da legenda dão `gancho` (1º), `meio` (2º) e `convite` (penúltimo, ou o último se só houver 3);
    - `rotulo` = nome do negócio em maiúsculas;
    - `assinatura` segue `negocio.assinatura` (`logo`/`insta`/`ambos`), e sem `insta` o texto fica null.
  - `proximoEstado(post, acao: 'aprovar'|'desaprovar'|'descartar'|'desfazer'|'postei'|'despostar'): Partial<post>`:
    - aprovar → `{estado:'aprovado'}`;
    - desaprovar e desfazer → `{estado:'gerado'}`;
    - descartar → `{estado:'reprovado'}`;
    - postei → `{estado:'aprovado', postado_em: 'agora'}`;
    - despostar → `{postado_em:null}`.

    O `'agora'` vira `new Date().toISOString()` na chamada; o servidor troca pela hora dele.
- [ ] **Step 1: Testes que falham**, um `test` por regra acima, com valores concretos:
  - `corDoDia`:
    - `[postado, postado]` → postado;
    - `[postado, reprovado]` → postado (o reprovado não conta);
    - `[aprovado, pendente, reprovado]` → pendente;
    - `[aprovado, reprovado]` → reprovado;
    - `[reprovado]` → reprovado;
    - `[aprovado]` → aprovado;
    - `[]` → null.
  - `diaInicial('2026-11', '2026-11-11', posts)` → `'2026-11-11'`; `diaInicial('2026-12', '2026-11-25', posts com o 1º post em 01/12)` → `'2026-12-01'`; hoje no mês, mas sem post → hoje.
  - `gradeDoMes('2026-11')`: começa com `'2026-11-01'` (domingo) e tem 35 itens; `gradeDoMes('2026-12')`: 2 nulls e `'2026-12-01'`.
  - `pecasDaArte` com uma legenda de 5 parágrafos e com outra de 2.
  - Os 6 casos de `proximoEstado`.
- [ ] **Step 2: Rodar** `npx vitest run tests/unit/situacao.test.js` → FAIL.
- [ ] **Step 3: Implementar** em `situacao.js` (sem DOM).
- [ ] **Step 4: Rodar** → PASS.
- [ ] **Step 5: Commit** `feat: regras do calendário e do post`.

### Task 4: Artes no aparelho

**Files:**
- Create: `app/src/artes/looks.js`, `app/src/artes/texto.js`, `app/src/artes/desenho.js`, `app/src/artes/imagens.js`
- Modify: `app/index.html` (fontes dos estilos)
- Test: `tests/unit/artes.test.js`

**Interfaces:**
- Consumes: `pecasDaArte`, `fotoDoPost` (Task 3).
- Produces:
  - `lookDoRamo(ramoId): { fd, fb, dw, hs, center?, box? }`, com o mapa `beleza→elegante`, `psicologia→sereno`, `advocacia→sobrio` e os outros ramos em `varejo`. Os valores das fontes são os da tabela `LOOKS` do `bancada/index.html:1552-1557`.
  - `corTexto(hex): '#111111'|'#FFFFFF'` (contraste, a partir do `lum`/`ink` do v1).
  - `quebrarLinhas(texto, larguraMax, medir: (s) => number): string[]`.
  - `medidaDaArte(post): { W, H, paginas }`:
    - feed com `arte` → 1080×1350 e 1 página;
    - feed com `carrossel` → 1080×1350 e 5 páginas;
    - `stories`/`status` → 1080×1920 e 1 página;
    - `video` → 720×1280 e 1 página (a capa);
    - `lista` → null.
  - `desenharArte(ctx, { pecas, look, cores: {cor1, cor2}, foto: ImageBitmap|null, logo: ImageBitmap|null, W, H, pagina })`: uma função com a mesma composição do v1:
    - arte única: `drawSingle`;
    - página do carrossel: `drawSlide`, com as páginas 1 a 5 = capa, gancho, meio com foto, convite na cor principal e fecho;
    - Stories/Status: o ramo `vert` do `drawSingle`, sem a enquete;
    - inclui a faixa do estilo (`band`), `softDeco` e a assinatura (`wmk`);
    - sem caixa de preço (as ofertas já estão no título e na legenda).
  - `carregarImagem(supabase, path): Promise<ImageBitmap|null>`: usa a URL assinada de 1 h, guarda em cache por `path` e devolve null se falhar.
  - `gerarImagens(supabase, post, ctxDados): Promise<Blob[]>`: PNG de cada página, para "Baixar imagem". O `ctxDados` é `{ negocio, produtos, ramo }`.
  - `miniatura(supabase, post, ctxDados, largura=240): Promise<HTMLCanvasElement|null>`: a página 1, reduzida.
- [ ] **Step 1: Testes que falham** (`tests/unit/artes.test.js`, sem canvas):
  - `quebrarLinhas('Furadeira de impacto profissional', 10, s => s.length)` → `['Furadeira', 'de impacto', 'profissional']`;
  - uma palavra maior que a largura fica sozinha numa linha;
  - `lookDoRamo('advocacia').fd` contém `Playfair Display`; `lookDoRamo('turismo')` é igual a `varejo`;
  - `corTexto('#CEFB14') === '#111111'` e `corTexto('#151925') === '#FFFFFF'`;
  - `medidaDaArte` para os 5 tipos.
- [ ] **Step 2: Rodar** → FAIL. **Step 3: Implementar.** Reescrever as funções do v1 (`hl`, `plain`, `label`, `capBox`, `cover`, `shade`, `band`, `softDeco`, `wmk`, `rr`) em `desenho.js` com nomes em português e parâmetros explícitos, sem as variáveis globais `S`, `N()`, `B()`, `FD` e `DW`. No `index.html`, carregar as fontes Cormorant Garamond, Montserrat, Fraunces, DM Sans, Playfair Display e Source Sans 3 (Google Fonts, `display=swap`). Antes de desenhar, aguardar `document.fonts.load` da fonte do estilo.
- [ ] **Step 4: Rodar** `npx vitest run` → PASS. Conferência visual: `npm run dev`, abrir uma página de teste temporária `app/teste-artes.html` (fora do build; apagar no fim da Task 6) que desenha as 4 formas de arte de cada estilo com cores fixas. Conferir que o texto não vaza da arte.
- [ ] **Step 5: Commit** `feat: artes desenhadas no aparelho`.

### Task 5: Vídeos — montagem com fotos e edição do vídeo enviado

**Files:**
- Create: `app/src/artes/video.js`
- Test: `tests/unit/video.test.js`

**Interfaces:**
- Consumes: `desenharArte`, `lookDoRamo`, `quebrarLinhas` (Task 4).
- Produces:
  - `escolherFormato(suporta: (mime) => boolean): { mime, ext: 'mp4'|'webm' } | null`, que tenta na ordem do v1 (`bancada/index.html:1936`).
  - `validarDuracao(segundos): 'ok'|'longo'|'invalido'` (>60 → longo; `NaN`, `Infinity` ou ≤0 → invalido).
  - `planoDoVideo(duracao): { total, tituloAte: 3, fimDe: duracao, fimAte: duracao + 2 }`.
  - `podeEditarVideo(): boolean` (`MediaRecorder` + `HTMLCanvasElement.prototype.captureStream`).
  - `montarVideoDeFotos({ pecas, look, cores, fotos: ImageBitmap[], logo }, aoProgredir): Promise<{ blob, ext }>`: os 12 s do `drawReel`/`recordReel` do v1, a 720×1280.
  - `editarVideo(arquivo: File, { pecas, look, cores, logo, assinatura }, aoProgredir, audioExtra?: MediaStreamTrack): Promise<{ blob, ext }>`. Ela:
    - toca o vídeo num `<video muted playsInline>`;
    - desenha cada quadro no canvas com `cover`;
    - mostra o título nos primeiros 3 s;
    - mantém a assinatura no canto o tempo todo;
    - termina com 2 s de tela final (convite e assinatura).

    O stream gravado = `canvas.captureStream(30)` + a faixa de áudio do vídeo (`video.captureStream?.() ?? video.mozCaptureStream?.()`), ou o `audioExtra` quando vier (reservado para a narração da Etapa 4). Os 5 Mbps são os mesmos do v1.
- [ ] **Step 1: Testes que falham:**
  - `escolherFormato(m => m === 'video/webm')` → `{ mime: 'video/webm', ext: 'webm' }`;
  - `escolherFormato(m => m.startsWith('video/mp4'))` → ext mp4;
  - `escolherFormato(() => false)` → null;
  - `validarDuracao(59.9)` = ok, `(60.5)` = longo, `(NaN)`, `(Infinity)` e `(0)` = invalido;
  - `planoDoVideo(10)` → `{ total: 12, tituloAte: 3, fimDe: 10, fimAte: 12 }`.
- [ ] **Step 2: Rodar** → FAIL. **Step 3: Implementar.** **Step 4: Rodar** → PASS; conferência manual na página de teste da Task 4: montar um vídeo com 2 fotos e editar um vídeo curto do computador.
- [ ] **Step 5: Commit** `feat: montagem e edição de vídeo no aparelho`.

### Task 6: Tela do calendário

**Files:**
- Create: `app/src/cliente/calendario.js`
- Modify:
  - `app/src/cliente/mes.js`: remover `telaMes`, `cartaoPost` e `agruparPorDia`; manter o quiz do mês e a geração;
  - `app/src/cliente/telas.js`: `'mes'` → `telaCalendario`;
  - `app/src/comum.js`: `aviso(texto, { desfazer? })`;
  - `app/src/textos.js`;
  - `app/src/estilo.css`;
  - `tests/unit/mes.test.js`: tirar o teste de `agruparPorDia`.
- Test: `tests/unit/calendario.test.js`

**Interfaces:**
- Consumes: as funções da Task 3, `miniatura` (Task 4) e `escolherMes` (mês preferido, do `mes.js`).
- Produces:
  - `telaCalendario(ctx, editarNegocio, diaEscolhido?)`;
  - `rotuloDoDia(data, posts): string` (ex.: `'4 de novembro, 2 pendentes'`, `'4 de novembro, tudo postado'`);
  - `aviso(texto, opcoes)` em `comum.js`: um elemento `role="status"` fixo no rodapé, que some em 3 s (6 s quando tem Desfazer).

  O `ctx` ganha `posts` (carregados uma vez por mês mostrado) e `ramo`. A rota lê `?dia=AAAA-MM-DD` da URL, que vem da notificação.
- [ ] **Step 1: Testes que falham:**
  - `rotuloDoDia` com: só pendentes; misto; tudo postado; 1 post (singular: "1 pendente").
- [ ] **Step 2: Rodar** → FAIL. **Step 3: Implementar a tela** conforme o spec §3.1:
  - topo como hoje;
  - o sino de lembretes é um espaço vazio, preenchido na Task 10;
  - resumo com os 4 números;
  - grade de botões de dia (`aria-label` = `rotuloDoDia`, `aria-pressed` no escolhido) com a bolinha da `corDoDia`; hoje com contorno;
  - lista do dia com cartões (miniatura carregada depois, com fundo `cor2` enquanto isso);
  - "✓ Postei" no cartão aprovado e não postado (chama a mesma ação da Task 7);
  - cartão de dicas na primeira visita.

  Ao tocar num dia, só a lista e o destaque são redesenhados; os posts não são recarregados.
- [ ] **Step 4: Rodar** `npx vitest run` → PASS; `npm run build` sem erro; ver no `npm run dev` com um cliente do pat-dev. Apagar `app/teste-artes.html`.
- [ ] **Step 5: Commit** `feat: calendário do mês`.

### Task 7: Tela do post — aprovar, reprovar, Postei, copiar e baixar

**Files:**
- Create: `app/src/cliente/post.js`, `app/src/cliente/acoesPost.js`
- Modify: `app/src/textos.js`, `app/src/estilo.css`
- Test: `tests/unit/acoesPost.test.js`

**Interfaces:**
- Consumes: `proximoEstado`, `situacaoDoPost` (Task 3); `gerarImagens`, `desenharArte`, `medidaDaArte` (Task 4); a função `trocar-post` (Task 2); `aviso` (Task 6).
- Produces:
  - `telaPost(ctx, post, aoVoltar)`.
  - `aplicarAcao({ supabase, post, acao, aoMudar }): Promise<boolean>`:
    - otimista: aplica `proximoEstado` no objeto local, chama `aoMudar`, faz `update(...).eq('id', post.id).select().single()`;
    - em caso de erro, restaura o estado anterior, chama `aoMudar` de novo, mostra `aviso(t('erro.conexao'))` e devolve false;
    - enquanto uma ação do mesmo post está em andamento, outra chamada é ignorada (devolve false).
  - `gerarOutro({ supabase, post }): Promise<{ post } | { erro }>`, que chama `supabase.functions.invoke('trocar-post', { body: { post_id } })` e lê a mensagem do 429.
  - `nomeDoArquivo(post, pagina?, ext): string` (ex.: `2026-11-04_instagram_carrossel_2.png`).
- [ ] **Step 1: Testes que falham** com um `supabase` falso (objeto com `from().update().eq().select().single()` resolvendo `{ error }`):
  - `'falha restaura o estado e devolve false'`;
  - `'segunda chamada durante a primeira é ignorada'`;
  - `'sucesso usa o que o banco devolveu'` (por exemplo, o `postado_em` do servidor);
  - `nomeDoArquivo` com e sem página.
- [ ] **Step 2: Rodar** → FAIL. **Step 3: Implementar a tela** (spec §3.2):
  - Voltar;
  - arte grande (carrossel com `scroll-snap` e "1/5");
  - legenda, hashtags e roteiro;
  - botões principais: Aprovar/Aprovado, ✓ Postei, Copiar legenda, Baixar imagem;
  - "Mais opções" (`<details>`): Trocar imagem (Task 8), Enviar meu vídeo (Task 8), Reprovar.

  Reprovar abre um diálogo (`<dialog>`) com "Gerar outro" (desativado, com a mensagem, se o limite já foi atingido) e "Só descartar". Cada ação mostra um aviso, e Descartar e Postei vêm com Desfazer. Baixar imagem usa `<a download>` com o blob; no carrossel, um arquivo por página. Na montagem (`video/montagem`), "Baixar vídeo" gera com `montarVideoDeFotos`, mostrando o progresso.
- [ ] **Step 4: Rodar** `npx vitest run` → PASS; `npm run build`; testar no `npm run dev`: aprovar, reprovar → gerar outro, descartar → desfazer, postei → desfazer, baixar.
- [ ] **Step 5: Commit** `feat: tela do post com aprovação e Postei`.

### Task 8: Trocar imagem e enviar vídeo

**Files:**
- Create: `app/src/cliente/trocarFoto.js`
- Modify: `app/src/cliente/post.js`, `app/src/textos.js`, `app/src/estilo.css`
- Test: `tests/unit/trocarFoto.test.js`

**Interfaces:**
- Consumes: `reduzirFoto`, `FOTO_MAX` (`negocio.js`); `editarVideo`, `validarDuracao`, `podeEditarVideo` (Task 5); `aviso` (Task 6). A gravação de `{ foto_path, sem_foto }` segue o mesmo padrão do `aplicarAcao` (Task 7): aplica no aparelho, grava e, se falhar, volta ao valor anterior com `aviso(t('erro.conexao'))`.
- Produces:
  - `abrirTrocaDeFoto({ supabase, post, produtos, ramo, aoEscolher })`: um `<dialog>` com a grade das fotos, "Enviar outra foto" e "Sem foto" (só `textOnly`);
  - `caminhoDaFotoDoPost(uid, postId): string` = `${uid}/posts/${postId}.jpg`;
  - `opcoesDeFoto(produtos, ramo, post): { path, atual: boolean }[] + semFoto: boolean`.
- [ ] **Step 1: Testes que falham:**
  - `caminhoDaFotoDoPost`;
  - `opcoesDeFoto` marca como atual a foto do produto quando o `foto_path` é null;
  - produtos sem foto ficam fora;
  - `semFoto` só em advocacia e psicologia.
- [ ] **Step 2: Rodar** → FAIL. **Step 3: Implementar.**
  - Foto nova: `reduzirFoto(arquivo, FOTO_MAX, 'image/jpeg')` → `storage.from('marcas').upload(caminho, blob, { upsert: true, contentType: 'image/jpeg' })` → update `{ foto_path, sem_foto:false }`.
  - Se o `reduzirFoto` falhar: `aviso(t('foto.naoabriu'))`.
  - Depois, limpar o cache do `carregarImagem` para esse path e redesenhar a arte.
  - Enviar meu vídeo (só `gravar`):
    - sem `podeEditarVideo()` → mensagem do spec §5;
    - `<input type=file accept="video/*">` → ler a duração por `loadedmetadata` → `validarDuracao`;
    - durante a edição, a barra "Editando seu vídeo… N%";
    - depois, a prévia `<video controls>` com "Baixar vídeo" e "Escolher outro".
- [ ] **Step 4: Rodar** → PASS; testar no `npm run dev`: trocar por foto existente, por foto nova, "Sem foto" num cliente de advocacia, vídeo de 10 s e vídeo de 70 s.
- [ ] **Step 5: Commit** `feat: trocar imagem e editar vídeo enviado`.

### Task 9: Lembretes — servidor

**Files:**
- Create:
  - `supabase/functions/_shared/lembrete.ts` (regras puras);
  - `supabase/functions/lembrete/index.ts`;
  - `supabase/functions/lembrete-teste/index.ts`;
  - `supabase/functions/_shared/push.ts` (envio);
  - `supabase/migrations/20261112000002_agenda_lembretes.sql`.
- Test: `tests/unit/lembrete.test.ts`, `tests/int/lembrete.test.js`

**Interfaces:**
- Produces:
  - `quemAvisar(turno: 'manha'|'noite', linhas: { cliente_id, situacao, rede, estado, postado_em }[]): Map<string, { total: number, redes: string[] }>`:
    - só clientes ativos;
    - os posts reprovados não contam;
    - à noite, só os sem `postado_em`;
    - o `total` conta os posts que valem, e as `redes` saem sem repetição, na ordem instagram, facebook, tiktok, whatsapp.
  - `textoDoLembrete(turno, { total, redes }): { titulo: 'PAT', corpo }`. O corpo é o texto do spec §3.5:
    - `post`/`posts` conforme o total;
    - as redes por extenso, unidas por ", " e " e " (o WhatsApp vira "Status do WhatsApp").
  - `enviarPush(inscricao, payload): Promise<'ok'|'expirada'|'erro'>` em `push.ts`, com `npm:web-push@3.6.7` (`setVapidDetails('mailto:` + e-mail da admin lido do segredo `VAPID_CONTATO`, a pública e a privada)). Respostas 404/410 → `'expirada'`.
  - Função `lembrete`:
    - exige o cabeçalho `x-lembrete-secret` igual ao `LEMBRETE_SECRET` (senão 401);
    - corpo `{ turno }`;
    - lê os posts de hoje (`hojeEmSaoPaulo()`) com os clientes e as inscrições pela chave de serviço;
    - envia e apaga as inscrições expiradas;
    - responde `{ enviados, expiradas }`.
  - Função `lembrete-teste`: exige o token do cliente e envia "Lembretes ativados ✓ Você vai receber um aviso às 8h nos dias com post." só para as inscrições dele.
  - O `payload` da notificação é `{ titulo, corpo, url: '/?dia=AAAA-MM-DD' }`.
- [ ] **Step 1: Testes de unidade que falham:**
  - `quemAvisar('manha')` ignora o bloqueado e o reprovado;
  - `quemAvisar('noite')` ignora quem postou tudo;
  - `textoDoLembrete('manha', { total: 2, redes: ['instagram','whatsapp'] }).corpo === 'Bom dia! Hoje você tem 2 posts: Instagram e Status do WhatsApp 📲'`;
  - `textoDoLembrete('noite', { total: 1, ... }).corpo === 'Ainda falta postar 1 post de hoje. Leva 1 minutinho 😉'`.
- [ ] **Step 2: Rodar** → FAIL. **Step 3: Implementar** as regras e as funções.
- [ ] **Step 4: Chaves.**
  - Gerar o par VAPID com `npx web-push generate-vapid-keys`.
  - `npx supabase secrets set VAPID_PUBLICA=... VAPID_PRIVADA=... VAPID_CONTATO=... LEMBRETE_SECRET=<aleatório>`.
  - Guardar a pública e o `LEMBRETE_SECRET` em `PAT/.env.local` (`VITE_VAPID_PUBLIC_KEY`, `LEMBRETE_SECRET`), fora do git.
- [ ] **Step 5: Agendamento** (`20261112000002_agenda_lembretes.sql`):
  - guardar `LEMBRETE_SECRET` e a URL da função no Vault (`vault.create_secret`); o valor real é inserido à mão pelo SQL editor ou pela Management API, e **não** vai no arquivo da migração;
  - `cron.schedule('lembrete-manha', '0 11 * * *', $$ select net.http_post(url := (select decrypted_secret from vault.decrypted_secrets where name='lembrete_url'), headers := jsonb_build_object('Content-Type','application/json','x-lembrete-secret',(select decrypted_secret from vault.decrypted_secrets where name='lembrete_secret')), body := '{"turno":"manha"}'::jsonb) $$)`;
  - a mesma chamada para `'lembrete-noite'` com `'0 23 * * *'` e `"noite"`.
- [ ] **Step 6: Integração** (`tests/int/lembrete.test.js`):
  - `'sem segredo → 401'`;
  - `'com segredo → 200 e apaga inscrição falsa'`: inserir uma inscrição com o endpoint `https://fcm.googleapis.com/fcm/send/teste-invalido` e chaves válidas de exemplo, num cliente com post hoje (ajustar `data` de um post para `hojeEmSaoPaulo()` pela chave de serviço); depois da chamada, a inscrição não existe mais ou a resposta tem `expiradas ≥ 1` ou erro contado, sem 500.
- [ ] **Step 7: Publicar** as duas funções com `--no-verify-jwt`, aplicar a migração e rodar `npm run test:int -- lembrete` → PASS.
- [ ] **Step 8: Commit** `feat: lembretes por notificação (servidor)`.

### Task 10: Lembretes — app instalável e ativação

**Files:**
- Create:
  - `app/public/manifest.webmanifest`;
  - `app/public/sw.js`;
  - `app/public/img/icone-192.png`, `app/public/img/icone-512.png`;
  - `scripts/icones.mjs`;
  - `app/src/cliente/lembretes.js`.
- Modify: `app/index.html` (manifest, `apple-touch-icon`, registro do SW), `app/src/cliente/calendario.js` (aviso e sino), `app/src/textos.js`, `package.json` (`sharp` em devDependencies).
- Test: `tests/unit/lembretes.test.js`

**Interfaces:**
- Consumes: a tabela `push_inscricoes` (Task 1), a função `lembrete-teste` (Task 9) e `VITE_VAPID_PUBLIC_KEY`.
- Produces:
  - `estadoDosLembretes({ temPush: boolean, permissao: 'default'|'granted'|'denied', iphone: boolean, instalado: boolean, inscrito: boolean }): 'sem-suporte'|'instalar'|'bloqueado'|'ativo'|'inativo'`;
  - `ehIphone(userAgent, maxTouchPoints): boolean` (iPhone/iPad, incluindo o iPad que se apresenta como Mac com toque);
  - `chaveParaBytes(base64url): Uint8Array`;
  - `ativarLembretes(supabase, clienteId)`, que pede a permissão, faz `pushManager.subscribe({ userVisibleOnly: true, applicationServerKey })`, `upsert` em `push_inscricoes` (por `endpoint`) e chama `lembrete-teste`;
  - `desligarLembretes(supabase)`, que faz `unsubscribe` e apaga pelo `endpoint`;
  - `adiarAviso()`, que guarda a data em `localStorage` `pat-lembrete-adiado` (por 7 dias).
- [ ] **Step 1: Testes que falham:**
  - `estadoDosLembretes`, todos os 5 resultados:
    - iPhone fora da tela inicial → `instalar`;
    - `denied` → `bloqueado`;
    - inscrito → `ativo`;
    - sem push → `sem-suporte`;
  - `ehIphone` com um UA de iPhone, um de Android e iPad com `maxTouchPoints=5` e UA de Mac;
  - `chaveParaBytes` para uma chave conhecida (65 bytes, começando com 4).
- [ ] **Step 2: Rodar** → FAIL. **Step 3: Implementar.**
  - `scripts/icones.mjs` (sharp): `pat-icon.png` centralizado em fundo `#000000`, quadrado de 192 e 512 com margem de 12%.
  - `manifest`: `name: 'PAT – Presença Ativa'`, `short_name: 'PAT'`, `start_url: '/'`, `display: 'standalone'`, `background_color: '#000000'`, `theme_color: '#000000'`, ícones com `purpose: 'any maskable'`.
  - `sw.js`:
    - evento `push` → `showNotification(titulo, { body: corpo, icon: '/img/icone-192.png', badge: '/img/icone-192.png', data: { url } })`;
    - `notificationclick` → foca uma aba aberta e navega para `url`, ou abre uma nova;
    - nada de cache offline nesta etapa.
  - No calendário:
    - o aviso aparece só nos estados `inativo`/`instalar` (e não adiado);
    - o sino 🔔/🔕 aparece com texto;
    - o passo a passo do iPhone fica num `<dialog>` com os 3 passos do spec §3.5;
    - no estado `bloqueado`, a mensagem do spec.
- [ ] **Step 4: Rodar** `npx vitest run` → PASS; `npm run build` e conferir que `dist/sw.js` e `dist/manifest.webmanifest` existem.
- [ ] **Step 5: Netlify.** Pedir à Karem para criar a variável `VITE_VAPID_PUBLIC_KEY` no Netlify (passo a passo: Project configuration → Environment variables → Add a variable).
- [ ] **Step 6: Commit** `feat: app instalável e lembretes no aparelho`.

### Task 11: Revisão final e entrega para teste

- [ ] **Step 1:** `npx vitest run` e `npm run test:int`: todos verdes; `npm run build` sem avisos novos.
- [ ] **Step 2:** Conferir as pendências da Etapa 2 que esta etapa toca: o status da foto ao voltar um passo e o limite de arquivos no bucket. Se uma delas não for resolvida aqui, anotar na memória.
- [ ] **Step 3:** Revisão do branch inteiro (superpowers:requesting-code-review).
- [ ] **Step 4:** Com a autorização da Karem: push do `v2-etapa3` e troca do production branch do Netlify para `v2-etapa3` (passo a passo como na Etapa 2).
- [ ] **Step 5:** Entregar o roteiro de teste manual (os 7 passos do spec §1), lembrando que no iPhone é preciso adicionar à tela inicial antes de ativar os lembretes.
