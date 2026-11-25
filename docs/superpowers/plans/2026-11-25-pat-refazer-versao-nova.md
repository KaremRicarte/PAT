# "Refazer" com versão nova — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans (escolhido: nativo + revisor final). Steps use checkbox (`- [ ]`) syntax.

**Goal:** "Refazer este post" suggests a new photo (or asks the user to upload one), then asks whether to redo only the post or the whole day; the redone posts get a new photo and new text, without repeating the previous title.

**Architecture:**
- The server function `refazer-posts` takes `{ post_id, foto_path?, dia? }`.
  - It redoes the post, or every not-yet-posted post of that day.
  - It saves `titulo_anterior`.
  - For the posts that should get another photo, it records the current photo in `fotos_usadas` and sets `foto_path` to null. The AI's rotation (`melhorar-posts`, which already exists) then picks the least-used photo.
- `melhorar-posts` passes `titulo_anterior` to the AI's input.
- The app computes the suggested photo, uploads a new photo into the item, and shows the "O que refazer?" question.

**Tech Stack:** vanilla JS (app), Deno/TS Edge Functions, Postgres, Vitest.

**Spec:** `docs/superpowers/specs/2026-11-25-pat-refazer-versao-nova-design.md`

## Global Constraints
- Copy (pt-BR, exact):
  - `'refazer1.foto.titulo': 'Foto sugerida'`
  - `'refazer1.foto.outra': 'Escolher outra foto'`
  - `'refazer1.foto.manter': 'Manter a foto atual'`
  - `'refazer1.foto.mantida': 'A foto atual fica; só o texto muda.'`
  - `'refazer1.foto.uma': 'Este item só tem 1 foto. Envie outra para os posts variarem; se não, o PAT refaz só o texto.'`
  - `'refazer1.foto.nenhuma': 'Este item ainda não tem foto. Envie uma para os posts terem imagem; se não, o PAT refaz só o texto.'`
  - `'refazer1.foto.enviar': 'Enviar nova foto'`
  - `'refazer1.qual.titulo': 'O que refazer?'`
  - `'refazer1.qual.este': 'Só este post'`
  - `'refazer1.qual.dia': 'Todos os posts do dia {dia} ({n})'`
- Item photo limit: `MAX_FOTOS` (12). If the item is full, "Enviar nova foto" does not show up.
- Only photos inside the client's folder (`<uid>/`) are accepted as `foto_path`. Otherwise: 400 `'Foto inválida.'`.
- Already posted (`postado_em`) and past-day posts are never redone. Approved posts go back to `estado: 'gerado'`.

## Review Focus
1. A chosen `foto_path` from another client (outside `<uid>/`) must be refused. Test in Task 2.
2. "Todos do dia" with a post of the day already posted: that post stays untouched. Test in Task 2.
3. "Manter a foto atual" (`foto_path` absent) on the clicked post: keeps the current photo and does **not** record usage of it. Test in Task 2.
4. A post of the day with a photo the client chose by hand ("Trocar foto", in `<uid>/posts/`): in the "dia" mode it also gets a new photo (from the item) — expected behavior, since the user asked to redo everything. Test in Task 2.
5. A general post (without an item) in the "dia" mode: `foto_path` becomes null and its old photo is recorded as used, so the AI picks another image. Test in Task 2.

---

### Task 1: column `titulo_anterior` and the AI avoids repeating it
**Files:**
- Create `supabase/migrations/20261125000001_titulo_anterior.sql` (`alter table public.posts add column titulo_anterior text;`).
- Modify `supabase/functions/_shared/ia/entrada.ts`:
  - `LugarDoPost` gets `titulo_anterior?: string | null`;
  - `montarEntradaPost` fills `evitar: post.titulo_anterior ?? null`.
- Modify `supabase/functions/_shared/ia/escrever.ts`:
  - `EntradaPost.evitar?: string | null`;
  - in the prompt, after the template text, when `evitar` is set: `'', '# Título que este post já teve (escreva outro: não repita este título nem a mesma abertura)', e.evitar`.
- Modify `supabase/functions/melhorar-posts/acoes.ts`: `PostDaFila.titulo_anterior?: string | null` (it already comes from `pegar_posts_para_ia`, which returns `setof posts`).
- Tests (`tests/unit/ia-escrever.test.ts` or the file that tests the prompt; `tests/unit/melhorar-posts.test.ts`):
  - `'com titulo_anterior, o pedido de escrita traz o título a evitar'`: the prompt text contains `'não repita este título'` and the old title;
  - without it, it does not contain that.
- Commit: `feat(ia): o post refeito não repete o título anterior`.

### Task 2: `refazer-posts` with photo and "dia" mode
**Files:** `supabase/functions/refazer-posts/acoes.ts`, `supabase/functions/refazer-posts/index.ts`, `tests/unit/refazer-posts.test.ts`.

**Interfaces:**
- Input: `{ post_id: uuid, foto_path?: string, dia?: boolean }`.
  - `foto_path` absent = keep the current photo.
  - `foto_path` must start with `${cliente.id}/`.
- `PostQueFalta` gets `titulo: string`. `postsQueFaltam` selects `titulo` too.
- `DepsRefazer` gets `marcarUsadas: (paths: string[]) => Promise<void>`: insert into `fotos_usadas` (cliente_id = the client).
- `CamposRefeitos` gets `titulo_anterior: string | null`.
- Response: `{ refeitos: number }`.

**Rules:**
- Targets:
  - without `dia`: only the post;
  - with `dia`: every post in `postsQueFaltam(hoje)` with the same `data` as the post, which includes it.
