# PAT – Imagem para posts de tema geral (Pixabay certo + imagem gerada pela IA)

Data: 2026-11-18 · Continuação da Etapa 4A (`2026-11-17-pat-etapa4a-posts-profissionais-design.md`).

## 1. Por quê

No primeiro teste real (45 posts), nenhum post de tema geral recebeu imagem do Pixabay e 3 ficaram sem imagem. A causa é que a busca manda o título inteiro (ex.: "Qual cuidado você mais deixa para depois"), e o Pixabay exige todas as palavras, então não acha nada.

A dona do produto quer:
- usar primeiro a foto do cliente;
- depois uma foto do Pixabay;
- e, por último, uma imagem gerada pela IA.

A lógica é **gastar o mínimo com IA**. As fotos de "Minhas fotos" (Meu negócio), que mudam pouco, servem para os posts de **aproximação**. A imagem gerada é **só para posts de tema geral**.

## 2. Objetivos, não-objetivos, anti-objetivos

**Objetivos**
- O Pixabay passa a achar fotos: a busca usa 2 a 3 palavras-chave em português e em inglês.
- Quando nenhuma foto serve, um post de tema geral ganha uma imagem gerada pelo FLUX (fal.ai), barata.
- Os posts de aproximação usam "Minhas fotos" antes das outras fotos do cliente.
- O custo das imagens geradas aparece em `uso_ia`, e cada cliente tem um limite mensal.

**Não-objetivos**
- Posts de serviço (com `produto_id`) não ganham imagem gerada. Eles continuam com as fotos do serviço, e sem elas saem só com texto, como hoje.
- Vídeo gerado não faz parte deste projeto.
- Não há tela nova no app.
- Os posts que já ficaram sem imagem não são refeitos automaticamente. Isso se faz depois, a pedido.

**Anti-objetivos** (seria fracasso mesmo funcionando)
- Imagem gerada com pessoa reconhecível, texto escrito, logotipo ou marca d'água.
- A legenda tratar uma imagem ilustrativa como se fosse do negócio, por exemplo "nosso espaço" sobre uma foto de banco de imagens ou gerada.
- Gasto descontrolado: a imagem gerada nunca passa do limite por cliente nem entra em ramos só-texto.

## 3. Restrições

- Ramos só-texto (advocacia, psicologia) continuam sem imagem em posts gerais, e isso inclui a imagem gerada.
- Tudo que vem de fora é copiado para `{uid}/banco/...` no Storage. O post guarda só o caminho, nunca a URL externa.
- A chave fica só nos segredos do Supabase, com o nome `FAL_KEY`. Sem a chave, o app funciona como hoje e pula a geração.
- Toda falha (fal.ai fora do ar, sem crédito, recusa de segurança) termina em "só texto". A falha nunca derruba o post.
- O tempo da função continua o mesmo, ~110 s por execução. A geração tem tempo máximo próprio.

## 4. Abordagens consideradas

| | Serviço | Custo/imagem | Escolha |
|---|---|---|---|
| A | FLUX via fal.ai | < US$ 0,01 | **Escolhida pela dona do produto** (menor custo) |
| B | Google Gemini/Imagen | ~US$ 0,04 | Melhor qualidade, 4x mais caro |
| C | OpenAI gpt-image | US$ 0,04–0,08 | Mais caro |

## 5. Como fica

### 5.1 Ordem da imagem num post de tema geral (sem `produto_id`)

1. **Fotos do cliente** (a IA escolhe pelo tema, como hoje).
   - No pilar `aprox` (aproximação), primeiro só "Minhas fotos". Se nenhuma servir, as outras fotos do cliente.
   - Nos outros pilares, todas as fotos do cliente juntas, como hoje.
2. **Banco do admin** (já existe, é grátis, foi curado por ela): a regra dos 90 dias continua. *Decisão minha:* fica antes do Pixabay porque não custa nada e foi escolhido a dedo.
3. **Pexels**, se houver chave, e depois **Pixabay**. A busca passa a usar as palavras-chave da seção 5.2: primeiro em português, e sem resultado, em inglês.
4. **Imagem gerada** (seção 5.3), se houver `FAL_KEY`, o ramo não for só-texto e o cliente estiver dentro do limite do mês.
5. **Só texto.**

### 5.2 Palavras-chave e descrição da imagem (uma chamada só)

- Uma chamada curta ao Claude, com esforço `low`, devolve em JSON:
  - `busca_pt`: 2 a 3 palavras;
  - `busca_en`: 2 a 3 palavras;
  - `prompt_imagem`: descrição em inglês de uma foto realista que ilustra o tema.
- É feita **só quando** as etapas 1 e 2 não deram imagem, então não custa nada quando a foto do cliente serve.
- Ela também serve para a geração, então a imagem gerada não precisa de uma segunda chamada.
- Fica registrada em `uso_ia` como `tipo='imagem'` e conta no limite de 400 chamadas.

### 5.3 Geração (fal.ai, FLUX)

