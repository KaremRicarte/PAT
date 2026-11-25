# PAT — Detalhes do pacote de viagem (ramo Turismo) — design

Status: waiting for Karem's approval (2026-11-25).

## Intent

Travel agencies (Turismo branch) want their promotion posts to look like the CVC package cards. The reference is the CVC card Karem sent: the photo, then the hotel, check-in date, meals, then "De R$ 528 por / a partir de R$ 396 por noite taxas inclusas / Em até 12x de R$ 33 sem juros / 5% off no Pix", and a "Fale com a Loja" WhatsApp button.

Today the package exists only as name, description and price. Details like the travel dates, hotel and meals are loose text in the description, and the AI does not always use them.

Success means that a promotion post of a package shows the trip at a glance: icons, dates, what is included, the price with its conditions, and how to talk to the agency on WhatsApp.

## Goals
- New "Detalhes do pacote" checkbox in each item card of Meu negócio → Pacotes e passeios, only in the Turismo branch.
  - Place: after "Ocultar preço" and before "Fotos", as in Karem's screenshot.
  - Ticking it opens the fields.
- New "WhatsApp da empresa" field in Meu negócio, next to the Instagram field.
- Posts **with a price** of an item that has package details get a "cartão de pacote" art in the CVC style.
- The text of every post of that package (written by the AI) can use the details, and must never invent any.

## Non-goals
- WhatsApp contact line in the captions of other branches. The field exists for every branch, but in this project it is only used in the Turismo package card and in the captions of those posts. It can be widened later.
- Several hotels or several departures per package. Karem registers one item per departure.
- Booking, availability, real installment simulation with interest.

## Anti-goals
- The art showing something the client did not fill in (the AI or the template guessing a hotel, a date or "sem juros" on its own).
- Hard-to-read text on the art. The existing art rules apply: text always readable on any color, photo edge to edge with no frame.
- Other branches seeing any new field in the item card.

## Package fields (all optional)

| Field | Values | Card text |
|---|---|---|
| Hotel | text, up to 80 characters | 🏨 icon + name |
| Ida / Volta | dates; volta ≥ ida | 📅 icon + "12/12 a 17/12 · 5 noites" (nights computed by the PAT) |
| Transporte | Avião / Ônibus / Só hospedagem | ✈️ "Aéreo" / 🚌 "Rodoviário"; nothing for "Só hospedagem" |
| Transfer aeroporto ↔ hotel | yes/no | van icon + "Transfer incluso" |
| Inclui | Café da manhã / Almoço / Jantar (each a box) | cup icon + "Café da manhã" / "Café e jantar" / "Pensão completa" (all three) |
| O preço vale por | pessoa / casal / noite / pacote completo | "por pessoa" etc., below the price |
| Parcelas | em até N vezes (2 to 24) | "em até 10x de R$ 239,00 sem juros" (installment = promotional price ÷ N) |
| Taxas inclusas | yes/no | "taxas inclusas", next to the unit |
| Desconto no Pix | 1 to 50 % | green badge "5% de desconto no Pix" |

- Unticking "Detalhes do pacote" keeps the values saved but stops using them, the same way "Ocultar preço" works.
- Validation in the form:
  - volta before ida → error "A volta precisa ser depois da ida.";
  - out-of-range installments or Pix discount → error.
- Ida in the past → a muted warning, like the existing "a data já passou" of the promotion date. It does not block saving.

## Where the card appears
- On posts that carry a price (`preco_por` not null) of an item with package details turned on.
  - This covers both promotion posts (de/por) and "vitrine" posts (price only).
  - Formats: feed, stories and the carousel page that already carries the price badge.
  - The card **replaces the current price badge** in `desenho.js` (the price path that `desenharArte` already sends these posts to).
- Item with "Ocultar preço" ticked:
  - the posts of its promotion date (they already exist without a price) get the card **without** the price block: details and the WhatsApp badge only;
  - other posts keep the current art.
