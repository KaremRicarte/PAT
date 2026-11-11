# PAT v2 · Etapa 3 — Calendário, artes, aprovação, vídeo e lembretes — Especificação

Data: 2026-11-11 · Status: aprovada pela Karem (ajustes finos depois do teste no celular)

Muda a ordem do plano geral (spec de 2026-11-06, §9). As artes e o calendário vêm antes da integração com o Claude, que passa para a Etapa 4. A Etapa 4 também inclui a ElevenLabs para narrar os vídeos: o Claude escreve o roteiro, a ElevenLabs gera a voz e o app junta a voz ao vídeo editado nesta etapa. Por isso a edição de vídeo (§3.4) deve aceitar uma faixa de áudio extra no futuro.

## 1. Objetivo

O cliente gera o mês e já vê **cada post com a arte pronta** num **calendário fácil de usar**. Em cada post ele pode aprovar, reprovar, trocar a imagem e baixar a arte. Nos posts de vídeo, ele envia o vídeo que gravou e o app edita.

Sucesso = no teste no celular, a Karem consegue:
1. abrir o calendário;
2. aprovar e reprovar posts, usando as duas opções;
3. trocar uma imagem;
4. baixar uma arte;
5. enviar um vídeo curto e baixar o resultado editado;
6. marcar um post como postado;
7. instalar o app na tela inicial, ativar os lembretes e receber uma notificação de teste.

Tudo isso sem erro e sem precisar de explicação: **qualquer pessoa deve conseguir usar** (§3.0).

## 2. Decisões

| Tema | Decisão |
|---|---|
| Onde as artes e os vídeos são montados | No celular do cliente (canvas), como no PAT v1. O servidor guarda só as escolhas |
| Edição de vídeo | Feita pelo próprio app (não por uma pessoa) |
| Reprovar | O cliente escolhe: **Gerar outro** (modelos prontos; conta como troca) ou **Só descartar** |
| Trocar imagem | Fotos já enviadas + "Enviar outra foto"; "Sem foto" nos ramos `textOnly` |
| Calendário | Grade do mês com bolinhas por dia + lista dos posts do dia escolhido |
| Música no vídeo | Não. O cliente coloca a música na própria rede (direito autoral) |
| Duração do vídeo | Até 60 s |
| Vídeo original | Não sobe para o servidor |
| ✓ Postei | Entra nesta etapa: marca o post como postado (📤) |
| Lembretes | Notificação no celular (web push): às 8h, o resumo do dia; às 20h, só se faltar postar algum post do dia. Fuso de São Paulo por enquanto |
| App instalável | Sim (PWA), porque a notificação exige isso, principalmente no iPhone |
| Fora desta etapa | Editar o texto, IA nos textos e narração (Etapa 4), modo sem internet, fuso por cliente |

## 3. Telas

### 3.0 Regras de usabilidade (valem para todas as telas)
- Áreas de toque com pelo menos 48 px de altura; os botões principais ocupam a largura toda no celular.
- Palavras do dia a dia, sem termos técnicos ("Baixar imagem", não "Exportar PNG").
- Os ícones vêm sempre com texto ou número ao lado; a cor nunca é a única pista.
- Cada toque tem uma resposta visível: um aviso curto no rodapé ("Aprovado ✓", "Imagem trocada", "Legenda copiada") que some sozinho em 3 s.
- As ações que tiram o post do mês (descartar) mostram **Desfazer** no aviso.
- Na primeira vez que o cliente abre o calendário, aparece um cartão com 3 dicas ("Toque num dia para ver os posts", "Toque no post para aprovar ou trocar a imagem", "Depois de postar, toque em ✓ Postei"). O botão "Entendi" fecha o cartão, e ele não volta mais (guardado no aparelho).
- Uma ação por vez: a tela do post mostra primeiro as ações mais usadas (Aprovar, Copiar legenda, Baixar imagem); as outras ficam em "Mais opções".

