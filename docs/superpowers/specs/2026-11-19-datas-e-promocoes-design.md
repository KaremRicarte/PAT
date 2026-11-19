# Datas do mês e promoções com data — desenho curto

Pedido da Karem (19/11/2026): ao montar a estratégia, o PAT mostra as datas que o cliente pode aproveitar
no mês (ex.: Black Friday em novembro) e sugere lançar promoções; no cadastro do item, uma caixinha liga a
promoção a uma data do calendário. Também: os posts de promoção não pareciam promoção (teste da Malibu Turismo).

## Por quê
Datas comemorativas e comerciais vendem; o cliente pequeno esquece delas. A promoção de data tem prazo, e o
prazo cria urgência.

## Decisões
- **Opção A (escolhida pela Karem):** promoção marcada para uma data vale só perto dela —
  até 2 posts de aquecimento no feed nos 7 dias antes ("vem aí") e o post forte no próprio dia.
  Fora dessa janela, o item aparece com o preço normal (vitrine).
- **Lista de datas fixa no app** (`_shared/modelos/datas.ts`), sem custo de IA, com datas móveis calculadas
  (Páscoa, Carnaval, Dia das Mães, Dia dos Pais, Black Friday). Cada data diz para quais ramos vale.
  Ramos com conselho (psicologia, advocacia) não veem datas só de promoção e nunca recebem sugestão de promoção;
  ganham datas de conscientização (Janeiro Branco, Setembro Amarelo, Dia do Psicólogo, Dia do Advogado…).
- **Toda data do mês ganha um post no feed no próprio dia** (entra na agenda se ainda não for dia de feed).
  Sem promoção ligada, é um post normal marcado com a data, e a IA liga o tema à data.
  Datas "só de promoção" (Black Friday, Dia do Consumidor) só ganham post quando há promoção ligada a elas.
- **Caixinha no item:** "Promoção só para uma data" → escolhe uma das próximas datas da lista ou "outro dia".
  Grava `produtos.promo_data` (só vale com preço promocional).
- **Post guarda a ocasião:** `posts.ocasiao` (jsonb `{ nome, data, fase }`, fase = tema | aquecimento | dia).
  A IA recebe a ocasião; o app mostra "📅 Natal · 25/12" no post.
- **Promoção evidente:** todo post de promoção tem a oferta no título e no gancho. O texto de preço da
  promoção com data diz o prazo ("Oferta de Natal, só no dia 25/12: de R$ X por R$ Y.").
  A checagem da IA recusa título de promoção que não fale da oferta.
- **Tela da estratégia:** lista "Datas para aproveitar em <mês>"; em cada data, a promoção ligada
  ou a dica de marcar uma (ramos que podem).

## Fora do escopo
Datas regionais/municipais; datas criadas pelo cliente além do "outro dia" da promoção; selo de data na arte.