- Item without package details, or a branch other than Turismo: the art stays exactly as today.
- WhatsApp badge at the bottom of the card:
  - shows a green pill with the WhatsApp icon, "Fale com a loja" and the number formatted as "(83) 99999-0000";
  - no number registered → the badge is not drawn;
  - the button on the image is not clickable on Instagram. Karem already knows this.
- The details are read **live from the item** when the art is drawn (not copied into the post). Editing the item updates the art of posts that are not yet posted.

## Captions
- The AI receives the package details, written by a shared function `resumoDoPacote(pacote)` (for example: "Hotel Serra Azul; ida 12/12/2026, volta 17/12/2026 (5 noites); aéreo; transfer aeroporto–hotel incluso; café da manhã incluso; preço por pessoa, taxas inclusas; em até 10x; 5% de desconto no Pix").
  - The prompt tells it to use only these facts and never to invent others.
- Promotion and vitrine posts (template text, before the AI) get one line with `resumoDoPacote`, so the details are there even if the AI fails.
- Contact line, when there is a WhatsApp number, on the Turismo posts of an item with package details:
  - Facebook and WhatsApp: a `https://wa.me/55DDDNUMERO?text=...` link with the message "Olá! Vi o pacote {nome} e quero saber mais.";
  - Instagram and TikTok: "Chame no WhatsApp (83) 99999-0000" (links are not clickable there).

## Data
- `produtos.pacote jsonb` (null = no details), with keys:
  - `ativo` (bool), `hotel`, `ida`, `volta`, `transporte` ('aviao' | 'onibus' | null), `transfer` (bool);
  - `refeicoes` { `cafe`, `almoco`, `jantar` } (bools);
  - `preco_por` ('pessoa' | 'casal' | 'noite' | 'pacote' | null), `parcelas` (int | null), `taxas` (bool), `pix` (int | null).
  - The database has a light check (`jsonb_typeof = 'object'`). The full validation is in the app and in a shared pure function (`lerPacote`) that cleans whatever arrives: unknown keys are dropped and wrong values become null.
- `negocios.whatsapp text`: digits only, 10 or 11 digits (DDD + number), Brazilian number. The app strips the mask and adds 55 only in the wa.me link.
- The same fields appear wherever the item card is edited: Meu negócio, the "Refazer este post" screen (`itemParaGravar` includes `pacote`), and the admin's client-business screen if it reuses `perguntas.js`.

## Approaches considered
1. **One `pacote` jsonb column + a card variant in the existing price art** (chosen). The fields are optional, used by a single branch and read together; one column avoids 10 columns that every other branch would ignore. The card reuses the price path that already exists in `desenho.js`.
2. Separate columns in `produtos`. They give type checks in the database, but add ten nullable columns for a single branch and more work in every select and copy.
3. Putting the details only in the description for the AI. This is cheap, but it does not give the art Karem showed and keeps the "the AI sometimes forgets" problem.

## Decided by Karem
- The fields, including the three price ones (unit, installments, taxes) plus the Pix discount.
- Where they appear: in the item card, as a checkbox like the promotion date.
- Transport can be unticked ("Só hospedagem").
- The WhatsApp number of the company lives in Meu negócio, and the card has a WhatsApp call to action.

## Builder's calls (marked so Karem can check)
- "sem juros" is written next to the installments, because the installment shown is the price ÷ N, which is only true without interest.
- The icons are drawn as vector paths, not emoji: emoji look different on each phone and can turn into squares in the downloaded image.
- The nights are computed from the dates; no field to type them in.
- The meal text joins the ticked boxes ("Café da manhã", "Café e jantar", "Pensão completa" when all 3 are ticked).
- Long text on the card (hotel name) shrinks down to the existing minimum and then wraps to 2 lines.
- Layout details of the card (spacing, sizes, carousel page) are left to the builder, following the reference image and the existing art rules.
