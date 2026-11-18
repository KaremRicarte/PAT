# Imagem para posts de tema geral (Pixabay certo + imagem gerada) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fazer o Pixabay achar fotos (busca por palavras-chave), gerar uma imagem com FLUX (fal.ai) quando nada serve num post de tema geral, preferir "Minhas fotos" em posts de aproximação e avisar o redator quando a imagem é ilustrativa.

**Architecture:**
- As regras ficam nos módulos puros (`_shared/ia/imagens.ts`, novo `_shared/ia/palavras.ts`, `entrada.ts`, `escrever.ts`, `melhorar-posts/acoes.ts`). Rede e banco ficam só em `adaptadores.ts` e `melhorar-posts/index.ts`.
- Uma migração acrescenta 'gerada' aos checks e separa a contagem das imagens geradas da contagem das 400 chamadas.

**Tech Stack:** Deno Edge Functions (TypeScript), Supabase Postgres, Vitest, fal.ai REST (`fal-ai/flux/schnell`), Claude (`claude-opus-5-5`, via `ChamarIA` já existente).

**Spec:** `docs/superpowers/specs/2026-11-18-pat-imagem-ia-design.md`

## Global Constraints

**Ordem da imagem num post de tema geral**
- Fotos do cliente → banco do admin (90 dias) → Pexels → Pixabay → imagem gerada → só texto.
- Posts de serviço (`produto_id`) e ramos `textOnly` nunca geram imagem.

**Palavras-chave**
- Uma chamada Claude (`tipo='imagem'`, `esforco:'low'`) devolve `{ busca_pt, busca_en, prompt_imagem }`.
- Só é feita depois que as fotos do cliente e o banco não deram imagem.
- Ela acontece mesmo sem `FAL_KEY` ou com o limite de geradas esgotado.
- Na busca, primeiro `busca_pt`; se não vier nenhum resultado novo, `busca_en`. Uma única chamada de `escolher` por fonte.
- Falha da chamada:
  - resposta inválida ou vazia → busca com `temaDaImagem(post)` e nada de gerar;
  - `ocupado` ou falta de tempo → mesma regra de hoje (exceções `Ocupado` e `SemTempo`).

**Geração (fal.ai)**
- `POST https://fal.run/fal-ai/flux/schnell`, header `Authorization: Key <FAL_KEY>`.
- Corpo: `{ prompt, image_size, num_images: 1, enable_safety_checker: true, output_format: 'jpeg' }`.
- `image_size`: `{ width: 864, height: 1080 }` (4:5) para `rede`/`tipo` feed; `'portrait_16_9'` para stories e reels (campo `tipo` do post ≠ 'feed').
- Resposta: `images[0].{url,width,height}` e `has_nsfw_concepts[0]`.
  - Com `has_nsfw_concepts[0] === true`: o custo é registrado e a imagem descartada (só texto).
- As URLs das imagens vêm de hosts `*.fal.media`.
- O prompt final sempre termina com o sufixo fixo: `realistic professional photograph, natural light, no people, no faces, no text, no letters, no logos, no watermark`.

**Limite e custo**
- `LIMITE_GERADAS = 20` por cliente por mês (São Paulo), contadas em `uso_ia` com `tipo='gerada'`.
- Esse limite é separado: `uso_ia_no_mes` passa a ignorar `tipo='gerada'`.
- Custo de cada imagem gerada: `Math.ceil(largura*altura/1_000_000) * 0.003` USD, com `tokens_entrada = tokens_saida = 0`.

**Armazenamento**
- A imagem gerada é copiada para `{uid}/banco/gerada-{id}.jpg`.
- Ela vai para `fotos_ia` com `origem='gerada'`, `externo_id=id`, `autor=null`, `descricao=prompt_imagem` e `serve=true`.

**Aproximação**
- Vale quando `post.pilar === 'aprox'`.
- Há uma só chamada de `escolher`: as fotos de "Minhas fotos" vêm primeiro, com a descrição prefixada por `Foto do próprio negócio: `.
- O tema enviado ganha ` (post de aproximação: prefira uma foto do próprio negócio)`.

