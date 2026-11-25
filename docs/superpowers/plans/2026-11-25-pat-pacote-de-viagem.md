# Package details (Turismo) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans (chosen: native + final reviewer). Steps use checkbox (`- [ ]`) syntax.

**Goal:** In the Turismo branch, a package item can carry trip details. Posts with a price draw a CVC-style card (icons, de/por, installments, Pix, WhatsApp badge), and the captions use the details plus a WhatsApp contact line.

**Architecture:** One pure shared module (`_shared/modelos/pacote.ts`) reads, validates and describes the package. The app and the Edge Functions import it. The data lives in `produtos.pacote jsonb` and `negocios.whatsapp text`. The art and the WhatsApp line are built live in the app, from the item and the business. The AI and the template text get `resumoDoPacote` on the server.

**Tech Stack:** vanilla JS (app, canvas), Deno/TS Edge Functions, Postgres, Vitest.

**Spec:** `docs/superpowers/specs/2026-11-25-pat-pacote-de-viagem-design.md`

## Global Constraints
- Branch gate: package fields, card and contact line only when `ramo.id === 'turismo'`. Every other branch stays byte-for-byte unchanged.
- The package is used only when `pacote.ativo === true` (unticking keeps the values).
- Copy (pt-BR, exact):
  - Form labels:
    - `'quiz.item.pacote': 'Detalhes do pacote'`
    - `'quiz.item.pacote.hotel': 'Hotel (opcional)'`
    - `'quiz.item.pacote.ida': 'Ida'`, `'quiz.item.pacote.volta': 'Volta'`
    - `'quiz.item.pacote.transporte': 'Transporte'`, `'quiz.item.pacote.aviao': 'Avião'`, `'quiz.item.pacote.onibus': 'Ônibus'`, `'quiz.item.pacote.sohospedagem': 'Só hospedagem'`
    - `'quiz.item.pacote.transfer': 'Transfer aeroporto ↔ hotel'`
    - `'quiz.item.pacote.inclui': 'Inclui'`, `'quiz.item.pacote.cafe': 'Café da manhã'`, `'quiz.item.pacote.almoco': 'Almoço'`, `'quiz.item.pacote.jantar': 'Jantar'`
    - `'quiz.item.pacote.precopor': 'O preço vale por'`, with the options `pessoa` / `casal` / `noite` / `pacote` labelled `'Pessoa' / 'Casal' / 'Noite' / 'Pacote completo'`
    - `'quiz.item.pacote.parcelas': 'Parcelas (em até quantas vezes)'`
    - `'quiz.item.pacote.taxas': 'Taxas inclusas'`
    - `'quiz.item.pacote.pix': 'Desconto no Pix (%)'`
  - Form errors and warning:
    - `'quiz.item.pacote.erro.volta': 'A volta precisa ser depois da ida.'`
    - `'quiz.item.pacote.erro.parcelas': 'Parcelas: de 2 a 24.'`
    - `'quiz.item.pacote.erro.pix': 'Desconto no Pix: de 1 a 50%.'`
    - `'quiz.item.pacote.passou': 'A data de ida já passou.'`
  - WhatsApp field:
    - `'quiz.whatsapp': 'WhatsApp da empresa (opcional)'`
    - `'quiz.whatsapp.dica': 'Aparece nas artes de pacote e nas legendas, para o cliente chamar você.'`
    - `'quiz.whatsapp.erro': 'Digite o WhatsApp com DDD, só números. Ex.: 83 99999-0000'`
  - Card and caption texts:
    - `'arte.pacote.whats': 'Fale com a loja'`
    - `'legenda.whats.link': 'Chame no WhatsApp: {link}'`, `'legenda.whats.numero': 'Chame no WhatsApp {numero}'`
    - `'whats.mensagem': 'Olá! Vi o pacote {nome} e quero saber mais.'`
