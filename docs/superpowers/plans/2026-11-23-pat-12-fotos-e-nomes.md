# Até 12 fotos por item, nomes de arquivo e revezamento — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Each item can have up to 12 photos. Photo file names find the right item. Repeated items and repeated photos are blocked. Photos rotate across months, with the least recently used first.

**Architecture:** Client-side changes go in the pure functions of `app/src/cliente/importar.js` and `negocio.js` (import, validation, saving). The cap goes from 6 to 12 in the app and in the database. The rotation gets one shared helper (`indiceDoRevezamento` in `_shared/ia/imagens.ts`), used by the app (`fotoDoPost`) and by the server (`fotoDoLugar`). In `melhorar-posts`, the item post prefers the photos the client used least recently. That information comes from the existing `fotos_usadas` table.

**Tech Stack:** Vanilla JS + Vite (app), Deno/TypeScript (Supabase Edge Functions), Postgres (migrations), Vitest (`npm test`, files in `tests/unit/`).

**Spec:** `docs/superpowers/specs/2026-11-23-pat-12-fotos-e-nomes-design.md`

## Global Constraints

- Limit: **12 photos per item** (the constant `MAX_FOTOS`). "Minhas fotos" (`MAX_FOTOS_NEGOCIO = 30`) does not change.
- Name comparison: ignore case, accents, spaces, `_`, `-` and any non-alphanumeric character (the current `normalizarNome`). Different spellings (k × c) are **not** synonyms.
- Do not use an external drive. The photos stay in the `marcas` bucket.
- Do not touch the client's existing data (Malibu). The new warning shows up the next time she saves.
- Interface copy in pt-BR, short and plain (see the textos in each task).
- Stable rotation: the same post shows the same photo as long as nothing changes (same photos, same date/order).

## Review Focus

1. A descriptive suffix that used to work (`gramado_praca.jpg` → Gramado) must keep working. Covered in Task 2.
2. An item whose name contains a number (`Pacote 2027`) with the file `pacote_2027_01.jpg` must go to that item. Covered in Task 2.
3. Two Gramado posts processed in the same batch of the queue (`Promise.all`) must not get the same photo when there are others available. Covered in Task 5.
4. An item with 12 photos: the 13th file is refused, and the same photo imported again does not count as the 13th. Covered in Tasks 1 and 4.
5. A month change must shift the rotation with 6, 8 and 12 photos (no `n` may "freeze" on the same photos). Covered in Task 5.

---

### Task 1: 12-photo limit (app and database)

**Files:**
- Modify: `app/src/cliente/negocio.js:7` (`MAX_FOTOS = 12`)
- Modify: `app/src/textos.js:234` (`'quiz.itens.fotos': 'Cada item pode ter no máximo 12 fotos.'`)
- Create: `supabase/migrations/20261123000001_doze_fotos.sql`
- Test: `tests/unit/negocio.test.js`, `tests/unit/importar.test.js`

**Interfaces:** Produces `MAX_FOTOS === 12` (imported by `importar.js`, `importarTela.js`).

- [ ] **Step 1: Tests.** In `negocio.test.js`, add the test `'validarItens aceita 12 fotos e recusa 13'`: an item with 12 `{ path }` returns `null`, and with 13 it returns `'quiz.itens.fotos'`. In `importar.test.js`, add `'13ª foto vai para foraFotos'`: an item with 11 photos plus files `gramado_1.jpg`, `gramado_2.jpg` and `gramado_3.jpg` → `resumo.fotos === 1`, and `resumo.foraFotos` equals `['gramado_2.jpg', 'gramado_3.jpg']`. Update any existing test that relies on 6.
- [ ] **Step 2:** `npx vitest run tests/unit/negocio.test.js tests/unit/importar.test.js`. It must fail on the new tests.
- [ ] **Step 3:** Change the constant and the text. Migration: first find the real name of the constraint (`select conname from pg_constraint where conrelid = 'public.produtos'::regclass and contype = 'c';`, probably `produtos_fotos_check`). Then: `alter table public.produtos drop constraint <nome>; alter table public.produtos add constraint produtos_fotos_check check (cardinality(fotos) <= 12);`. Use `grep -rn "6" app/src/textos.js | grep -i foto` and confirm no other text mentions 6 photos.
- [ ] **Step 4:** Run the same command again. It must pass. Then `npm test`: everything green.
- [ ] **Step 5: Commit** `feat: até 12 fotos por item`.