**Ilustrativa**
- Uma foto é ilustrativa ⇔ o caminho começa com `{clienteId}/banco/`.
- O texto para o redator: `Foto do post (anexada; imagem ilustrativa, não é do negócio: não diga que é o espaço, a equipe, o produto ou o trabalho do cliente): <descricao>`.

**Outras regras**
- Sem `FAL_KEY`: `gerarImagem` é `null` e nada muda além disso.
- Nenhuma falha de geração derruba o post.
- Mensagens, comentários e nomes seguem o estilo do código existente: português.

## Review Focus

1. **Limite de 20 atingido com chamadas em paralelo** (LOTE=3 da mesma cliente). Pode passar por poucas imagens, como acontece hoje com as 400; isso é aceitável, mas a contagem tem de ser feita antes de cada geração. Teste na Task 2.
2. **Resposta do fal.ai sem `images`, com status 4xx ou 5xx, ou com timeout.** O adaptador devolve null, sem lançar exceção. Teste na Task 4.
3. **Imagem com `has_nsfw_concepts: [true]`.** O custo é registrado, a imagem não é usada e o post sai só com texto. Teste na Task 3.
4. **Pouco tempo restante antes da geração.** Se não couber a geração com a reserva de escrita, o post é adiado (`SemTempo`), sem gerar. Teste na Task 3.
5. **"Gerar outro" ou "Trocar imagem" num post com imagem gerada.** O redator continua recebendo o aviso de ilustrativa (via `naHora.ts`). Teste na Task 1.

---

### Task 1: Redator sabe quando a imagem é ilustrativa

**Files:**
- Modify: `supabase/functions/_shared/ia/escrever.ts` (tipo `EntradaPost.foto` ~:33 e o texto ~:108)
- Modify: `supabase/functions/_shared/ia/entrada.ts` (nova `fotoIlustrativa`, `montarEntradaPost`)
- Modify: `supabase/functions/_shared/ia/naHora.ts` (~:44-46)
- Test: `tests/unit/ia-escrever.test.ts`, `tests/unit/troca.test.ts` ou o teste que já cobre `escreverNaHora` (`grep -l escreverNaHora tests/unit`)

**Interfaces:**
- Produces:
  - `fotoIlustrativa(clienteId: string, path: string): boolean`, em entrada.ts;
  - `EntradaPost.foto: { url: string, descricao: string, ilustrativa?: boolean } | null`;
  - `montarEntradaPost(c, post, foto: { url, descricao, ilustrativa?: boolean } | null)`, que repassa `ilustrativa`.

- [ ] **Step 1: Escrever os testes que falham**
  - `fotoIlustrativa('u1', 'u1/banco/gerada-x.jpg') === true`.
  - `fotoIlustrativa('u1', 'u1/produtos/a.jpg') === false`.
  - `fotoIlustrativa('u1', 'u2/banco/x.jpg') === false`.
  - O conteúdo de texto montado por `escreverPost` para uma entrada com `foto: { url, descricao: 'mesa posta', ilustrativa: true }` contém `imagem ilustrativa, não é do negócio` e `mesa posta`.
  - Sem `ilustrativa`, continua `Foto do post (anexada): mesa posta`.
  - `escreverNaHora` com `foto.path = '<clienteId>/banco/pixabay-1.jpg'` envia ao redator o texto com `imagem ilustrativa`.
- [ ] **Step 2: Rodar** `npx vitest run tests/unit/ia-escrever.test.ts` e o teste de naHora. Esperado: FAIL.
- [ ] **Step 3: Implementar.**
  - Usar o texto exato de Global Constraints.
  - Em `naHora.ts`, passar `ilustrativa: fotoIlustrativa(a.clienteId, a.foto.path)`.
- [ ] **Step 4: Rodar** `npm test`. Esperado: tudo PASS.
- [ ] **Step 5: Commit** `feat(ia): redator sabe quando a imagem é ilustrativa`

### Task 2: Migração, tipos de uso e custo da imagem gerada