- Modelo: FLUX [schnell] no fal.ai (~US$ 0,003 por megapixel). *Decisão minha:* é a opção mais barata. A versão [dev] tem um pouco mais de qualidade e custa ~8x mais, e trocar é só mudar uma constante.
- Formato da imagem pelo formato do post:
  - feed: retrato 4:5 (ou o mais perto que o fal.ai oferecer);
  - stories e reels: 9:16.
- Regras fixas no prompt de geração: fotografia realista e profissional, **sem pessoas em destaque, sem rostos, sem texto, letras, logotipos ou marcas d'água**, com o estilo do ramo.
- O verificador de segurança do fal.ai fica ligado. Uma imagem recusada vira "só texto".
- A imagem é baixada e copiada para `{uid}/banco/gerada-<id>.jpg`.
- Ela vai para `fotos_ia` com `origem='gerada'`, descrição = `prompt_imagem` e `serve=true`. Isso exige uma migração que acrescenta 'gerada' ao check de `fotos_ia.origem`.
- O host das imagens do fal.ai entra na lista de hosts permitidos para cópia.

### 5.4 Limite e custo

- No máximo **20 imagens geradas por cliente por mês**, contadas em `uso_ia` com o novo `tipo='gerada'`.
- Esse limite é **separado** das 400 chamadas: imagem gerada não é chamada ao Claude.
- `custo_usd` registra o custo por imagem (megapixels × preço). Os tokens ficam em 0.
- Passou de 20, os posts gerais seguem para "só texto" até o mês seguinte.

### 5.5 A legenda sabe de onde veio a imagem

- A entrada do redator recebe a origem da imagem: `cliente`, ou `ilustrativa` para banco, Pexels, Pixabay e gerada.
- Com imagem ilustrativa, a instrução diz que ela **não é do negócio**: ilustra o tema, e a legenda não afirma que é o espaço, a equipe ou o trabalho do cliente.

### 5.6 Guia da Karem (`docs/como-configurar-a-ia.md`)

- Nova seção: criar a conta no fal.ai, colocar crédito pequeno (ex.: US$ 5), criar a chave e salvar como segredo `FAL_KEY` no pat-dev.
- A seção de custos ganha o novo tipo `gerada`.
- A regra de ouro continua valendo: a chave nunca vai para o chat.

### 5.7 Decisões de quem escreveu (depois da revisão)

1. **Limites separados de verdade:**
   - A migração acrescenta 'gerada' ao check de `uso_ia.tipo`.
   - A contagem das 400 chamadas (`uso_ia_no_mes`) passa a ignorar as linhas `gerada`.
   - Uma contagem própria conta só as `gerada` do mês, para o limite de 20.
2. **Falha na chamada das palavras-chave:**
   - "ocupado" e falta de tempo seguem a regra que já existe: o post volta para a fila ou fica para depois.
   - JSON inválido ou resposta vazia: a busca usa o tema antigo (`temaDaImagem`) e **não gera** imagem, porque não há prompt.
3. **Aproximação = `post.pilar === 'aprox'`:**
   - Não há segunda chamada. Uma única chamada de escolha recebe "Minhas fotos" primeiro, marcadas como "foto do negócio", com a instrução de preferi-las num post de aproximação.
   - Uma chamada a menos por post, alinhado com gastar o mínimo.
4. **A chamada das palavras-chave acontece sempre que as etapas 1 e 2 não deram imagem**, mesmo sem `FAL_KEY` ou com o limite de 20 já atingido, porque o Pixabay também precisa dela.
5. **Custo da imagem gerada:** é calculado pelas dimensões que o fal.ai devolve. Se faltarem, usa o tamanho pedido.
6. **A imagem gerada é ilustrativa e não volta como "foto do cliente":**
   - Ela fica em `{uid}/banco/`, fora de "Minhas fotos" e das fotos dos serviços, então não entra nas candidatas dos próximos posts.
7. **A origem da imagem não ganha coluna nova no post.** O redator (e também "Gerar outro" e as reescritas) descobre a origem pelo caminho da foto:
   - em `{uid}/banco/` (onde ficam as cópias do banco, Pexels, Pixabay e as geradas) → ilustrativa;
   - qualquer outro caminho → foto do cliente.

## 6. Testes

- Unitários (`escolherImagemGeral`):
  - aproximação com e sem "Minhas fotos";
  - ordem completa até a gerada;
  - ramo só-texto nunca gera;
  - limite de 20 atingido não gera;
  - falha do gerador cai em só texto;
  - Pixabay recebe as palavras-chave, não o título;
  - busca em inglês quando a busca em português volta vazia.
- Adaptadores: o fal.ai é chamado com o formato certo, e uma resposta sem imagem ou com o verificador acusando conteúdo vira null.
- Entrada do redator: uma imagem ilustrativa leva o aviso.
- Teste real no pat-dev depois de a Karem colocar a `FAL_KEY`: gerar um mês e conferir quantas imagens vieram de cada origem e o custo em `uso_ia`.

## 7. O que fica com quem constrói

- Nomes internos, o texto exato das instruções e do prompt de geração, o tempo máximo da geração e o formato exato de tamanho aceito pelo fal.ai (conferir na documentação).
