# Etapa 4A — Posts profissionais com IA — design

**Data:** 17/11/2026 · **Dona do produto:** Karem · **Status:** aguardando aprovação (revisado por um leitor externo)

## 1. Por quê

Hoje os posts saem de modelos prontos e têm "cara de amador" por dois motivos que a Karem apontou:
1. **frases curtas e clichê** (textos genéricos, repetidos entre clientes do mesmo ramo);
2. **foto em desacordo com a legenda** (a foto é escolhida pela ordem, sem ninguém olhar o que ela mostra).

**Objetivo:** cada post escrito para aquele negócio, com técnica de copy (gancho, retenção, desejo de compra,
reputação) e com **a legenda nascendo da foto** — texto e imagem sempre combinando.

**Não objetivos (agora):** narração dos vídeos com ElevenLabs (Etapa 4B, depois que a 4A for testada); leitura de
métricas das redes; editar o texto à mão no app; imagens geradas por IA; espanhol (etapa do painel completo);
calendário de datas comemorativas (projeto separado).

**Anti-objetivos (seria fracasso mesmo funcionando):**
- a IA inventar depoimentos, números, prêmios, garantias ou preços que o cliente não informou;
- quebrar as regras de conselho (psicologia, advocacia: sem preço nem promoção) ou as regras de preço atuais;
- o cliente esperar ou ver erro por causa da IA — se ela falhar, o post de modelo continua valendo;
- mexer num post que o cliente já aprovou ou postou;
- custo descontrolado (um cliente gerando IA sem limite).

## 2. Decisões da Karem (17/11/2026)

| Tema | Decisão |
|---|---|
| Texto | IA (Claude) com gancho, retenção, desejo de compra e reputação, pesados pela estratégia do mês |
| Foto × legenda | **A legenda nasce da foto**: a IA vê cada foto, guarda uma descrição, e escreve o post a partir dela |
| Post sem foto do cliente | **Banco de imagens (Pexels)** nos posts de tema geral, sem repetir foto entre clientes; **só texto** como reserva. Serviço sem foto continua pedindo a foto real |
| Organização | 4A (textos + fotos) primeiro; 4B (narração) depois |
| Tempo de espera | **Opção 2:** o mês aparece na hora (modelos); a IA melhora os posts em seguida, semana a semana, mostrando o progresso |

## 3. Como o cliente vê

### 3.1 Ao salvar fotos (cadastro, importação, "Editar/Importar")
- Nada muda na tela de salvar. Em segundo plano, cada foto nova é **descrita uma vez** pela IA (o que mostra) e
  **avaliada** (nítida? bem iluminada? serve para post?).
- Foto que não serve aparece com um aviso curto na faixa de fotos do item: "Esta foto ficou escura; se puder, envie outra."
  Ela não é usada nos posts.

### 3.2 Ao gerar o mês (e ao refazer posts / trocar estratégia)
- O mês aparece na hora, como hoje (modelos prontos).
- No topo do calendário: **"✨ Melhorando seus posts… 18 de 60"** (some quando termina).
- A IA trabalha **dos dias mais próximos para os mais distantes**, então os posts de hoje e amanhã ficam prontos primeiro.
- Cada post melhorado ganha um selo discreto **"✨ Escrito para você"** na tela do post.
- Posts **aprovados ou postados** antes de a IA chegar neles **não mudam**.
- Funciona mesmo que o cliente feche o app.
- Se a IA falhar num post, ele fica com o texto de modelo (sem aviso de erro); a faixa termina normalmente.

### 3.3 Post com foto
- A IA recebe **a foto e a descrição** e escreve título, gancho, legenda (com o meio e o convite), hashtags e, se for
  vídeo, o roteiro — tudo a partir do que a foto mostra, ligado ao serviço e à estratégia do mês.
- O post fica com aquela foto marcada (a arte usa exatamente a foto em que a legenda se baseou).

### 3.4 Post sem foto
- **Post de um serviço que não tem foto:** só texto (como hoje) e o aviso do calendário continua pedindo a foto real.
- **Post de tema geral** (dica, bastidores, mitos e verdades…): a IA escolhe palavras de busca, o app busca no Pexels,
  a IA escolhe a imagem que serve e escreve a partir dela. A foto é copiada para a pasta do cliente. Se nenhuma servir:
  só texto.
- Uma foto do Pexels usada por um cliente não é oferecida a outro.

### 3.5 Ações no post
- **"Gerar outro":** passa a pedir à IA um texto novo para o mesmo lugar (mesma foto), na hora (alguns segundos, com
  "Escrevendo…"). Se a IA falhar ou demorar, cai no modelo como hoje. Continua contando no limite de 10 trocas.
- **"Trocar imagem":** depois de escolher a nova foto, a IA **reescreve a legenda** para combinar com ela (na hora).
  Se a IA falhar, a foto troca e o texto fica como estava.

## 4. Regras do texto (o que a IA recebe e precisa respeitar)

- **Entrada por post:** ramo e suas regras, nome do negócio, @, tom de voz, estratégia do mês, rede e tipo (feed,
  stories, vídeo, status, lista), o serviço (nome, descrição, preço/promoção quando o post é de preço), a foto e a
  descrição dela, a data e o pilar do lugar (demonstração, aproximação, necessidade).
- **Estrutura:** gancho na 1ª linha (parar a rolagem), meio que prende (passos, curiosidade, lista), desejo
  (benefício concreto, antes/depois) e convite claro (WhatsApp/visita/seguir conforme a estratégia).
- **Peso por estratégia:** Vender mais → desejo de compra; Crescer o perfil → gancho e retenção; Credibilidade →
  reputação; Economizar tempo → equilíbrio.