**Files:**
- Create: `supabase/migrations/20261118000005_imagem_gerada.sql`
- Modify: `supabase/functions/_shared/ia/uso.ts` (`TipoUso`, nova constante)
- Modify: `supabase/functions/_shared/ia/custo.ts` (nova função)
- Test: `tests/unit/ia-uso.test.ts`

**Interfaces:**
- Produces:
  - `TipoUso` inclui `'gerada'`;
  - `LIMITE_GERADAS = 20` (uso.ts);
  - `custoImagemGerada(largura: number, altura: number): number` (custo.ts);
  - a RPC `public.uso_ia_geradas_no_mes(p_cliente uuid) returns int`, executável só por `service_role`.

- [ ] **Step 1: Testes que falham.**
  - `custoImagemGerada(864, 1080) === 0.003`.
  - `custoImagemGerada(1024, 1024) === 0.006` (1,05 MP arredonda para 2).
  - `custoImagemGerada(576, 1024) === 0.003`.
- [ ] **Step 2: Rodar** `npx vitest run tests/unit/ia-uso.test.ts`. Esperado: FAIL.
- [ ] **Step 3: Implementar e escrever a migração.**
  - A migração troca o check de `fotos_ia.origem` para incluir `'gerada'`. Os nomes padrão das constraints são `fotos_ia_origem_check` e `uso_ia_tipo_check`; conferir com `select conname from pg_constraint where conrelid in ('public.fotos_ia'::regclass,'public.uso_ia'::regclass)` pela Management API antes de aplicar.
  - Troca o check de `uso_ia.tipo` para incluir `'gerada'`.
  - Recria `uso_ia_no_mes` com `and tipo <> 'gerada'`, preservando `security`/`search_path` e os grants da original (`20261118000001_ia_posts.sql:113-122`).
  - Cria `uso_ia_geradas_no_mes`: mesma janela de mês, `tipo = 'gerada'`, mesmos revoke/grant.
- [ ] **Step 4: Rodar** `npm test` (PASS). Depois `npx supabase db push --remote --yes` no pat-dev. Conferir com SQL: `select public.uso_ia_geradas_no_mes(gen_random_uuid())` retorna 0.
- [ ] **Step 5: Commit** `feat(ia): tipo 'gerada' em uso_ia e fotos_ia, contagem separada e custo da imagem gerada`

### Task 3: Escolha da imagem: palavras-chave, aproximação e geração

**Files:**
- Create: `supabase/functions/_shared/ia/palavras.ts`
- Modify: `supabase/functions/_shared/ia/instrucoes.ts` (nova `INSTRUCOES_PALAVRAS`)
- Modify: `supabase/functions/_shared/ia/imagens.ts`
- Modify: `supabase/functions/melhorar-posts/acoes.ts`
- Test: `tests/unit/ia-imagens.test.ts`, `tests/unit/melhorar-posts.test.ts`

**Interfaces:**
- Consumes:
  - `TipoUso 'gerada'`, `LIMITE_GERADAS` e `custoImagemGerada` (Task 2);
  - `fotoIlustrativa` (Task 1).
- Produces:
  - **palavras.ts:**
    - `type Palavras = { busca_pt: string, busca_en: string, prompt_imagem: string }`;
    - `ESQUEMA_PALAVRAS`, um JSON schema com os 3 campos string, todos obrigatórios e `additionalProperties:false`;
    - `criarPalavras(chamar: ChamarIA): (tema: string, ramo: string) => Promise<Palavras | null>`. Devolve null se a resposta não for ok ou se faltar algum campo não vazio. `maxTokens: 8000`, `esforco: 'low'`.
  - **imagens.ts:**
    - `Origem` inclui `'gerada'`;
    - `FotoDoCliente` ganha `doNegocio?: boolean`;
    - `DepsImagens` ganha:
      - `palavras: (tema: string) => Promise<Palavras | null>`;
      - `gerar: ((prompt: string, formato: 'feed' | 'vertical') => Promise<{ id: string, url: string } | null>) | null`;
      - `geradasNoMes: (clienteId: string) => Promise<number>`;
    - `escolherImagemGeral` aceita, além do que já recebe, `aproximacao?: boolean` e `formato: 'feed' | 'vertical'`;
    - quando gera, devolve `{ path: url, origem: 'gerada', descricao: prompt_imagem, externo: { id, autor: '', url } }`.
  - **acoes.ts:**
    - `DepsMelhorar` (dentro de `Omit<DepsImagens, 'escolher' | 'palavras' | 'gerar'>`) ganha:
      - `gerarImagem: ((prompt: string, formato: 'feed' | 'vertical', timeoutMs: number) => Promise<{ id: string, url: string, largura: number, altura: number, bloqueada: boolean } | null>) | null`;
      - `geradasNoMes: (clienteId: string) => Promise<number>`;
    - `LinhaFotoIA.origem` e `copiarExterna` aceitam `'gerada'`;
    - `ESQUEMA_PALAVRAS` é reexportado para os testes, se for preciso.