- For each target, call `refazerUmPost(pacote of the target's month, target)`. A post rejected by validation is skipped (log), as in the "modo" path. If **the clicked post** fails, return 422/500 as today.
- Fields of each refeito: same as today, plus `titulo_anterior: target.titulo`, `estado: 'gerado'`, `origem: 'modelo'`, `ia_estado: 'fila'`.
- Photo:
  - **clicked post:**
    - with `foto_path` given → `foto_path: dado, sem_foto: false`;
    - without it → as today (keeps it when the item is the same);
  - **the other posts of the day:**
    - `foto_path: null`, keeping `sem_foto` when the branch is textOnly;
    - their current `foto_path` (if any) goes to `marcarUsadas`.
  - The clicked post with a new `foto_path` also records its **old** photo in `marcarUsadas`. With "manter", nothing is recorded.
- `marcarUsadas` runs once, with all the paths, after `gravar`. An error is logged and does not fail the response.

- [ ] Tests:
  - `'dia: refaz os posts do mesmo dia que faltam, com titulo_anterior'`: 3 posts on 2026-11-25 (one already in the list with `postado_em` is not returned by `postsQueFaltam`, by definition) plus 1 post on 2026-11-26. Result: `refeitos: 3`; only the 25th's posts are saved; each one has `titulo_anterior` equal to its old title.
  - `'foto escolhida vai para o post clicado; os outros do dia ficam sem foto e as fotos antigas são marcadas como usadas'`.
  - `'manter a foto (sem foto_path): o post clicado mantém a foto e não marca uso'`.
  - `'foto de outro cliente: 400 Foto inválida.'`
  - `'post geral no modo dia: foto_path null e a foto antiga marcada'`.
  - `'sem dia: comportamento de hoje + titulo_anterior'` (update the existing tests of the single-post path to the new field).
- [ ] Implement it. In `index.ts`: `marcarUsadas` → `db.from('fotos_usadas').insert(paths.map((path) => ({ cliente_id: quem.id, path })))`.
- [ ] `npm test` green. Commit: `feat: refazer o post ou o dia inteiro com foto nova`.

### Task 3: app — suggested photo, "Enviar nova foto" and the "O que refazer?" question
**Files:** `app/src/cliente/refazerPost.js`, `app/src/cliente/post.js` (passes `ctx.posts`, already in ctx), `app/src/textos.js`, `app/src/estilo.css`, `tests/unit/refazerPost.test.js`.

**Interfaces (pure ones, in `refazerPost.js`, tested):**
- `fotoSugerida(fotosDoItem: string[], atual: string | null): string | null`: the next one after `atual` in the list, cycling. If `atual` is not in the list → the first one that differs from `atual`. Returns null if there is no photo other than `atual`.
- `postsDoDia(posts, post): object[]`: posts with `data === post.data` and without `postado_em` (includes the post itself).
- `corpoDoRefazer({ postId, foto, dia }): object`: `{ post_id }`, plus `foto_path` only when `foto` is a string, plus `dia: true` only when `dia`.

**Screen:**
- Photo block (posts of an item that is not textOnly):
  - **≥ 2 photos that serve** (`fotosDoProduto(produto, ctx.fotosInfo)`): title "Foto sugerida", a thumbnail of the suggested photo (reuse the thumbnail drawing from `trocarFoto.js`; export `desenharMini` if needed), and the buttons:
    - "Escolher outra foto" → `abrirTrocaDeFoto` with `aoEscolher`. Accept only `{ foto_path }` or `{ arquivo }`; an `arquivo` goes the "Enviar nova foto" way;
    - "Manter a foto atual" → `foto = null` and the text "A foto atual fica; só o texto muda.".
  - **0 or 1 photo:** the warning (`refazer1.foto.uma` / `refazer1.foto.nenhuma`) and the "Enviar nova foto" button (`input type=file accept=image/*`).
  - When sending a photo, before calling the function: `reduzirFoto(arquivo, FOTO_MAX, 'image/jpeg')`, then `resumoDoArquivo(arquivo)`, upload to `${uid}/produtos/${produto.id}/${hash}.jpg` (`upsert: true`), and append it to `produtos.fotos` (no duplicates, ≤ `MAX_FOTOS`). This becomes the chosen `foto`.
- On "Refazer" (after validating and saving the item, as today):
  - if `postsDoDia(ctx.posts ?? [], post).length > 1`, open a `<dialog>` "O que refazer?" with the 3 buttons; the text of the day uses `diaMes(post.data)` and n;
  - otherwise go straight to "só este".
  - Call `refazer-posts` with `corpoDoRefazer`.
- CSS: the thumbnail is 96 px with the buttons beside it; on a narrow screen the buttons go below it.

- [ ] Tests:
  - `fotoSugerida(['a','b','c'], 'b') === 'c'`
  - `fotoSugerida(['a','b','c'], 'c') === 'a'`
  - `fotoSugerida(['a'], 'a') === null`
  - `fotoSugerida(['a','b'], 'x') === 'a'`
  - `fotoSugerida([], null) === null`
  - `postsDoDia`: filters by date and leaves out the posted ones;
  - `corpoDoRefazer`: `{ postId: 'p', foto: null, dia: false }` → `{ post_id: 'p' }`, and `{ postId: 'p', foto: 'u/x.jpg', dia: true }` → `{ post_id: 'p', foto_path: 'u/x.jpg', dia: true }`.
- [ ] Implement it. `npm test` and `npm run build` green. Commit: `feat(app): Refazer sugere foto nova e pergunta se refaz o post ou o dia`.

### Task 4: publishing (controller)
- `db push` (migration), deploy `refazer-posts` and `melhorar-posts`, push of `v2-etapa3`. Live test: redo the day 25/11 of Malibu with "dia" and check that the 5 posts went back to the queue with `titulo_anterior` and got distinct photos.