### 3.1 Calendário (substitui a lista do mês)
- **Topo:** os botões de troca de mês (quando houver mais de um), o título "Seu mês: {mês}", o selo da estratégia, "Editar meu negócio" e "Gerar {próximo mês}" (como hoje).
- **Resumo:** `📤 N postados · ✓ N aprovados · ⏳ N pendentes · ✕ N reprovados`.
- **Aviso dos lembretes** (enquanto não estiverem ativos): "Quer um lembrete na hora de postar?", com os botões **Ativar** e **Agora não**. "Agora não" esconde o aviso por 7 dias.
- **Grade do mês:** 7 colunas (D S T Q Q S S). Cada dia com post mostra uma bolinha. Os posts descartados não contam, e a primeira regra que valer define a cor:
  1. azul se todos os posts do dia foram postados;
  2. amarela se tem pendente;
  3. vermelha se tem reprovado;
  4. verde nos outros casos (tudo aprovado, falta postar).
  O dia escolhido fica destacado e o dia de hoje tem um contorno. A grade abre no dia de hoje se ele for do mês mostrado; senão, no primeiro dia com post.
- **Lista do dia:** um cartão por post com a miniatura da arte (ou um ícone de texto, nas mensagens de lista), "Rede · Formato", o horário e o ícone de situação 📤 / ✓ / ⏳ / ✕. Os posts aprovados e ainda não postados mostram o botão **✓ Postei** no próprio cartão. Tocar no cartão abre a tela do post.
- Acessibilidade: cada dia é um botão com rótulo ("4 de novembro, 2 pendentes"); as cores sempre vêm com o ícone ou o número.

### 3.2 Tela do post
- **Voltar** (para o calendário, no mesmo dia).
- **Arte grande:**
  - Feed e Stories: arte única.
  - Carrossel: as páginas deslizam para o lado, com indicação "1/4".
  - Vídeo de montagem (`montagem`): a prévia animada com as fotos.
  - Vídeo para gravar (`gravar`): a capa com o título, e depois o vídeo editado.
  - Status do WhatsApp: arte vertical.
  - Mensagem de lista (`lista`): sem arte, só o texto.
- **Texto:** a legenda, as hashtags e o roteiro (quando houver).
- **Ações:**
  - **✓ Aprovar** (quando já aprovado, vira "Aprovado ✓" e permite voltar a pendente);
  - **✕ Reprovar**, que abre a escolha *Gerar outro* / *Só descartar*;
  - **Trocar imagem** (só nos posts com arte);
  - **Baixar arte** (PNG; no carrossel, uma imagem por página);
  - **Copiar legenda**;
  - **Enviar meu vídeo** (só em `gravar`);
  - **✓ Postei**: se o post ainda estiver pendente, aprova e marca como postado de uma vez. Depois vira "Postado 📤", com **Desfazer**.
- Um post descartado mostra "Descartado" e o botão **Desfazer**, que volta a pendente.

### 3.5 Lembretes
- **Ativar:** o celular pede a permissão; aceitando, aparece "Lembretes ativados ✓" e o app envia uma **notificação de teste** na hora.
- **iPhone fora da tela inicial:** em vez de pedir a permissão, abre o passo a passo ilustrado:
  1. toque em Compartilhar;
  2. "Adicionar à Tela de Início";
  3. abra o PAT pelo ícone novo e toque em Ativar de novo.
- **Permissão negada:** "Os lembretes estão bloqueados. Para liberar, abra os ajustes do navegador > Notificações > PAT."
- **Desligar:** no topo do calendário, o botão do sino (🔔 / 🔕) liga e desliga, com o texto "Lembretes ligados" / "Lembretes desligados".
- **Textos das notificações:**
  - 8h: "Bom dia! Hoje você tem {N} post(s): {redes} 📲";
  - 20h: "Ainda falta postar {N} post(s) de hoje. Leva 1 minutinho 😉".
- Tocar na notificação abre o app no calendário, no dia de hoje.
- Se ativar no celular e no computador, os dois recebem.

### 3.3 Trocar imagem
- Janela por cima da tela do post com a grade das fotos dos produtos do cliente (a atual marcada).
- Botão **Enviar outra foto**, que abre a galeria ou a câmera.
- **Sem foto** nos ramos `textOnly` (psicologia e advocacia).
- Ao escolher, a arte é redesenhada na hora e a escolha é gravada.