### Task 2: File names find the right item

**Files:**
- Modify: `app/src/cliente/importar.js` (`chaveDaFoto` → `chavesDaFoto`, and its use in `juntarImportacao`)
- Modify: `app/src/textos.js:272` (`importar.como.fotos`)
- Test: `tests/unit/importar.test.js`

**Interfaces:**
- Produces `chavesDaFoto(nomeArquivo: string): string[]`. These are the candidate keys, from most specific to least, already normalized and without repeats. `chaveDaFoto` goes away (update the import in the test).

Algorithm (the body is not obvious):
1. Remove the extension (`/\.[^.]*$/`).
2. Remove the numbering at the end: `/[\s_-]*\(?\d+\)?$/`, applied once. Only remove it if something remains. If the name is just a number, keep it.
3. Split what remains on `_`. The candidates are the parts joined from the first one, from all of them down to only the first (`a_b_c` → `abc`, `ab`, `a`). Each joined result goes through `normalizarNome`. Drop empty ones and repeats.
4. As the **first** candidate, also add the normalized full name with only the extension removed. This keeps an item with a number in its name working, such as `Pacote 2027` → `pacote2027`. Only add it when it differs from the others.

In `juntarImportacao`, the item is the first candidate found in `porChave`. For `semItem`/`foraDaLista`, use the candidate from step 3 (all the parts).

- [ ] **Step 1: Test** `'chavesDaFoto: sinônimos e sufixos'`:
  - `chavesDaFoto('october_fest_01.jpg')[...]` contains `'octoberfest'` before `'october'`;
  - in a `juntarImportacao` with items `October Fest` and `Gramado`, the files `october_fest_01.jpg`, `Octoberfest-2.JPG`, `october fest (3).jpg`, `OCTOBERFEST.jpg` and `gramado_praca.jpg` → 4 photos in October Fest and 1 in Gramado, with `semItem` empty;
  - with an item `Pacote 2027`, the files `pacote_2027_01.jpg` and `Pacote 2027.jpg` → both go to it;
  - `Leste-Europeu_1.JPG` → Leste Europeu (the old case keeps working).
- [ ] **Step 2:** `npx vitest run tests/unit/importar.test.js`. It must fail.
- [ ] **Step 3:** Implement it, and change the text to: `'As fotos vão para o item com o mesmo nome do arquivo, sem contar o número do fim. Maiúsculas, acentos, espaços, "_" e "-" não fazem diferença. Exemplo: gramado_1.jpg e Gramado-2.jpg vão para Gramado; october_fest_01.jpg e Octoberfest.jpg vão para October Fest. Nada é gravado antes de você tocar em Salvar.'`
- [ ] **Step 4:** Run it again: it must pass. Then `npm test` (including `importarTela.test.js`).
- [ ] **Step 5: Commit** `fix(importar): nome do arquivo acha o item mesmo com "_" no nome`.

### Task 3: Repeated items

**Files:**
- Modify: `app/src/cliente/negocio.js` (receives `normalizarNome`, `validarItens` with a new rule)
- Modify: `app/src/cliente/importar.js` (imports `normalizarNome` from `negocio.js` and re-exports it: `export { normalizarNome } from './negocio.js'`)
- Modify: `app/src/textos.js` (new key)
- Test: `tests/unit/negocio.test.js`

**Interfaces:** `normalizarNome(s): string` now lives in `negocio.js` (same behavior). `validarItens` can return `'quiz.itens.repetido'`.

- [ ] **Step 1: Test** `'validarItens recusa nomes iguais depois de normalizar'`: items `October Fest` and `october-fest` → `'quiz.itens.repetido'`. `Gramado` and `Gramado no Natal` → `null`. The rule runs after the name check (`quiz.itens.nome`) and before the price checks.
- [ ] **Step 2:** Run `negocio.test.js`. It must fail.
- [ ] **Step 3:** Implement it. Text: `'quiz.itens.repetido': 'Há dois itens com o mesmo nome. Apague um deles ou junte as fotos num só.'`. Check (`grep -rn "validarItens" app/src`) that every screen that shows the key from `validarItens` uses `t(chave)` without needing a change.
- [ ] **Step 4:** `npm test`, green.
- [ ] **Step 5: Commit** `feat: não deixa salvar dois itens com o mesmo nome`.

