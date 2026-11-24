# PAT · Caixinha "Ocultar preço" no item

Data: 2026-11-24 · Tamanho: mudança pequena · Aprovado pela Karem em 2026-11-24.

## Por quê
A Karem quer manter o preço cadastrado no item, mas poder escolher que ele não apareça nos posts.

## O que muda
- **A caixinha.** O item ganha a caixinha **"Ocultar preço"**, logo abaixo de "Promoção só para uma data especial".
  - Dica: "O preço fica salvo, mas não aparece na arte nem na legenda."
  - Aparece nas duas telas de item: o cadastro dos itens (`perguntas.js`) e o "Refazer este post" (`refazerPost.js`).
  - Não aparece em ramos `noPromo`, que não têm preço.
- **No banco.** Coluna nova `produtos.ocultar_preco boolean not null default false`.
- **Item marcado.** Para os posts, o item vale como se não tivesse preço: sem o selo na arte e sem o parágrafo de
  preço na legenda. O que define isso são os `preco_de`/`preco_por` gravados no post, que ficam nulos.
- **Promoção com data e preço oculto.** O post da data continua anunciando a oferta, sem valor. É a regra que já
  existe para a promoção com data sem preço.
- **Posts que já existem.** Não mudam sozinhos.
  - No "Refazer este post", o post é refeito já sem preço.
  - No cadastro, a cliente usa o "Refazer os posts que faltam", como já acontece com qualquer correção.
- **Desmarcar.** O preço volta nos próximos posts feitos ou refeitos.

## Abordagens
- **Escolhida: uma caixinha por item.** É o que a Karem pediu, no mesmo jeito da caixinha da data.
- **Descartadas:**
  - uma opção por post: dá mais trabalho a cada post;
  - uma opção para o negócio inteiro: não permite mostrar o preço de um item e esconder o de outro.

## Para quem constrói
Um ponto único no servidor transforma "ocultar_preco" em "sem preço": é a lista de produtos que as funções que
geram posts leem (`gerar-mes`, `refazer-posts`, `trocar-estrategia`, `trocar-post`). Assim, nenhuma regra de
geração precisa mudar.