- **Formato por rede:** tamanhos e estilo de cada rede (feed mais completo, stories curto com enquete/caixinha,
  status direto, mensagem de lista como conversa).
- **Proibido:** inventar depoimentos, números, prêmios, garantias, preços; preço/promoção fora dos posts de preço;
  qualquer menção a preço ou promoção em ramos com conselho; promessas de resultado em saúde/jurídico.
- **Preço:** só nos posts que já são de preço (o `preco_de`/`preco_por` do lugar), com o mesmo texto de valor que o
  app usa hoje.
- **Verificação:** todo texto da IA passa pelas mesmas checagens dos modelos (`validarPost`); se reprovar, tenta mais
  uma vez; se reprovar de novo, fica o modelo.

## 5. Custos e limites

- Modelo: **Claude Opus 5.5** (o mais capaz para esse uso). Estimativa: ~US$ 1 por cliente por mês para escrever o
  mês; ~R$ 0,03 por foto descrita (uma vez só). Pexels gratuito.
- **Limite por cliente** para evitar custo descontrolado: no máximo N chamadas de IA por mês por cliente (valor
  inicial a definir no plano, folgado para o uso normal: mês + refazer + trocas). Passou do limite: segue com modelos,
  sem erro.
- **Registro de uso:** cada chamada grava cliente, tipo (foto, post, troca), tokens e custo estimado — base para o
  painel e para a cobrança no futuro (sem tela agora).
- Chaves: `ANTHROPIC_API_KEY` e `PEXELS_API_KEY` como segredos do Supabase (a Karem cria as contas com o passo a passo).

## 6. Abordagens consideradas (para o tempo de geração)

1. Tudo na hora de gerar: espera de minutos e risco de estourar o tempo das funções. Descartada.
2. **Mês na hora + IA em segundo plano (escolhida):** nunca espera, nunca erro; o modelo é a reserva natural.
3. Processamento em lote (metade do preço): pode levar horas. Descartada para o fluxo principal.

## 7. Chamadas minhas (Claude) — conferir

1. O texto da IA **substitui** o do post de modelo no mesmo lugar (data, rede, tipo, horário, ordem não mudam).
2. Melhorar só posts **não aprovados e não postados**, de hoje em diante; o selo "✨ Escrito para você" marca os
   que a IA escreveu (uma coluna de origem no post: modelo ou IA).
3. A IA escreve **um post por vez** (ou poucos por chamada), sempre com a foto junto — mais caro que o mês inteiro numa
   chamada, mas é o que garante legenda e foto combinando.
4. A descrição da foto é guardada por foto (não por post) e reaproveitada em todos os meses.
5. Foto do Pexels: buscar em português/inglês pelo tema; preferir fotos sem pessoas em destaque e sem marcas; guardar o
   id para não repetir entre clientes; copiar para o Storage do cliente (a arte é desenhada no aparelho).
6. "Gerar outro" e "Trocar imagem" usam a IA na hora, com limite de espera (~20 s) e o modelo como reserva.
7. Refazer posts (depois de mudar serviços) e trocar estratégia voltam o post para modelo e entram na mesma fila de
   melhoria.
8. Sem tela nova no painel da administradora agora; o uso fica registrado no banco.
9. **Qual foto o post usa:** a regra de hoje escolhe (fotos do serviço revezando pela ordem do post; post geral → banco de
   imagens), **pulando as fotos reprovadas**; a IA escreve a partir dessa foto e ela é gravada no post (`foto_path`).
   Se o cliente já tinha escolhido uma foto no post ("Trocar imagem"), a IA escreve a partir da dele.
10. **Foto reprovada:** conta como "sem foto" (o post do serviço fica só texto e o aviso do calendário pede foto). Uma foto
    nova é sempre avaliada de novo (é outro arquivo).
11. **Onde fica a descrição:** uma tabela por foto (caminho no Storage, cliente, descrição, se serve, motivo). Fotos que já
    existem são descritas na primeira vez que um post precisar delas. Foto removida do serviço: a descrição sai junto.
12. **Fila:** os posts são atualizados no mesmo lugar (refazer volta o post para "modelo"; trocar estratégia cria posts novos
    como "modelo"); a fila é "posts de modelo, não aprovados, não postados, de hoje em diante". A IA só grava se o post
    continuar igual ao que ela leu (gravação condicional no banco): **qualquer ação do cliente durante o trabalho vence.**
13. **Limite por cliente:** conta toda chamada à IA (fotos, posts, novas tentativas, trocas), por mês do calendário; valor
    inicial 400. Estourou: tudo segue com modelos, em silêncio; "Gerar outro" continua contando nas 10 trocas como hoje.
14. **Post de tema geral** = post sem serviço ligado. A licença do Pexels não exige crédito ao fotógrafo; guardamos o id e o
    nome do autor mesmo assim. Se o banco não tiver foto inédita que sirva, o post fica só texto.
15. **Modelo:** Claude Opus 5.5 em todas as chamadas (fotos, posts, trocas); o registro de uso guarda os tokens de cada uma.
16. **Clientes e meses atuais:** ao publicar, os posts que faltam do mês em andamento (não aprovados, não postados) entram na
    fila uma vez. O selo "✨ Escrito para você" aparece só nos posts escritos pela IA.

## 8. Fica com quem constrói

A forma exata da fila em segundo plano (desde que continue com o app fechado, retome se cair e não processe o mesmo post
duas vezes), os nomes das tabelas e funções, o texto exato das instruções à IA (seguindo §4), o formato da resposta da
IA (estruturado e validado), o valor inicial do limite por cliente, a ordem das tarefas e os testes (com a IA e o Pexels
substituídos por falsos nos testes automáticos).