### Task 4: The same photo imported again does not repeat

**Files:**
- Modify: `app/src/cliente/importar.js` (`resumoDoArquivo` + `juntarImportacao`)
- Modify: `app/src/cliente/importarTela.js:~140` (computes the summaries before `juntarImportacao`)
- Modify: `app/src/cliente/negocio.js` (`salvarItens`: path by summary)
- Test: `tests/unit/importar.test.js`, `tests/unit/negocio.test.js`

**Interfaces:**
- Produces `resumoDoArquivo(arquivo: Blob): Promise<string>`: SHA-256 of the **original** bytes (`crypto.subtle.digest`), in hex, first 32 characters.
- `juntarImportacao(itens, { linhas, erros, arquivosDeFoto, hashes }, opcoes)`: `hashes` is an optional `Map<File, string>`. The new photo becomes `{ arquivo, nome, hash }`. The photo is silently ignored (not counted in `fotos` or `foraFotos`) when the item already has a photo whose `path` ends in `/${hash}.jpg`, or a new photo in the batch with the same `hash`. The duplicate check comes **before** the 12-photo check.
- `salvarItens`: a photo with `f.hash` is saved at `${uid}/produtos/${i.id}/${f.hash}.jpg`. Without it, `crypto.randomUUID()` as before.

- [ ] **Step 1: Tests.**
  - `importar`: `'mesma foto (mesmo hash) não entra duas vezes'`. The item has the photo `{ path: 'u/produtos/i1/abc.jpg' }`; files `a.jpg` and `b.jpg` with hashes `abc` and `def`, plus `c.jpg` with hash `def` → only `b.jpg` goes in, `resumo.fotos === 1`, and `foraFotos` is empty.
  - `'item cheio com foto repetida: a repetida não vai para foraFotos'`.
  - `resumoDoArquivo(new Blob(['x']))` resolves to 32 hex characters, and it is equal for two equal Blobs.
  - `negocio`: in `salvarItens` with the fake Supabase already used in `negocio.test.js`, the photo `{ arquivo, hash: 'abc' }` is sent to the path `.../produtos/<id>/abc.jpg`.
- [ ] **Step 2:** Run both files. They must fail.
- [ ] **Step 3:** Implement it. In `importarTela.js`, compute `new Map(await Promise.all(fotos.map(async (f) => [f, await resumoDoArquivo(f)])))` and pass it as `hashes`. If the summary fails (old browser), import without `hashes`, as today.
- [ ] **Step 4:** `npm test`, green.
- [ ] **Step 5: Commit** `feat(importar): a mesma foto importada de novo não ocupa vaga`.

### Task 5: Rotation across months (app and server)

**Files:**
- Modify: `supabase/functions/_shared/ia/imagens.ts` (`indiceDoRevezamento`, `fotoDoLugar` gets `data`)
- Modify: `app/src/cliente/situacao.js:109-123` (`fotoDoPost` uses the helper for the item post and for the general post)
- Modify: `supabase/functions/melhorar-posts/acoes.ts` (types `DepsMelhorar`; branch `else if (post.produto_id)` ~line 237; usage record after `gravar`)
- Modify: `supabase/functions/melhorar-posts/index.ts` (`ultimoUso`, `reservar`)
- Test: `tests/unit/ia-imagens.test.ts`, `tests/unit/situacao.test.js`, `tests/unit/melhorar-posts.test.ts`

**Interfaces:**
- Produces `indiceDoRevezamento(ordem: number | null | undefined, data: string | null | undefined, n: number): number`. It returns `-1` if `n <= 0`. Otherwise `(ordem ?? 0) + mes * 31` modulo `n`, where `mes = ano * 12 + (mês - 1)` comes from `data` (`'AAAA-MM-DD'`), and `0` when there is no valid date. 31 is prime and larger than 12, so the jump between months is never a multiple of `n` and the rotation always shifts. It behaves as if the order continued from one month to the next.
- `fotoDoLugar({ post: { ..., data?: string | null }, ... })` and `fotoDoPost` use `indiceDoRevezamento` instead of `ordem % n` (the general post with 1 photo keeps the `[foto, null]` cycle).
- `DepsMelhorar` gains:
  - `ultimoUso: (clienteId: string, paths: string[]) => Promise<Record<string, string>>`: the most recent `usado_em` per path in `fotos_usadas`, or missing if never used. In `index.ts`: `select path, usado_em ... in('path', pedaço)`, keeping the largest per path, in chunks of `PEDACO`.
  - `reservar: (clienteId: string, path: string) => boolean`: a `Set` created in `criarDeps` (one per run). It returns `false` if the path was already reserved in this run.
