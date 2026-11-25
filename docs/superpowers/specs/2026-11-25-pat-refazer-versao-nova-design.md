# PAT · "Refazer" com versão nova: foto sugerida e escolha entre o post ou o dia inteiro

Data: 2026-11-25 · Tamanho: médio

## Por quê
O "Refazer este post" mantinha a foto e, com os mesmos dados, a IA repetia o texto. O resultado parecia igual
ao de antes. A Karem testou trocar a foto e gostou: com a foto nova, a IA escreve um texto novo. Ela também quer
poder refazer de uma vez todos os posts do dia, porque desde 19/11 cada dia tem um assunto só, adaptado às redes.

## Fluxo (decidido pela Karem)
1. **Tocar em "🔄 Refazer este post".** A tela abre já com a **foto sugerida**: a próxima foto do item, diferente da
   atual. Ela tem dois botões:
   - **Escolher outra foto**: abre a mesma janela do "Trocar foto";
   - **Manter a foto atual**: só o texto muda.

   Embaixo ficam os campos do item, como hoje: nome, descrição, preços e as caixinhas.
2. **Item com uma foto só (ou nenhuma).** Não há o que sugerir. A tela avisa:
   > "Este item só tem 1 foto. Envie outra para os posts variarem; se não, o PAT refaz só o texto."
   (ou "Este item ainda não tem foto…")

   Ao lado fica o botão **"Enviar nova foto"**. A foto enviada entra no item (respeitando o limite de 12) e passa a
   ser a foto escolhida.
3. **Tocar em "Refazer".** Aparece a pergunta **"O que refazer?"** com três botões:
   - **Só este post**;
   - **Todos os posts do dia DD/MM (N)**;
   - **Cancelar**.

   Se o dia só tem esse post para refazer, a pergunta não aparece.
4. **Só este post.** O post é refeito com a foto escolhida (ou mantida), e a IA escreve a partir dela.
5. **Todos os posts do dia.**
   - Este post usa a foto escolhida.
   - Os outros posts do mesmo dia que ainda não foram postados recebem, cada um, a próxima foto do revezamento
     (diferentes entre si e diferentes das que tinham).
   - Todos ganham texto novo.
   - Os aprovados voltam para "Para aprovar". Os postados não mudam.

Em qualquer caso:
- A IA recebe o título anterior de cada post, com o pedido de não repetir o título nem a abertura.
- As correções do item (nome, preço, "Ocultar preço"…) valem para tudo o que for refeito.
- Post de tema geral (sem item) não tem bloco de foto. Ao refazer, a foto atual fica marcada como usada e a IA
  escolhe outra imagem, como já faz.

## Fora do escopo
- Refazer a semana ou o mês. Isso já existe: "Refazer os posts que faltam".
- Mudar o "Trocar foto". Ele continua como está.

## Abordagens
- **Escolhida: o servidor recebe a foto escolhida e o modo.** A função `refazer-posts` recebe
  `{ post_id, foto_path?, dia? }`. Para os outros posts do dia, ela marca as fotos atuais como usadas
  (`fotos_usadas`) e zera `foto_path`; o revezamento da IA, já existente, escolhe as próximas.
- **Descartada:** o app escolher as fotos de todos os posts do dia. Ele não enxerga `fotos_usadas` e duplicaria a
  regra do servidor.

## Para quem constrói
- Coluna nova `posts.titulo_anterior text`. `refazer-posts` grava nela o título atual; `melhorar-posts` usa na
  entrada da IA.
- Foto sugerida no app: a próxima foto do item, depois da atual, na ordem do item e em ciclo, pulando as reprovadas.
- A foto escolhida precisa estar na pasta do cliente. O servidor valida isso, como já faz nos outros pontos.
