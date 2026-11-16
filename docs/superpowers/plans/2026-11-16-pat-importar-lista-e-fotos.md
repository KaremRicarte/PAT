# Importar lista e fotos, preço "de/por" e posts de oferta — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** O dono do negócio importa, no computador, um `.txt` (`nome;preço;promocional`) e várias fotos de uma vez; cada item passa a ter preço normal, promocional e até 6 fotos; o mês ganha posts de promoção "de/por" e de vitrine de preço, com selo na arte.

**Architecture:** Leitura e junção do arquivo são funções puras no app (`app/src/cliente/importar.js`); a tela do passo dos itens vira a revisão (nada grava antes do "Salvar"). O banco ganha `produtos.preco_promo`, `produtos.fotos text[]` e `posts.preco_de/preco_por`; a geração (`gerar.ts`, compartilhada por `gerar-mes` e `trocar-post`) escolhe os dias de preço e grava o preço no post; a arte desenha o selo a partir do post.

**Tech Stack:** JS puro + Vite (app), Vitest (unit `npm test`, integração `npm run test:int` — rodar **um arquivo por vez**, com pausa, por causa do limite de login), Supabase (Postgres/RLS/Storage, Edge Functions em Deno/TS, CLI v3 com `--remote --yes`).

**Spec:** `docs/superpowers/specs/2026-11-16-pat-importar-lista-e-fotos-design.md` (§3 arquivo, §4 telas, §5 posts, §6 dados, §9b regras finas).

## Global Constraints

