# Como incluir um ramo novo no PAT

Cada ramo de negócio (ferramentas, beleza, psicologia...) é um arquivo só, com os textos que o app usa para montar os posts. Para incluir um ramo novo, como "Alimentação", não é preciso mexer no banco de dados, nas telas nem nas funções.

## Passo a passo

1. **Copie o arquivo de um ramo parecido.** Os ramos ficam em `supabase/functions/_shared/modelos/ramos/`. Por exemplo, copie `beleza.ts` para `alimentacao.ts`.
2. **Troque os textos.** No arquivo novo:
   - `id`: o nome técnico, em minúsculas, sem acento nem espaço (ex.: `alimentacao`). Ele é gravado no cadastro do cliente.
   - `nome` e `desc`: como o ramo aparece no painel.
   - `lib`: pelo menos 8 produtos ou serviços típicos, cada um com gancho, demonstração, benefício e problema/solução.
   - `aprox`: pelo menos 8 posts de aproximação (bastidores, dicas, equipe...). Inclua ao menos 2 do formato `Stories` e 1 de `Reels`.
   - `convite`: o convite final de cada tom de voz.
   - `gen`: os textos usados quando o cliente cadastra um item que não está na `lib`.
3. **Registre o ramo** em `ramos/index.ts`: acrescente a linha `import alimentacao from './alimentacao.ts'` e o nome na lista `TODOS`.
4. **Rode `npm test`.** Os testes conferem sozinhos se o ramo novo tem tudo o que precisa: quantidade de textos, cores e formato do id.

Depois disso, o ramo novo já aparece no painel para a administradora escolher ao criar um cliente.

## Profissões com regras de conselho

Duas opções existem para profissões com regras de publicidade, como psicologia (CFP) e advocacia (OAB):

- `noPromo: true`: nenhum post fala de preço, promoção, desconto ou oferta. "Vender mais" aparece como "Atrair contatos". Os testes recusam o ramo se algum texto tiver essas palavras.
- `textOnly: true`: as artes usam só texto, sem foto de produto.

Use as duas para áreas como medicina, odontologia, nutrição e contabilidade, e confira as regras do conselho da profissão.