### 3.4 Edição do vídeo
1. **Enviar meu vídeo** abre a galeria ou a câmera; aceita um arquivo de vídeo de até 60 s.
2. O app mostra "Editando seu vídeo… N%".
3. A edição tem três partes:
   - nos primeiros 3 s, o título do post sobre o vídeo, com as cores e o estilo do ramo;
   - durante todo o vídeo, o logo e/ou o @ no canto, conforme a assinatura do cliente;
   - no fim, uma tela de 2 s com a chamada e a assinatura.
   O som original é mantido.
4. O resultado é 720×1280 (vertical). Se o vídeo original for horizontal, ele é centralizado com o fundo na cor do cliente.
5. Aparece a prévia com os botões **Baixar vídeo** e **Escolher outro**.
6. O vídeo editado fica só na memória do aparelho. Se o cliente sair da tela, precisa enviar de novo.

## 4. Dados e servidor

### 4.1 Migração `20261112000001_etapa3_posts.sql`
- `posts.estado`: os valores aceitos passam a ser `gerado` (pendente), `aprovado`, `editado` e `reprovado`. O valor `editado` fica reservado para a etapa da edição de texto.
- `posts.foto_path text`: a foto escolhida para o post. Quando é `null`, vale a foto do produto ligado ao post (`produto_id`).
- `posts.sem_foto boolean not null default false`.
- `posts.postado_em timestamptz`: quando o cliente tocou em ✓ Postei (`null` = não postado). O gatilho troca qualquer valor que não seja `null` por `now()`.
- Tabela `push_inscricoes`:
  - colunas: `id`, `cliente_id`, `endpoint` (único), `p256dh`, `auth`, `criado_em`;
  - RLS: o cliente insere e apaga só as dele; o admin lê.
- **Permissão:** `grant update (estado, foto_path, sem_foto, postado_em) on posts to authenticated`.
- **Política `posts_alterar`:** o post precisa ser de um mês do próprio cliente, e o cliente precisa estar ativo (`cliente_ativo()`).
- **Gatilho:** o cliente só pode gravar em `estado` os valores `gerado`, `aprovado` ou `reprovado`. O `foto_path` precisa começar com `{uid}/`. O banco não confere se o ramo é `textOnly`: o app só mostra "Sem foto" nesses ramos e, se o valor chegar em outro ramo, o desenho ignora e usa a foto.

### 4.2 Função `trocar-post`
- Entrada: `{ post_id }`. Usa o login do cliente.
- Confere se o post é do cliente, se o cliente está ativo e se a soma de `trocas` dos posts do mês é menor que 10.
- Gera um post novo com os modelos prontos, com a mesma data, rede, tipo, formato e horário. O pilar e o produto podem mudar, e as regras do ramo (`noPromo`) continuam valendo.
- Grava por cima do post: título, legenda, hashtags, roteiro, pilar e produto_id. Também volta `estado = 'gerado'`, `foto_path = null` e `sem_foto = false`, e soma 1 em `trocas`.
- Respostas:
  - 200 com o post novo;
  - 403 se o post não é dele ou se ele está bloqueado;
  - 429 `{ erro: "Você já usou as 10 trocas deste mês." }` no limite.

### 4.2b Lembretes (web push)
- **Chaves VAPID:**
  - a pública fica no Netlify (`VITE_VAPID_PUBLIC_KEY`);
  - a privada é um segredo das funções (`VAPID_PRIVATE_KEY`).
- **Função `lembrete`:**
  - é chamada com `{ turno: 'manha' | 'noite', teste?: true }` e um segredo próprio (`LEMBRETE_SECRET`), nunca pelo cliente;
  - na manhã, avisa os clientes ativos com inscrição e pelo menos 1 post de hoje que não foi descartado;
  - à noite, avisa só quem tem algum post de hoje não descartado e sem `postado_em`;
  - as inscrições que respondem 404 ou 410 (desinstaladas) são apagadas.
- **Notificação de teste:** a função `lembrete-teste` usa o login do cliente e envia só para as inscrições dele.
- **Agendamento:** o `pg_cron` chama a função `lembrete` pelo `pg_net` às 11:00 UTC (8h em São Paulo) e às 23:00 UTC (20h).
- **No app:**
  - `app/public/manifest.webmanifest`: nome "PAT", cores #000000 e #CEFB14, ícones de 192 e 512 px gerados a partir do `pat-icon.png`;
  - `app/public/sw.js` (service worker): recebe o push, mostra a notificação e, ao tocar, abre `/?dia=AAAA-MM-DD`;
  - `cliente/lembretes.js`: ativar, desligar, detectar iPhone fora da tela inicial e o aviso.

