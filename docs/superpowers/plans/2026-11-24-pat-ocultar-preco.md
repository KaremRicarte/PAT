# Ocultar preço — Implementation Plan

> Executado em modo nativo (superpowers:executing-plans), com um revisor no final.

**Goal:** a checkbox "Ocultar preço" on the item makes its posts come out without a price, while the price stays saved.
**Spec:** `docs/superpowers/specs/2026-11-24-pat-ocultar-preco-design.md`

## Global Constraints
- Column `produtos.ocultar_preco boolean not null default false`. The client can update it (same policy as the other `produtos` columns).
- Texts: `'quiz.item.ocultarpreco': 'Ocultar preço'` and `'quiz.item.ocultarpreco.dica': 'O preço fica salvo, mas não aparece na arte nem na legenda.'`
- `noPromo` branches: no checkbox, and `ocultar_preco` is always saved as false.

## Review Focus
1. A date promotion with a hidden price must keep its date post, without a price.
2. Existing data (without the column in the select) must keep working: missing means false.
3. "Refazer este post" with the box checked must come out without `preco_de`/`preco_por`.

### Task 1: data and the item screens
- Migration `supabase/migrations/20261124000001_ocultar_preco.sql` (adds the column; check that the `produtos` update policy/grant does not list columns — if it does, add this one).
- `negocio.js`:
  - the `carregar` select includes `ocultar_preco`;
  - `itensParaSalvar` returns `ocultar_preco: !ramo.noPromo && Boolean(i.ocultarPreco)`;
  - `salvarItens` writes `ocultar_preco: i.ocultar_preco ?? false`.
- `perguntas.js`:
  - `estadoDoNegocio` maps `ocultarPreco: Boolean(p.ocultar_preco)`;
  - new `caixaOcultarPreco(item)`, a label `.caixinha` plus a hint, added after `caixaDaData` in both screens.
- `refazerPost.js`: `itemParaGravar` includes `ocultar_preco`.
- Tests (negocio/perguntas/refazerPost): `itensParaSalvar` carries `ocultar_preco` (false in noPromo); `estadoDoNegocio` reads it; `itemParaGravar` includes it.

### Task 2: server without a price for a hidden item
- Create `supabase/functions/_shared/modelos/precos.ts` with `precosVisiveis<T extends { preco, preco_promo, ocultar_preco? }>(produtos: T[]): T[]`: when `ocultar_preco` is set → `preco: null, preco_promo: null` (keeps `promo_data`).
- Apply it in the `produtos` dep of `gerar-mes`, `refazer-posts`, `trocar-estrategia` and `trocar-post` (`select` with `ocultar_preco`).
- Tests:
  - `precosVisiveis` returns nulls for a hidden item and leaves the others alone;
  - in `refazer-posts.test.ts`, refazendo um post de item com `preco: null, preco_promo: null, promo_data` gives a post with `preco_de`/`preco_por` null that keeps the occasion (if the existing tests already cover this, add only the `precosVisiveis` test).

### Task 3: publishing
- `db push`, deploy of the 4 functions, `npm test`, `npm run build`, push of `v2-etapa3`.