- [ ] **Step 1: Testes que falham em `ia-imagens.test.ts`.**
  - O helper `deps()` ganha os padrões `palavras: async () => ({ busca_pt: 'mesa posta', busca_en: 'table setting', prompt_imagem: 'a set table' })`, `gerar: null` e `geradasNoMes: async () => 0`.
  - `base` ganha `formato: 'feed'`.
  - **pixabay recebe palavras-chave, não o tema:** `buscarPixabay` registra o termo e deve receber `'mesa posta'`.
  - **busca em inglês quando o português não traz nada novo:** Pixabay retorna `[]` para `'mesa posta'` e um hit para `'table setting'` → origem `pixabay`; termos na ordem `['mesa posta','table setting']`.
  - **palavras null → busca com o tema e não gera:** com `gerar` espião, o termo é `'unhas'` e `gerar` não é chamado; resultado null.
  - **gera quando nada serve:** com `gerar: async () => ({ id: 'g1', url: 'https://v3b.fal.media/x.jpg' })`, o resultado é `{ origem: 'gerada', path: 'https://v3b.fal.media/x.jpg', descricao: 'a set table', externo: { id: 'g1' } }`, e `gerar` recebe `('a set table', 'feed')`.
  - **limite de geradas:** `geradasNoMes: async () => 20` → `gerar` não é chamado, resultado null.
  - **palavras não é chamada quando a foto do cliente serve** (espião).
  - **aproximação:**
    - com `aproximacao: true` e `fotosDoCliente` `[{path:'p.jpg', doNegocio:false}, {path:'n.jpg', doNegocio:true}]`, a lista enviada a `escolher` começa por `n.jpg`;
    - a descrição de `n.jpg` começa com `Foto do próprio negócio: `;
    - o tema recebido termina com `(post de aproximação: prefira uma foto do próprio negócio)`;
    - há só uma chamada de `escolher` para as fotos do cliente.
- [ ] **Step 2: Testes que falham em `melhorar-posts.test.ts`.**
  - `montar` ganha as opções `gerada?: {...}|null`, `geradas?: number` e `palavras?: (p) => RespostaIA`.
  - O `chamar` falso responde a `ESQUEMA_PALAVRAS`.
  - `deps.gerarImagem` registra as chamadas.
  - **post geral sem foto nenhuma gera:**
    - `copiarExterna` é chamado com `'gerada'`;
    - `fotosGravadas` tem `origem:'gerada'`, `externo_id` = id e `descricao` = prompt;
    - `usos` tem um `{ tipo:'gerada', tokensEntrada:0, tokensSaida:0, custoUsd:0.003 }` para 864×1080;
    - o pedido de escrita contém `imagem ilustrativa`.
  - **`bloqueada: true`:** o uso `gerada` é registrado, nada é copiado e o post é gravado com `foto_path: null`.
  - **`gerarImagem` null (sem chave):** o post é gravado só texto e nenhum uso `gerada`.
  - **post de serviço sem fotos e ramo `textOnly`:** `gerarImagem` nunca é chamado.
  - **formato:** um post `tipo:'stories'` chama `gerarImagem` com `'vertical'`.
  - **pilar `aprox`:** a chamada de escolha recebe a foto de `negocio.fotos` antes da foto de produto.
  - **pouco tempo:** com o relógio falso deixando menos que `RESERVA_ESCRITA_MS + MARGEM_MS + 10_000` antes da geração, o resultado é `'adiado'` e `gerarImagem` não é chamado.
  - **imagem de banco ou Pexels:** o pedido de escrita contém `imagem ilustrativa`; com a foto do cliente, não contém.