- `resumoDoPacote` format (exact pieces, joined by `'; '`, empty pieces skipped):
  - `Hotel {hotel}`
  - `ida {dd/mm/aaaa}, volta {dd/mm/aaaa} ({n} noites|1 noite)`
  - `aéreo` | `rodoviário`
  - `transfer aeroporto–hotel incluso`
  - the meals text + ` incluso`
  - `preço por pessoa|casal|noite` / `preço do pacote completo`
  - `taxas inclusas`
  - `em até {n}x`
  - `{p}% de desconto no Pix`
- Meals text: café only → `Café da manhã`; café+jantar → `Café e jantar`; all 3 → `Pensão completa`. Any other combination: the ticked names joined with `, ` and ` e `, in the order café, almoço, jantar (e.g. `Almoço e jantar`).
- Installments on the card: `em até {n}x de {brl(preco_por / n)} sem juros` (2 decimals, `brl` from `_shared/modelos/gerar.ts` or the app's `dinheiro`).
- WhatsApp: stored as digits only, 10 or 11 digits (DDD + number). Display format `(83) 99999-0000` / `(83) 9999-0000`. Link: `linkWhatsApp('55' + digits, mensagem)` from `app/src/contato.js`.

## Review Focus
1. Package with only some fields filled (for example only the hotel, or only the dates): the card shows just those lines, with no empty lines and no "undefined". Test in Task 1 (`linhasDoCartao` with a partial package) and Task 6.
2. An old item, `pacote` null or a malformed object arriving from the database: nothing breaks and the art is as today. Test in Task 1 (`lerPacote(null)`, `lerPacote({ parcelas: 'x' })`).
3. "Ocultar preço" item: the card without the price block on its promotion-date posts, and no installments or Pix in the caption summary. Test in Task 6 and Task 4.
4. A business with no WhatsApp: no badge and no contact line. Test in Task 5 and Task 6.
5. A long hotel name (80 characters) on stories and feed: it fits (shrinks, max 2 lines) without covering the price. Test in Task 6 (a fake ctx: `cartaoDoPacote` height ≤ the reserved area).

---

### Task 1: shared pure module `pacote.ts`
**Files:** create `supabase/functions/_shared/modelos/pacote.ts`, `tests/unit/pacote.test.ts`.

**Produces:**
- `type Pacote = { ativo: boolean, hotel: string|null, ida: string|null, volta: string|null, transporte: 'aviao'|'onibus'|null, transfer: boolean, refeicoes: { cafe: boolean, almoco: boolean, jantar: boolean }, preco_por: 'pessoa'|'casal'|'noite'|'pacote'|null, parcelas: number|null, taxas: boolean, pix: number|null }`
- `lerPacote(x: unknown): Pacote | null`
  - not an object → null;
  - drops unknown keys and turns invalid values into null/false;
  - hotel trimmed, at most 80 characters, empty becomes null;
  - dates must match `^\d{4}-\d{2}-\d{2}$`; a volta before the ida becomes null;
  - parcelas must be an integer from 2 to 24; pix an integer from 1 to 50.
- `pacoteAtivo(x: unknown): Pacote | null`: `lerPacote` plus `ativo === true`, otherwise null.
- `noitesDoPacote(p): number | null`: the number of days from ida to volta (UTC); null without both dates.
- `textoDasRefeicoes(r): string | null`: the meals text from the Global Constraints.
- `resumoDoPacote(p, { comPreco = true } = {}): string`: the summary. With `comPreco: false` it leaves out the unit, taxes, installments and Pix.
- `linhasDoCartao(p): { icone: 'hotel'|'aviao'|'onibus'|'transfer'|'data'|'refeicao', texto: string }[]`
  - in this order: hotel, transport (`Aéreo` / `Rodoviário`), transfer (`Transfer incluso`), date (`12/12 a 17/12 · 5 noites`, or only `Ida 12/12` when there is no volta), meals.
- `validarPacote(p): string | null`: the error key (`quiz.item.pacote.erro.volta|parcelas|pix`) for raw form values, or null.

- [ ] Tests:
  - `lerPacote(null) === null`
  - `lerPacote({ parcelas: 'x', pix: 90, foo: 1 })` → parcelas null, pix null, no `foo`
  - `noitesDoPacote({ ida:'2026-12-12', volta:'2026-12-17' }) === 5`
  - meals: café → `'Café da manhã'`; café+jantar → `'Café e jantar'`; all three → `'Pensão completa'`; almoço+jantar → `'Almoço e jantar'`; none → null
  - the full `resumoDoPacote` equals `'Hotel Serra Azul; ida 12/12/2026, volta 17/12/2026 (5 noites); aéreo; transfer aeroporto–hotel incluso; café da manhã incluso; preço por pessoa; taxas inclusas; em até 10x; 5% de desconto no Pix'` (meals in lower case inside the summary)
  - `comPreco:false` leaves out the last four pieces
  - `linhasDoCartao({ ...vazio, hotel:'X' })` → only `[{icone:'hotel', texto:'X'}]`
  - `validarPacote` with volta < ida → `'quiz.item.pacote.erro.volta'`
- [ ] Implement it. `npx vitest run tests/unit/pacote.test.ts` green. Commit `feat(turismo): módulo do pacote de viagem`.

### Task 2: column `produtos.pacote` and the form in the item card
**Files:**
- Create `supabase/migrations/20261126000001_pacote_de_viagem.sql`:
  ```sql
  alter table public.produtos add column pacote jsonb check (pacote is null or jsonb_typeof(pacote) = 'object');
  alter table public.negocios add column whatsapp text check (whatsapp is null or whatsapp ~ '^\d{10,11}$');
  ```
- Modify:
  - `app/src/cliente/perguntas.js`: `estadoDoNegocio` item `pacote: lerPacote(p.pacote)`; a new `caixaDoPacote(item, ramo)` after `caixaOcultarPreco`, only when `ramo.id === 'turismo'`;
  - `app/src/cliente/negocio.js`:
    - `validarItens` calls `validarPacote` and returns its key;
    - `itensParaSalvar` adds `pacote: ramo.id === 'turismo' ? lerPacote(i.pacote) : null`;
    - `salvarItens` writes it;
    - `carregarNegocio` selects `pacote` and `whatsapp`;
  - `app/src/cliente/refazerPost.js`: `itemParaGravar` and `itensMudaram` include `pacote`;
  - `app/src/textos.js`, `app/src/estilo.css` (reuse `.promo-data`, `.caixinha`, `.precos`).
- Tests: `tests/unit/perguntas.test.js`, `tests/unit/negocio.test.js`, `tests/unit/refazerPost.test.js`.

**Form behavior:**
- Box unticked → fields hidden, `pacote.ativo=false` (the values are kept).
- Transport is 3 radios: Avião / Ônibus / Só hospedagem (`null`).
- "O preço vale por" is a `<select>` with an empty first option.
- An ida date in the past shows `quiz.item.pacote.passou` (muted).

- [ ] Tests:
  - `estadoDoNegocio` reads `pacote` from the product;
  - `itensParaSalvar` in turismo keeps `pacote`, and in beleza saves `pacote: null`;
  - `validarItens` with volta < ida → `'quiz.item.pacote.erro.volta'`;
  - the turismo item card has the checkbox `#pacote-<id>`, and the beleza card does not;
  - `itemParaGravar` includes `pacote`.
- [ ] Implement it, then `npx vitest run` green. Commit `feat(turismo): detalhes do pacote no cadastro do item`.

### Task 3: WhatsApp field in Meu negócio
**Files:** `app/src/contato.js` (add `normalizarWhatsApp(texto): string|null|undefined` and `formatarWhatsApp(digitos): string`), `app/src/cliente/perguntas.js` (field in the `marca` question, below the signature choice; `estadoDoNegocio.whatsapp`), `app/src/cliente/negocio.js` (`salvarDadosNegocio` writes `whatsapp`), `app/src/textos.js`. Tests: `tests/unit/contato.test.js`, `tests/unit/perguntas.test.js`.

**Rules:**
- `normalizarWhatsApp`:
  - removes non-digits and a leading `55` when 12 or 13 digits remain;
  - empty → `null`;
  - not 10 or 11 digits → `undefined` (invalid; the screen shows `quiz.whatsapp.erro` and does not advance).
- `formatarWhatsApp('83999990000') === '(83) 99999-0000'` and `formatarWhatsApp('8333330000') === '(83) 3333-0000'`.
- The `marca` question summary appends the formatted number when there is one.

- [ ] Tests:
  - `normalizarWhatsApp('+55 (83) 99999-0000') === '83999990000'`
  - `normalizarWhatsApp('') === null`
  - `normalizarWhatsApp('123') === undefined`
  - the two `formatarWhatsApp` cases
  - `salvarDadosNegocio` sends `whatsapp` (fake supabase)
- [ ] Implement it, then `npx vitest run` green. Commit `feat: WhatsApp da empresa no Meu negócio`.

### Task 4: server — the AI and the template text use the package
**Files:**
- `supabase/functions/_shared/ia/escrever.ts`: `EntradaPost.produto` gets `pacote?: string | null` (the summary already written).
  - When it is set, add the line `Detalhes do pacote (use só estes fatos, não invente outros): {resumo}.`.
- `supabase/functions/_shared/ia/entrada.ts`: `DadosDoCliente.produtos[]` gets `pacote?: unknown`. `montarEntradaPost` fills `produto.pacote` with `resumoDoPacote(pacoteAtivo(p.pacote), { comPreco: post.preco_por != null })` when `c.ramo === 'turismo'` and the package is active; otherwise null.
- `supabase/functions/_shared/modelos/gerar.ts`:
  - `Pacote['produtos'][]` gets `pacote?: unknown`;
  - in the price posts (promo and vitrine) of a turismo item with an active package, the price paragraph becomes `${texto} ${resumoDoPacote(p, { comPreco: true })}.`;
  - on the promotion-date posts of an item without a price, append the summary with `comPreco:false` to the middle paragraph.
- The product selects in `gerar-mes`, `refazer-posts`, `trocar-estrategia`, `trocar-post`, `melhorar-posts` and `reescrever-post` (the `index.ts` files) add `pacote`.
  - `precosVisiveis` keeps `pacote`; the summary drops the price part when `ocultar_preco` is set, because `preco_por` is null.
- Tests: `tests/unit/ia-escrever.test.ts`, `tests/unit/gerar.test.ts`, `tests/unit/melhorar-posts.test.ts`.

- [ ] Tests:
  - `'pacote ativo vai para o pedido da IA'`: the prompt contains `'Detalhes do pacote'` and `'Hotel Serra Azul'`;
  - an inactive package or another branch → the prompt does not contain it;
  - gerar turismo with the package → the price post's legenda contains `'transfer aeroporto–hotel incluso'`;
  - an item with ocultar_preco → the legenda contains no `'em até'`.
- [ ] Implement it, then `npx vitest run` green. Commit `feat(turismo): IA e textos de modelo usam os detalhes do pacote`.

### Task 5: WhatsApp contact line in the caption
**Files:** `app/src/cliente/mes.js` (`textoParaCopiar(post, contexto?)`), `app/src/cliente/post.js` (passes `{ negocio, produtos, ramo }` and shows the line below the legenda), `tests/unit/mes.test.js`.

**Produces:** `linhaDoWhatsApp(post, { negocio, produtos, ramo }): string | null`. It returns a value only when all of these hold:
- the branch is turismo;
- `negocio.whatsapp` is set;
- the post's item has an active package.

The line by network:
- `facebook` / `whatsapp` → `t('legenda.whats.link', { link: linkWhatsApp('55'+n, t('whats.mensagem', { nome })) })`;
- `instagram` / `tiktok` → `t('legenda.whats.numero', { numero: formatarWhatsApp(n) })`.

`textoParaCopiar` puts the line after the legenda and before the hashtags. With no context, it behaves as today.

- [ ] Tests:
  - instagram → contains `'Chame no WhatsApp (83) 99999-0000'`;
  - facebook → contains `'https://wa.me/5583999990000?text='`;
  - no whatsapp → null;
  - beleza → null;
  - `textoParaCopiar(post)` without context is unchanged.
- [ ] Implement it, then `npx vitest run` green. Commit `feat(turismo): legenda com o WhatsApp da empresa`.

### Task 6: the package card in the art
**Files:**
- `app/src/cliente/situacao.js`: `pecasDaArte(post, negocio, ramo, produtos = [])` adds `pecas.pacote`.
- `app/src/artes/imagens.js`: passes `produtos` in both calls.
- `app/src/artes/desenho.js`: `cartaoDoPacote`, the vector icons, and a change to `desenharArte`.
- `app/src/artes/texto.js`: the carousel page count when there is `pecas.pacote` without a price, if needed.
- Tests: `tests/unit/situacao.test.js`, `tests/unit/artes.test.js`.

**Produces:** `pecas.pacote = { linhas: linhasDoCartao(p), unidade: string|null, parcelas: string|null, pix: string|null, whatsapp: string|null } | null`. It is set when:
- the branch is turismo, and the post's item has an active package; and
- either `post.preco_por != null`, or `produto.ocultar_preco` is set and `post.ocasiao` is set (the item's promotion-date posts).

The pieces:
- `unidade`: `'por pessoa'|'por casal'|'por noite'|'pacote completo'`, plus `' · taxas inclusas'` when taxes are included;
- `parcelas`: the installment text (only with a price);
- `pix`: `'5% de desconto no Pix'` (only with a price);
- `whatsapp`: `formatarWhatsApp(negocio.whatsapp)` or null.

**Drawing:**
- `desenharArte` sends a post with `pecas.pacote` to the price path: `if (arte && !pecas.preco && !pecas.pacote)`.
- In `arteUnica` and `paginaDoCarrossel`, when there is `pecas.pacote`, `cartaoDoPacote(f, pecas, tinta, y)` replaces `seloDePreco`.
  - Card content: the icon lines; then the price block from today's `seloDePreco` (when `pecas.preco`), with the unit below it; then installments and the Pix pill (green `#25D366`, dark text); then the WhatsApp pill (green, white icon and text `Fale com a loja · (83) 99999-0000`).
  - Panel: semi-transparent dark (`rgba(0,0,0,.55)`) with white text, so it reads on any photo.
  - Height: `medirCartao(f, pecas)` reserves space just as `medirSelo` does.
- Icons: `Path2D` from simple SVG paths, 24-unit viewBox, drawn at 1 line height (no emoji).

- [ ] Tests:
  - `pecasDaArte` turismo with an active package and a price → `pecas.pacote.linhas[0].icone === 'hotel'` and `pecas.pacote.parcelas === 'em até 10x de R$ 239,00 sem juros'` (preco_por 2390);
  - beleza → `pecas.pacote === null`;
  - ocultar_preco + ocasiao → pacote without parcelas/pix;
  - no whatsapp → `whatsapp === null`;
  - `desenharArte` with `pecas.pacote` and `arte` set does not call the family (fake ctx: it draws the panel);
  - `medirCartao` with an 80-character hotel name on 1080×1920 fits in `H * 0.5`.
- [ ] Implement it. `npx vitest run` and `npm run build` green.
- [ ] Look at a real render: draw on a canvas in the browser preview (`npm run dev`), or ask Karem after publishing.
- [ ] Commit `feat(turismo): cartão do pacote na arte`.

### Task 7: publishing (controller)
- `npx supabase db push --linked --yes`.
- Deploy `gerar-mes`, `refazer-posts`, `trocar-estrategia`, `trocar-post`, `melhorar-posts` and `reescrever-post`.
- `git -c http.sslBackend=schannel push origin v2-etapa3`.
- Final review by one fresh reviewer.