- Branch `v2-etapa3`. Um commit por tarefa, com `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- Textos de interface só em `app/src/textos.js` (chaves planas, português do dia a dia, sem "CSV"/"importar arquivo delimitado").
- Limites: **`MAX_ITENS = 20`**, **`MAX_FOTOS = 6`** por item. Foto reduzida com `reduzirFoto(arquivo, FOTO_MAX=1600, 'image/jpeg')`.
- Ramos `noPromo` (psicologia, advocacia): nenhum preço é gravado nem aparece em post; a importação ignora as colunas de preço e avisa.
- Nada é apagado pela importação; a junção só cria e atualiza.
- Caminho de foto nova: `{uid}/produtos/{produto_id}/{uuid}.jpg`. Caminhos antigos `{uid}/produtos/{id}.jpg` continuam válidos.
- Áreas de toque ≥ 48 px; cor nunca é a única pista (spec Etapa 3 §3.0).
- Operações remotas no pat-dev (`db push`, `functions deploy`) e o push do branch: só o controlador, na sessão principal.

## Review Focus

1. **Arquivo salvo pelo Bloco de Notas antigo (Windows‑1252) com acentos** ("São Paulo;1500;1200") — o nome deve chegar com acento, não com "S�o". (Task 2)
2. **Nome com espaço/acento no texto e foto "colada"** (`Leste Europeu` ↔ `lesteeuropeu_praga.JPG`, `Leste-Europeu_1.jpg`) — a foto deve cair no item. (Task 2/3)
3. **Importar de novo o mesmo arquivo** — não duplica itens nem fotos já ligadas por nome de arquivo repetido no mesmo lote; itens fora do arquivo continuam. (Task 3)
4. **Cliente que já tinha o mês gerado muda o preço** — a arte e a legenda dos posts antigos continuam iguais entre si (preço guardado no post). (Task 7/9)
5. **Item com preço em ramo `noPromo` vindo de dados antigos ou do arquivo** — nenhum `R$` em post, nenhum selo. (Task 3/7/9)

---

### Task 1: Banco — preços promocionais, várias fotos e preço no post

**Files:**
- Create: `supabase/migrations/20261116000001_precos_e_fotos.sql`
- Test: `tests/int/negocio-rls.test.js`, `tests/int/gerar-mes.test.js`

**Interfaces:**
- Produces (colunas): `produtos.preco_promo numeric(10,2) null check (preco_promo > 0 and (preco is not null and preco_promo <= preco))`; `produtos.fotos text[] not null default '{}' check (cardinality(fotos) <= 6)`; `posts.preco_de numeric(10,2) null`, `posts.preco_por numeric(10,2) null`.
- Produces (RPC): `criar_mes(p_cliente, p_ano_mes, p_estrategia, p_origem, p_posts jsonb, p_redes text[])` — mesma assinatura de `20261112000004`, agora também lê `preco_de numeric, preco_por numeric` do recordset e grava nas colunas novas.

- [ ] **Step 1: Write the failing tests** — em `negocio-rls.test.js`: `it('produto guarda preço promocional e até 6 fotos')` (upsert com `preco: 2199, preco_promo: 1799, fotos: [6 paths do próprio uid]` → ok; 7 fotos → erro; `preco_promo: 2500` com `preco: 2199` → erro; `preco_promo: 10` com `preco: null` → erro). Em `gerar-mes.test.js`: `it('criar_mes grava preco_de e preco_por')` chamando o RPC com a chave de serviço e um post com `preco_de: 2199, preco_por: 1799`, lendo de volta.
- [ ] **Step 2: Run** `npx vitest run --config vitest.int.config.js tests/int/negocio-rls.test.js` → FAIL (coluna inexistente).
- [ ] **Step 3: Write the migration.** Também: `update public.produtos set fotos = array[foto_path] where foto_path is not null and fotos = '{}'`. Recriar `criar_mes` (copiar o corpo de `20261112000004` e acrescentar as duas colunas no `insert` e no `jsonb_to_recordset`).
- [ ] **Step 4: Controlador aplica** `npx supabase db push --remote --yes` no pat-dev; rodar os dois arquivos de teste, um por vez → PASS.
- [ ] **Step 5: Commit** `feat: banco com preço promocional, várias fotos e preço no post`.

### Task 2: Ler o arquivo e as fotos (funções puras)

**Files:**
- Create: `app/src/cliente/importar.js`
- Test: `tests/unit/importar.test.js`

**Interfaces:**
- Produces:
  - `normalizarNome(s: string): string` — minúsculas, sem acento, só `[a-z0-9]`.
  - `chaveDaFoto(nomeArquivo: string): string` — `normalizarNome` do trecho antes do primeiro `_` (sem `_`: nome sem extensão).
  - `decodificarTexto(bytes: ArrayBuffer): string` — `TextDecoder('utf-8', { fatal: true })`; se lançar, `TextDecoder('windows-1252')`. Remove BOM.
  - `lerLista(texto: string): { linhas: Linha[], erros: { linha: number, chave: string }[] }` onde `Linha = { linha: number, nome: string, preco: number|null|undefined, promo: number|null|undefined }` (`undefined` = coluna em branco/ausente, `null` = `0` explícito).
  - Preços via `precoDoTexto` de `negocio.js`, mas `"0"`/`"0,00"` → `null` e vazio → `undefined`.

- [ ] **Step 1: Write the failing tests** — casos (valores do spec §3):
  - `lerLista('Gramado;2199;1799\nLeste Europeu;10299;9999\nportoseguro;1999;1999\nportugal;0;0')` → 4 linhas, `{nome:'Gramado',preco:2199,promo:1799}`, `{nome:'portugal',preco:null,promo:null}`.
  - `'portugal'` → `{preco: undefined, promo: undefined}`; `'# comentário\n\n  \nX;10;'` → 1 linha `{preco:10, promo:undefined}`.
  - `'A;R$ 2.199,90;1.999,90'` → `preco: 2199.9, promo: 1999.9`.
  - Separador vírgula só sem `;`: `'Gramado,2199,1799'` → ok; `'A;1,50;1'` → `preco: 1.5`.
  - Erros: `'A;0;10'` → `{linha:1, chave:'importar.erro.semnormal'}`; `'A;100;150'` → `importar.erro.promomaior`; `'X;abc;1'` → `importar.erro.preco`; nome com < 2 letras → `importar.erro.nome`.
  - `chaveDaFoto('Leste-Europeu_1.JPG') === 'lesteeuropeu'`, `chaveDaFoto('gramado.jpg') === 'gramado'`, `normalizarNome('São Paulo') === 'saopaulo'`.
  - `decodificarTexto(bytes Windows‑1252 de 'São Paulo;1;1')` → `'São Paulo;1;1'`; UTF‑8 com BOM → sem BOM.
- [ ] **Step 2: Run** `npx vitest run tests/unit/importar.test.js` → FAIL.
- [ ] **Step 3: Implement** em `app/src/cliente/importar.js`.
- [ ] **Step 4: Run** → PASS.
- [ ] **Step 5: Commit** `feat: ler a lista e o nome das fotos da importação`.

### Task 3: Juntar a importação com a lista atual (função pura)

**Files:**
- Modify: `app/src/cliente/importar.js`
- Test: `tests/unit/importar.test.js`

**Interfaces:**
- Consumes: `lerLista`, `chaveDaFoto`, `normalizarNome` (Task 2).
- Produces: forma do item no estado do quiz (usada pelas Tasks 4 e 5):
  `ItemQuiz = { id, nome, descricao, precoTexto, promoTexto, fotos: FotoQuiz[], novo?: boolean, fotosNovas?: number }`, `FotoQuiz = { path: string } | { arquivo: File, nome: string }`.
- Produces: `juntarImportacao(itens: ItemQuiz[], { linhas, erros, arquivosDeFoto: File[] }, { noPromo: boolean, novoId: () => string }): { itens: ItemQuiz[], resumo: { novos: number, atualizados: number, fotos: number, semItem: string[], foraItens: string[], foraFotos: string[], erros: {linha,chave}[], precosIgnorados: boolean } }`.

Regras (spec §4.3 e §9b):
- Casa item por `normalizarNome(nome)`. Existente: preço/promo **só** muda quando a coluna veio (`undefined` não mexe; `null` limpa → texto `''`); o nome **não** muda. Novo: criado no fim, `novo: true`.
- `noPromo`: ignora preços (não mexe em `precoTexto/promoTexto`), `precosIgnorados: true` se alguma linha tinha preço.
- Fotos: cada `File` vai para o item cuja chave é `chaveDaFoto(file.name)`; sem item → `semItem`. Arquivo com o mesmo nome já posto no mesmo item neste lote é ignorado. Fotos existentes ficam; novas até `MAX_FOTOS` (6), excedentes → `foraFotos`.
- Itens novos além de `MAX_ITENS` (20) → `foraItens` (e as fotos deles também não entram).
- Linhas com erro não criam nem mudam item; vão para `erros`.
- Preço → texto: `2199` → `'2199'`, `2199.9` → `'2199,90'` (o `precoDoTexto` relê).

- [ ] **Step 1: Write the failing tests** — `junta: cria novos e atualiza preços sem apagar` (atual `[{nome:'Gramado', precoTexto:'2000', fotos:[{path:'u/p/a.jpg'}]}, {nome:'Bonito'}]` + linhas do spec → Gramado `precoTexto:'2199', promoTexto:'1799'`, Bonito continua, `novos: 3, atualizados: 1`); `linha só com nome não mexe no preço`; `0 limpa o preço`; `fotos vão pelo começo do nome` (`lesteeuropeu_1.jpg`, `Leste-Europeu_2.JPG` → item "Leste Europeu"; `praia_1.jpg` → `semItem`); `limite de 6 fotos e 20 itens`; `importar duas vezes não duplica`; `noPromo ignora preços e avisa`.
- [ ] **Step 2: Run** → FAIL.
- [ ] **Step 3: Implement** `juntarImportacao`.
- [ ] **Step 4: Run** → PASS.
- [ ] **Step 5: Commit** `feat: juntar a importação com os itens do negócio`.

### Task 4: Salvar e carregar preços e várias fotos

**Files:**
- Modify: `app/src/cliente/negocio.js`
- Test: `tests/unit/negocio.test.js`, `tests/int/quiz-negocio.test.js`

**Interfaces:**
- Consumes: `ItemQuiz`, `FotoQuiz` (Task 3); colunas da Task 1.
- Produces: `MAX_ITENS = 20`, `MAX_FOTOS = 6` (exportados).
- Produces: `validarItens(itens, ramo)` passa a checar também, fora de `noPromo`: promo sem normal → `'quiz.itens.semnormal'`; promo > normal → `'quiz.itens.promomaior'`; mais de 6 fotos → `'quiz.itens.fotos'`. Lê `precoTexto/promoTexto` via `precoDoTexto`.
- Produces: `carregarNegocio` lê `preco_promo, fotos` (e `foto_path`); `fotos` vazio com `foto_path` → `[foto_path]`.
- Produces: `salvarNegocio(supabase, uid, dados, itens, aoProgredir?: (feitas: number, total: number) => void)` — `itens` agora `{ id, nome, descricao, preco, preco_promo, fotos: FotoQuiz[] }`. Envia, **uma por vez**, cada `{arquivo}` reduzido para `{uid}/produtos/{id}/{uuid}.jpg`; grava `fotos` (paths na ordem) e `foto_path = fotos[0] ?? null`; remove do Storage (melhor esforço) os paths que o item tinha antes e não tem mais, e as pastas dos itens apagados (`{uid}/produtos/{id}.jpg` e os paths listados em `fotos`). `noPromo` → `preco` e `preco_promo` nulos (como hoje).

- [ ] **Step 1: Write the failing tests** — unit: `validarItens` com os três novos casos e o limite de 20 itens. Int (`quiz-negocio.test.js`): `salva 2 fotos novas, depois remove 1: banco e Storage acompanham`; `apagar o item apaga as fotos dele`; `preço promocional gravado`.
- [ ] **Step 2: Run** unit e o arquivo int → FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** → PASS.
- [ ] **Step 5: Commit** `feat: salvar preço promocional e várias fotos por item`.

### Task 5: Tela — preço promocional, faixa de fotos e "Importar lista e fotos"

**Files:**
- Modify: `app/src/cliente/quiz.js` (passo 2, itens; `estado.itens` no formato `ItemQuiz`; submit passa `preco_promo` e `aoProgredir`), `app/src/textos.js`, `app/src/estilo.css`
- Create: `app/src/cliente/importarTela.js` (botão, área de arrastar, exemplo e resumo)
- Test: `tests/unit/importarTela.test.js` (só o texto do resumo)

**Interfaces:**
- Consumes: `decodificarTexto`, `lerLista`, `juntarImportacao` (Tasks 2–3); `MAX_ITENS`, `MAX_FOTOS`, `validarItens`, `salvarNegocio(…, aoProgredir)` (Task 4).
- Produces: `textoDoResumo(resumo): string[]` (linhas do resumo, puras, testáveis); `montarImportacao({ ramo, estado, aoMudar }): HTMLElement[]`.

Tela (spec §4):
- No topo do passo: botão secundário **"Importar lista e fotos"** (`<input type=file multiple accept=".txt,.csv,image/*">` escondido), linha de ajuda *"Tem muitos itens? Monte um arquivo de texto no computador e envie junto com as fotos."*, e `<details>` **"Como montar o arquivo"** com o exemplo do spec §3 e a regra das fotos (`gramado_1.jpg`).
- Área tracejada de arrastar (só aparece com `dragenter` na página; `drop` aceita arquivos e pastas via `webkitGetAsEntry` quando houver).
- Vários `.txt/.csv` no mesmo lote: usa o primeiro e avisa.
- Resumo no topo da lista (`role="status"`): *"Importamos: 3 itens novos · 1 atualizado · 14 fotos"*, uma linha ⚠ por grupo (`semItem`, `foraItens`, `foraFotos`, cada erro com o número da linha, `precosIgnorados` → *"Na sua área, os preços não aparecem nos posts."*).
- Editor do item: campo **"Preço normal (opcional)"** e **"Preço promocional (opcional)"** lado a lado (fora de `noPromo`); faixa de fotos com miniaturas (`URL.createObjectURL` para `{arquivo}`, URL assinada para `{path}`), botão "✕" com `aria-label="Remover foto N"`, e **"+ Adicionar foto"** (múltipla) escondido ao chegar em 6; selos **"Novo"** e **"+N fotos"**.
- Salvar com fotos novas: botão mostra *"Enviando fotos 3 de 14…"*.

- [ ] **Step 1: Write the failing test** — `textoDoResumo({novos:3, atualizados:1, fotos:14, semItem:['praia_1.jpg'], foraItens:[], foraFotos:[], erros:[{linha:4, chave:'importar.erro.promomaior'}], precosIgnorados:false})` → `['Importamos: 3 itens novos · 1 atualizado · 14 fotos', '⚠ 1 foto não encontrou item: praia_1.jpg', '⚠ Linha 4: o promocional precisa ser menor que o normal']`.
- [ ] **Step 2: Run** → FAIL.
- [ ] **Step 3: Implement** `importarTela.js`, ligar no passo 2 do quiz, textos e CSS.
- [ ] **Step 4: Run** `npm test` → PASS; `npm run build` → ok.
- [ ] **Step 5: Commit** `feat: importar lista e fotos no passo dos itens`.

### Task 6: As fotos do item nos posts

**Files:**
- Modify: `app/src/cliente/situacao.js`, `app/src/cliente/trocarFoto.js`, `app/src/artes/imagens.js`, `app/src/cliente/calendario.js` (aviso de fotos)
- Test: `tests/unit/situacao.test.js`, `tests/unit/trocarFoto.test.js`

**Interfaces:**
- Consumes: `produtos[].fotos` (Task 4).
- Produces: `fotoDoPost(post, produtos, ramo)` — post de um item reveza `produto.fotos[(post.ordem ?? 0) % n]` (vazio → `null`); posts gerais revezam **todas** as fotos de todos os itens (mesma regra de 596327d, uma foto só alterna com só texto).
- Produces: `fotosDoPost(post, produtos, ramo, max = 4): string[]` — para a montagem de vídeo: as fotos do item a partir da posição de `fotoDoPost`, até `max`; post geral → `[fotoDoPost]` filtrado.
- `servicosSemFoto` conta itens com `fotos` vazio. `opcoesDeFoto` lista todas as fotos de todos os itens (sem repetir). `prepararVideo` usa `fotosDoPost` quando `fotoPaths` não vier.

- [ ] **Step 1: Write the failing tests** — `post de item reveza as fotos dele` (`fotos:['a','b','c']`, ordens 0..3 → `a,b,c,a`); `post geral reveza todas as fotos`; `fotosDoPost devolve até 4 fotos do item começando pela da vez`; `servicosSemFoto usa fotos`; `opcoesDeFoto lista todas as fotos`.
- [ ] **Step 2: Run** → FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** `npm test` → PASS.
- [ ] **Step 5: Commit** `feat: posts usam todas as fotos do item`.

### Task 7: Geração — posts de promoção e de vitrine

**Files:**
- Modify: `supabase/functions/_shared/modelos/gerar.ts`, `supabase/functions/_shared/modelos/validar.ts`, `supabase/functions/gerar-mes/index.ts` (select `preco_promo`; RPC recebe `preco_de/preco_por`), `supabase/functions/trocar-post/index.ts` e `acoes.ts` (select `preco_promo`; `CamposTroca` ganha `preco_de, preco_por`)
- Test: `tests/unit/gerar.test.ts`, `tests/unit/validar.test.ts`, `tests/unit/trocar-post.test.ts`

**Interfaces:**
- Produces: `Pacote.produtos[]` ganha `preco_promo: number | null`.
- Produces: `PostGerado` ganha `preco_de: number | null`, `preco_por: number | null` (todos os posts; `null` quando não é de preço).
- Produces: `tratamentoDoItem(pr, ramo): 'promo' | 'vitrine' | null` — `noPromo` ou sem `preco` → `null`; `preco_promo` e `< preco` → `'promo'`; senão → `'vitrine'`.
- Produces: `diasDePreco(feed: string[], itens, estrategia, ramo): Map<string /*data*/, itemComPreco>`.

Algoritmo (spec §5, §9b):
- `itensComPreco` = promoções na ordem da lista, depois vitrines na ordem da lista.
- `quantos` = `vender` → `itensComPreco.length`; outras → `min(2, itensComPreco.length)`; nunca mais que `Math.round(feed.length * MIX[estrategia].demo)`.
- Dias: feed ordenado com sextas e sábados primeiro (na ordem do mês), depois os demais; pega os `quantos` primeiros; o i‑ésimo dia recebe o i‑ésimo item.
- No laço do feed, dia de preço → `partes` de pilar `demo` daquele item (conta em `usados.demo`), com:
  - promo: `titulo = limitar('Oferta: ' + ramo.titulo(it))`; parágrafo de preço `De ${brl(preco)} por ${brl(preco_promo)}. Aproveite enquanto durar!`; `preco_de = preco, preco_por = preco_promo`.
  - vitrine: `titulo = limitar(ramo.titulo(it))`; parágrafo `Por ${brl(preco)}.`; `preco_de = null, preco_por = preco`.
  - Vale para os posts de Instagram e Facebook do dia.
- Remove `comOferta`, o "Oferta da semana:" e `oferta()` ("Condição especial…").
- Lista do WhatsApp (só `vender`): item com tratamento → mesmo parágrafo de preço e os mesmos `preco_de/preco_por`; sem tratamento → sem preço.
- Fotos/selo não são assunto daqui.

`validarPost(post, ramo)` passa a recusar (fora de `noPromo`, que continua recusando tudo):
- `preco_por == null` e algum texto com `R$`;
- vitrine (`preco_por != null && preco_de == null`) com `/promo(ção|ções|cional|cionais|s)?|descontos?|\boff\b|black friday/i`.

- [ ] **Step 1: Write the failing tests** (`gerar.test.ts`):
  - `vender: 1 post de preço por item com preço, promoções primeiro, em sextas e sábados` — 4 itens do spec §3 (Gramado 2199/1799, Leste Europeu 10299/9999, Porto Seguro 1999/1999, Portugal sem preço) → 3 dias de feed de preço; os de Gramado e Leste Europeu com `preco_de/preco_por`; Porto Seguro com `preco_de:null, preco_por:1999`; nenhum post com "Portugal" e `R$`.
  - `crescer: no máximo 2 posts de preço`.
  - `noPromo: nenhum preço` (psicologia com `preco` preenchido → nenhum `R$`, todos `preco_* = null`).
  - `mais itens com preço que vagas: corta pelo teto de demo` (20 itens com preço, `vender`).
  - `contagem por rede não muda` (`validarMes` vazio).
  - `validar.test.ts`: vitrine com "promoção" → erro; post sem preço com "R$" → erro; post sem preço com "ofertas" → ok.
  - `trocar-post.test.ts`: troca de um post de preço grava `preco_de/preco_por` do item atual.
- [ ] **Step 2: Run** → FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** `npm test` → PASS. Controlador: `npx supabase functions deploy gerar-mes trocar-post`; rodar `tests/int/gerar-mes.test.js` e `tests/int/trocar-post.test.js`, um por vez → PASS.
- [ ] **Step 5: Commit** `feat: posts de promoção e de vitrine de preço`.

### Task 8: Selo de preço na arte

**Files:**
- Modify: `app/src/cliente/situacao.js` (`pecasDaArte`), `app/src/artes/desenho.js`, `app/src/cliente/calendario.js` (`COLUNAS` + `preco_de, preco_por`), `app/src/textos.js`
- Test: `tests/unit/situacao.test.js`, `tests/unit/artes.test.js`

**Interfaces:**
- Consumes: `post.preco_de`, `post.preco_por` (Task 7).
- Produces: `pecasDaArte(post, negocio, ramo).preco: { de: string | null, por: string } | null` (`'R$ 2.199'`, sem centavos quando inteiros; com `,90` quando houver); `null` se `preco_por` nulo ou `ramo.noPromo`.
- Produces: em `desenho.js`, `seloDePreco(f, preco, tinta)` desenhado por `arteUnica` (feed e vertical) e pela página 1 do carrossel quando `pecas.preco` existe: cápsula na cor principal (`f.b1`/`f.b1i`) acima do título; com `de`, o valor antigo menor e riscado em cima e o novo grande embaixo; sem `de`, só o novo. Ocupa no máximo 40% da largura e não cobre a assinatura.

- [ ] **Step 1: Write the failing tests** — `pecasDaArte` com `{preco_de:2199, preco_por:1799}` → `preco: {de:'R$ 2.199', por:'R$ 1.799'}`; `{preco_por:1999.9}` → `{de:null, por:'R$ 1.999,90'}`; ramo `noPromo` → `null`. `artes.test.js` (canvas falso já usado nos testes): `desenharArte` com `pecas.preco` chama `fillText` com `'R$ 1.799'` e desenha a linha do risco quando há `de`.
- [ ] **Step 2: Run** → FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** `npm test` → PASS; `npm run build` → ok.
- [ ] **Step 5: Commit** `feat: selo de preço na arte`.

### Task 9: Fechamento — revisão, publicação e teste da Karem

- [ ] **Step 1:** Revisão do branch inteiro (subagente revisor) contra o spec; corrigir o que for crítico.
- [ ] **Step 2:** `npm test` e cada arquivo de `tests/int/` um por vez → tudo PASS.
- [ ] **Step 3:** Controlador: `git -c http.sslBackend=schannel push origin v2-etapa3`; conferir no `pat-app.pages.dev` que o bundle tem "Importar lista e fotos".
- [ ] **Step 4:** Karem testa no computador com o arquivo de 4 linhas do spec §3 e umas 10 fotos (`gramado_1.jpg`… e uma `praia_1.jpg` sem item), salva, gera um mês "Vender mais" e confere: post "de/por" de Gramado com selo riscado, vitrine de Porto Seguro, Portugal sem preço.