- The existing `registrarUsada(clienteId, path)` is also called with the path of the **client's** item photo after `gravar` returns `true`. Log the error and do not fail the post.

Order in the item post's branch (replaces the `for` loop with `fotoDoLugar`):
1. `lista` = photos of the item that serve (not rejected), rotated so that `lista[0]` is the one from `indiceDoRevezamento(post.ordem, post.data, n)`.
2. `uso = await deps.ultimoUso(clienteId, lista)`. Stable sort: never used first, then oldest `usado_em`. Ties keep the order from step 1.
3. Go through the list: skip the ones `deps.reservar` refuses (unless all are reserved; then use the first in the order), and the ones `descrita()` rejects now (`serve === false`). The first that passes is the post's photo.

- [ ] **Step 1: Tests.**
  - `ia-imagens`: `'indiceDoRevezamento muda de mês para mês'`. For `n` in `[6, 8, 12]`, `indiceDoRevezamento(3, '2026-11-10', n) !== indiceDoRevezamento(3, '2026-12-10', n)`. Also `indiceDoRevezamento(3, null, 8) === 3` and `indiceDoRevezamento(0, '2026-11-01', 0) === -1`.
  - `ia-imagens`: the current `fotoDoLugar` tests keep passing (without `data`, the behavior is the same as today).
  - `situacao`: `'fotoDoPost: mesmo item, mesma ordem, meses diferentes → fotos diferentes'` (item with 8 photos).
  - `melhorar-posts`: `'post de item prefere a foto nunca usada'`. Item `[a, b, c]`, `ultimoUso` returns `{ a: '2026-11-01', b: '2026-10-01' }` → it saves `c` and calls `registrarUsada(UID, c)`.
  - `melhorar-posts`: `'dois posts do mesmo item no mesmo lote não pegam a mesma foto'`. Two `melhorarUmPost` calls with the same `deps` (`reservar` with a real Set) → different `foto_path`.
  - `melhorar-posts`: `'post de item com foto escolhida pelo cliente não muda nem registra uso de outra'` (the `post.foto_path` branch stays as it is).
- [ ] **Step 2:** `npx vitest run tests/unit/ia-imagens.test.ts tests/unit/situacao.test.js tests/unit/melhorar-posts.test.ts`. It must fail on the new tests.
- [ ] **Step 3:** Implement the helper, `fotoDoLugar`/`fotoDoPost`, the deps and the branch. Make sure every `fotoDoLugar` call site in the server passes `data` (`grep -rn "fotoDoLugar" supabase/functions`). Update the comment on the `fotos_usadas` table in `index.ts`/`acoes.ts` (it now also covers the client's photos, not only the bank's).
- [ ] **Step 4:** `npm test`, all green. Then `npx tsc --noEmit -p supabase/functions` or `deno check supabase/functions/melhorar-posts/index.ts` (whichever the project already uses; see `package.json`/earlier specs).
- [ ] **Step 5: Commit** `feat: fotos revezam entre os meses, as menos usadas primeiro`.

### Task 6: Publishing (controller, not a subagent)

- [ ] Apply the migration to pat-dev: `npx supabase db push --linked` (CLI v3: `--remote --yes` if it asks), with `.env.local` loaded.
- [ ] Publish: `npx supabase functions deploy melhorar-posts --project-ref bvliykfmrgbrqimmdria`.
- [ ] Check the constraint: `select pg_get_constraintdef(oid) from pg_constraint where conname = 'produtos_fotos_check';` → `CHECK ((cardinality(fotos) <= 12))`.
- [ ] `npm test` and `npm run build` green. Run `tests/int` only for the affected files, one at a time (the login limit).
- [ ] Push: `git -c http.sslBackend=schannel push origin v2-etapa3` (Cloudflare publishes on its own). Tell Karem to test the import of the Malibu photos again.