### 4.3 Fotos
- As fotos novas são reduzidas no aparelho (`FOTO_MAX` de 1600 px, JPEG) e enviadas para `marcas/{uid}/posts/{post_id}.jpg` (`upsert`).
- O app lê as fotos com URLs assinadas, como já faz com as dos produtos.

### 4.4 Artes no aparelho
Código trazido do `bancada/index.html` para `app/src/artes/`:
- `looks.js`: tabela `LOOKS` e as fontes de cada estilo;
- `desenho.js`: `drawSingle`, `drawSlide` e as funções de texto;
- `montagem.js`: o vídeo de montagem (`drawReel` + `MediaRecorder`);
- `video.js`: a edição do vídeo enviado (novo);
- `assinatura.js`: `sig()`.

As funções de cálculo, como quebra de linha e posições, ficam separadas do canvas para poderem ser testadas.

Os tamanhos são:
- Instagram e Facebook feed: 1080×1350;
- Stories e Status: 1080×1920;
- vídeo: 720×1280.

O formato do vídeo é MP4 quando o navegador grava MP4 (iPhone e Chrome recentes); senão, WebM.

### 4.5 Organização do app
- `cliente/mes.js` fica só com o quiz do mês e a geração.
- Arquivos novos:
  - `cliente/calendario.js`: a grade, o resumo e a lista do dia;
  - `cliente/post.js`: a tela do post e as ações;
  - `cliente/trocarFoto.js`;
  - `cliente/situacao.js`: as regras puras, ou seja, a cor do dia, o resumo e a foto de cada post.

## 5. Erros

| Situação | O que o cliente vê |
|---|---|
| Foto que o navegador não abre | "Não consegui abrir esta foto. Tente outra." A foto anterior continua |
| Vídeo com mais de 60 s | "Escolha um vídeo de até 60 segundos." |
| Navegador sem `MediaRecorder` ou `captureStream` | "Seu celular não consegue editar vídeos aqui. Use o roteiro e edite no app da rede social." |
| Falha ao gravar aprovação, reprovação ou foto | O ícone volta ao que era; "Sem conexão. Tente de novo." |
| Limite de trocas | "Gerar outro" desativado, com a mensagem do limite |
| Arte ainda sendo desenhada | Miniatura com fundo na cor do cliente |
| Logo ou foto que não carrega | A arte é desenhada sem ela (como no v1) |
| Navegador sem suporte a notificações | O aviso dos lembretes não aparece |
| Falha ao enviar um lembrete a um aparelho | Os outros aparelhos recebem normalmente; o erro fica no registro da função |

## 6. Testes

**Automáticos (unidade):**
- a cor da bolinha de cada dia;
- a contagem do resumo;
- o dia inicial da grade;
- a montagem da grade (dias vazios antes do dia 1);
- a escolha da foto: a escolhida, a do produto ou nenhuma, e "sem foto";
- a quebra de linha e as posições do texto nas artes;
- a geração da troca: mesma data, rede e formato, e respeito ao `noPromo`;
- a cor do dia com posts postados;
- quem recebe o lembrete da manhã e da noite;
- o texto das notificações (singular e plural);
- a detecção de iPhone fora da tela inicial.

**Automáticos (integração, pat-dev):**
- `trocar-post`: dono, outro cliente (403), bloqueado (403), limite (429);
- RLS e gatilho:
  - o cliente altera `estado`, `foto_path` e `sem_foto` dos próprios posts;
  - não altera a legenda;
  - não altera os posts de outro cliente;
  - quando está bloqueado, não altera nada;
  - não grava `estado = 'editado'`;
  - não escolhe a data de `postado_em`.
- `push_inscricoes`: o cliente não lê nem apaga as inscrições de outro.
- `lembrete`: recusa uma chamada sem o segredo.

**Manual (Karem, no celular):** os 7 passos do §1.
