# Refazer os posts que faltam depois de editar o negócio — design curto

**Por quê:** uma nova importação (ou mudança à mão nos itens: nome, preço, fotos, ordem) deixa os posts
já gerados do mês desatualizados. O cliente precisa de um jeito simples de refazê-los com os itens novos.

**Aprovado pela Karem (17/11/2026):**
- A pergunta aparece **depois de salvar** "Editar meu negócio", só se os itens mudaram e houver posts para refazer.
- Duas opções + manter:
  - **Refazer os não aprovados (N)**: pendentes e descartados.
  - **Refazer todos que faltam postar (M)**: também os aprovados ainda não postados (só aparece se M > N).
  - **Manter como está**.
- Nunca mexe em post já postado nem em dia que já passou (data < hoje em São Paulo).
- Data, rede, tipo, formato, horário e estratégia do mês ficam iguais; só o conteúdo é refeito.

**Abordagens consideradas:**
1. *Função nova `refazer-posts` no servidor* (escolhida): regera o mês com os modelos e os itens atuais, encaixa cada post no
   mesmo lugar (mesma data, rede, tipo; vídeo com o mesmo formato) e grava tudo de uma vez. Um toque, um pedido.
2. *Chamar o "Gerar outro" post a post pelo app*: reaproveita a função, mas gasta o limite de 10 trocas e faz dezenas de pedidos.
3. *Apagar o mês e gerar de novo*: perderia os posts postados e aprovados. Descartada.

**Chamadas minhas (Claude):**
- Post refeito volta a "pendente" (estado `gerado`), sem foto escolhida (`foto_path` nulo, `sem_foto` falso). O contador de trocas não muda e o refazer não gasta trocas.
- Se o lugar exato não existir no mês regerado (mês gerado a partir do meio), usa o post da mesma rede/tipo com a data mais próxima.
- Post refeito que a validação recusar fica como estava (e vai para o log), em vez de falhar tudo.
- "Os itens mudaram" = mudou a lista (ordem, nome, descrição, preço, promoção ou fotos) entre antes e depois de salvar.