- [ ] **Step 3: Rodar** `npx vitest run tests/unit/ia-imagens.test.ts tests/unit/melhorar-posts.test.ts`. Esperado: FAIL.
- [ ] **Step 4: Implementar.**
  - **`INSTRUCOES_PALAVRAS`:** extrair do tema e do ramo 2–3 palavras de busca de foto (pt e en, substantivos concretos e visuais, sem verbos nem perguntas). O `prompt_imagem` é em inglês, descreve uma cena/objeto fotografável que ilustra o tema, sem pessoas, rostos, texto ou logotipos.
  - **`escolherImagemGeral`:**
    - foto do cliente: na aproximação, reordena e prefixa;
    - banco, sem mudança;
    - `palavras(tema)`;
    - para cada fonte, termos = palavras ? `[busca_pt, busca_en]` : `[tema]`; busca termo a termo até haver resultados novos (ids não usados), depois uma chamada de `escolher(novas, tema)`;
    - gera se `palavras && deps.gerar && (await deps.geradasNoMes(clienteId)) < LIMITE_GERADAS`.
  - **Em `melhorarComPrazo`:**
    - `palavras: criarPalavras(chamarImagem)`;
    - `formato: post.tipo === 'feed' ? 'feed' : 'vertical'`;
    - `aproximacao: post.pilar === 'aprox'`;
    - `fotosDoCliente` marca `doNegocio` para os caminhos de `minhasFotos`;
    - `gerar` é um invólucro de `deps.gerarImagem` que:
      - calcula `ms = Math.min(30_000, restante() - RESERVA_ESCRITA_MS - MARGEM_MS)` e, se `ms < 10_000`, lança `SemTempo`;
      - chama com `ms`;
      - se veio resposta, faz `registrarUso({ clienteId, tipo:'gerada', tokensEntrada:0, tokensSaida:0, custoUsd: custoImagemGerada(largura, altura) })`, com erro de registro só logado;
      - devolve null se `bloqueada`.
  - **Em `trazerParaOCliente`:** `'gerada'` segue o mesmo caminho de Pexels/Pixabay (`copiarExterna` + `gravarFoto` com `autor: null`).
  - **Em `montarEntradaPost`, chamado aqui:** passar `ilustrativa: fotoIlustrativa(clienteId, foto.path)`.
  - O sufixo fixo do prompt **não** fica aqui; ele fica no adaptador (Task 4).
- [ ] **Step 5: Rodar** `npm test`. Esperado: tudo PASS.
- [ ] **Step 6: Commit** `feat(ia): palavras-chave para a busca, Minhas fotos na aproximação e imagem gerada como último recurso`

### Task 4: Adaptador fal.ai, ligação na fila e guia da Karem

**Files:**
- Modify: `supabase/functions/_shared/ia/adaptadores.ts` (nova `criarGerarImagem`, `HOSTS_EXTERNOS`/checagem de host, `copiarExterna` aceita `'gerada'`)
- Modify: `supabase/functions/melhorar-posts/index.ts` (`FAL_KEY`, `gerarImagem` e `geradasNoMes` via RPC `uso_ia_geradas_no_mes`)
- Modify: `docs/como-configurar-a-ia.md`
- Test: `tests/unit/ia-adaptadores-fal.test.ts`, só se `criarGerarImagem` puder ficar num arquivo sem `npm:`; senão, a lógica de montar o corpo e ler a resposta vai para funções puras em `_shared/ia/fal.ts`, testadas, e `adaptadores.ts` só faz o `fetch`.

**Interfaces:**
- Consumes: as assinaturas de `DepsMelhorar.gerarImagem` e `geradasNoMes` (Task 3).
- Produces:
  - `fal.ts` (puro):
    - `corpoFal(prompt: string, formato: 'feed' | 'vertical'): object`;
    - `lerRespostaFal(json: unknown): { url: string, largura: number, altura: number, bloqueada: boolean } | null`;
    - `SUFIXO_PROMPT`;
  - `adaptadores.ts`: `criarGerarImagem(apiKey: string | undefined)`, que devolve `DepsMelhorar['gerarImagem']`, ou null sem chave. O id é `crypto.randomUUID()`.

- [ ] **Step 1: Testes que falham em `fal.ts`.**
  - `corpoFal('a set table', 'feed')` é igual a `{ prompt: 'a set table, ' + SUFIXO_PROMPT, image_size: { width: 864, height: 1080 }, num_images: 1, enable_safety_checker: true, output_format: 'jpeg' }`.
  - `'vertical'` usa `image_size: 'portrait_16_9'`.
  - `lerRespostaFal({ images: [{ url: 'https://v3b.fal.media/f.jpg', width: 864, height: 1080 }], has_nsfw_concepts: [false] })` é igual a `{ url:'https://v3b.fal.media/f.jpg', largura:864, altura:1080, bloqueada:false }`.
  - `has_nsfw_concepts: [true]` → `bloqueada: true`.
  - `{}`, `{ images: [] }` e uma URL que não é https → null.
  - Teste de host aceito: a função pura `hostPermitido(hostname)` (exportada de `fal.ts` ou de onde fizer sentido sem `npm:`) aceita `images.pexels.com`, `cdn.pixabay.com`, `v3b.fal.media` e `fal.media`, e recusa `evilfal.media` e `fal.media.evil.com`.
- [ ] **Step 2: Rodar o teste.** Esperado: FAIL.
- [ ] **Step 3: Implementar.**
  - **`criarGerarImagem`:** faz `fetch` POST com timeout (`AbortSignal.timeout(timeoutMs)`). Status não ok → `console.error('fal.ai', status)` e null; exceção → null; nunca lança exceção.
  - **`copiarExterna`:** usa `hostPermitido`.
  - **`index.ts`:**
    - `const CHAVE_FAL = Deno.env.get('FAL_KEY')`;
    - `gerarImagem: criarGerarImagem(CHAVE_FAL)`;
    - `geradasNoMes` chama a RPC; em erro lança exceção, como `contarUsoNoMes`. Em `escolherImagemGeral`, um erro em `geradasNoMes` vira "não gera": envolver em try/catch lá, com teste na Task 3 se ainda não houver.
  - **Guia:**
    - a tabela de chaves ganha a linha "fal.ai (FLUX) | Cria imagens quando não há foto | Sim, por uso (menos de 1 centavo de dólar por imagem)";
    - nova seção "fal.ai": conta em https://fal.ai, Billing com crédito pequeno (ex.: US$ 5), "API Keys" → criar chave → copiar;
    - segredo `FAL_KEY` na seção 4, na Opção A e no comando da Opção B;
    - na seção 6, o tipo `gerada`, o limite de 20 imagens geradas por cliente por mês, e a observação de que elas não contam nas 400;
    - na seção 7, "Sem imagem gerada: sem chave, sem crédito ou limite do mês: o post sai só com texto";
    - na seção 8, o fal.ai na lista de sites;
    - manter o tom e o formato atuais do guia.
- [ ] **Step 4: Rodar** `npm test`. Esperado: PASS.
- [ ] **Step 5: Deploy no pat-dev.**
  - `npx supabase functions deploy melhorar-posts trocar-post reescrever-post descrever-fotos --project-ref bvliykfmrgbrqimmdria --yes`. As funções que importam `_shared/ia` mudaram (`naHora`, `entrada`); incluir qualquer outra função que importe os arquivos alterados (`grep -rl "_shared/ia" supabase/functions/*/index.ts`).
- [ ] **Step 6: Commit** `feat(ia): adaptador fal.ai (FLUX schnell), FAL_KEY na fila e guia atualizado`
