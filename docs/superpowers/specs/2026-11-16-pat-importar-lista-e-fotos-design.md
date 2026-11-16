# PAT · Importar lista e fotos, preço "de/por" e posts de oferta: especificação

Data: 2026-11-16 · Status: aprovada pela Karem em 2026-11-16
Ramo: `v2-etapa3`, ainda em testes. Este trabalho entra antes da Etapa 4 (IA).
Faz parte de um par de projetos. Este é o primeiro. O segundo, o **calendário de datas por ramo** (§9), vem depois e reaproveita os posts de oferta criados aqui.

## 1. Por que

Configurar o negócio dá trabalho:
- cada serviço aceita uma foto só, enviada uma por uma;
- não existe um campo de preço promocional;
- o post de oferta sai só às sextas, na estratégia "Vender mais", com o texto genérico "a partir de R$ X".

A Karem quer dois resultados:
1. O dono do negócio configura **tudo de uma vez pelo computador**: um arquivo de texto simples, mais as fotos.
2. O mês traz **posts de promoção "de/por"** e **posts que só mostram o preço**, conforme o que ele informou.

O arquivo é **opcional**. Quem não quiser usá-lo preenche os mesmos campos à mão em "Editar meu negócio".

## 2. Metas, o que fica de fora e o que seria fracasso

**Metas**
- Importar um `.txt` (ou `.csv`) e várias fotos num só gesto, no navegador do computador.
- Cada item ganha **preço normal**, **preço promocional** e **várias fotos**, pela importação ou à mão.
- Gerar três tipos de tratamento de preço: promoção, vitrine de preço e sem preço (§5).

**Fora deste projeto**
- O calendário de datas comemorativas (§9).
- A IA nos textos (Etapa 4).
- Importação pelo celular. O botão aparece no celular também, mas o caso pensado é o computador.
- Planilha `.xlsx`. A ideia é que **ninguém precise do Office**.

**Seria fracasso, mesmo funcionando**
- O cliente precisar instalar algum programa, ou entender "CSV".
- O app mostrar preço ou promoção em psicologia ou advocacia (regras do CFP e da OAB).
- A importação **apagar** itens ou fotos que o cliente já tinha, sem ele ver isso antes.
- Um post de um item mostrar a foto de outro item. Essa regra já vale desde o commit 596327d.

## 3. O arquivo

Uma linha por item: `nome;preço normal;preço promocional`

```
Gramado;2199;1799
Leste Europeu;10299;9999
portoseguro;1999;1999
portugal;0;0
```

**Regras de leitura**
- **Separador:** `;`. Para quem montar no Excel em português, também se aceita `,`, mas só quando a linha não tem `;`.
- **Linhas ignoradas:** em branco, e as que começam com `#`.
- **Nome:** é usado do jeito que está escrito (`Leste Europeu`). Se vier "colado" (`lesteeuropeu`), entra assim e o cliente corrige na revisão.
- **Preços:** aceitam `2199`, `2.199`, `2199,90`, `2.199,90` e `R$ 2.199,90`, como faz o `precoDoTexto` atual. Vazio ou `0` quer dizer "sem preço".
- **Significado de cada combinação:**

  | Preço normal | Preço promocional | O que acontece |
  |---|---|---|
  | > 0 | menor que o normal | **promoção** |
  | > 0 | igual ao normal, ou vazio | **vitrine de preço** |
  | 0 / vazio | 0 / vazio | **sem preço** |
  | 0 / vazio | > 0 | erro na linha ("informe o preço normal") |
  | > 0 | maior que o normal | erro na linha ("o promocional precisa ser menor") |

- **Linha só com o nome** (`portugal`): vale como "sem preço".
- **Codificação do arquivo:** primeiro tenta UTF‑8. Se aparecerem caracteres quebrados, tenta Windows‑1252, que é o padrão do Bloco de Notas antigo.

**Fotos**
- Cada foto vai para o item cujo **nome normalizado** é igual ao **começo do nome do arquivo, até o primeiro `_`**.
  - Normalizar é: minúsculas, sem acento, sem espaço e sem pontuação.
  - Exemplo: `lesteeuropeu_praga.jpg` e `Leste-Europeu_1.JPG` vão para "Leste Europeu".
- Arquivo sem `_`: usa o nome inteiro, sem a extensão. Assim, `gramado.jpg` vai para Gramado.
- Formatos aceitos: JPG, PNG, WEBP e HEIC, quando o navegador conseguir abrir.
- As fotos são reduzidas no navegador, como hoje (`reduzirFoto`, lado maior de 1600 px, JPEG 85%), antes de subir.

## 4. Telas

### 4.1 Onde fica
No passo dos itens do quiz do negócio, o mesmo que aparece em "Editar meu negócio", entra um botão secundário no topo: **"Importar lista e fotos"**. Abaixo dele, uma linha de ajuda: *"Tem muitos itens? Monte um arquivo de texto no computador e envie junto com as fotos."* e o link **"Como montar o arquivo"**, que abre um exemplo pronto para copiar.

### 4.2 Escolher os arquivos
O botão abre o seletor de arquivos com seleção múltipla (`.txt`, `.csv` e imagens). No computador, também se pode **arrastar** a pasta inteira, ou os arquivos, para uma área tracejada que aparece na tela. O cliente seleciona o arquivo de texto e todas as fotos de uma vez. Ele também pode enviar só as fotos, para itens que já existem, ou só o texto.

### 4.3 Revisão (antes de salvar)
A importação **não grava nada**. Ela só preenche a lista do passo dos itens, que já é a tela de revisão, porque o cliente ainda precisa tocar em "Salvar". No topo aparece um resumo:

```
Importamos:  3 itens novos · 1 atualizado · 14 fotos
⚠ 2 fotos não encontraram item: praia_1.jpg, praia_2.jpg
⚠ Linha 4: o promocional precisa ser menor que o normal
```

**Junção com o que já existe:**
- Um item do arquivo com o mesmo nome normalizado de um item atual é **atualizado**: os preços são trocados e as fotos novas são **somadas** às que ele já tinha.
- Um item novo é **criado**.
- Um item atual que não está no arquivo **continua**. Nada é apagado.

**Na lista:** cada item mostra nome, descrição, preço normal, preço promocional e a **faixa de fotos**, com miniaturas, um "✕" em cada foto para remover e "+ Adicionar foto".
- Itens novos têm o selo **"Novo"**.
- Itens com fotos novas têm o selo **"+N fotos"**.

**Limites:** se passar do limite de itens ou de fotos (§6), o resumo diz o quanto passou. Os itens ou fotos que sobraram não entram, e a lista mostra quais ficaram de fora.

### 4.4 Preenchimento à mão
O editor de cada item, com ou sem importação, ganha:
- o campo **"Preço promocional (opcional)"**, ao lado do campo de preço, que passa a se chamar **"Preço normal (opcional)"**;
- a **faixa de fotos**, que substitui o campo "Foto (opcional)" de hoje e aceita várias fotos.

Em psicologia e advocacia, os campos de preço continuam escondidos, como hoje. A importação nesses ramos lê nomes e fotos, ignora os preços e avisa no resumo: *"Na sua área, os preços não aparecem nos posts."*

## 5. Posts

**Três tratamentos**, por item:
- **Promoção:** legenda com *"De R$ 2.199 por R$ 1.799"* e uma chamada de oferta. Na arte, um **selo "de/por"** com o preço antigo riscado e o novo em destaque.
- **Vitrine de preço:** legenda com *"Por R$ 1.999"*, sem palavras de promoção. Na arte, o selo só com o preço.
- **Sem preço:** nunca fala de valor.

**Quantos posts de preço por mês** (opção A, aprovada):
- Estratégia **"Vender mais"**: cada item com preço ganha **1 post** de promoção ou vitrine no mês. Os itens em promoção vêm primeiro.
- **Outras estratégias**: no máximo **2 posts** de preço no mês todo, dando preferência aos itens em promoção.
- Esses posts entram no lugar de posts "demo" do feed, que também sai no Facebook, e caem preferencialmente em sextas e sábados.
- A mensagem para a lista do WhatsApp sobre um item com preço inclui o preço do mesmo jeito.
- O texto antigo "Condição especial esta semana: a partir de…" **sai**.

**Fotos nos posts**
- O post de um item **reveza as fotos daquele item** pela ordem do post.
- A montagem de vídeo usa **várias fotos do item**, até 4.
- A regra para posts gerais, de 596327d, continua.

**O preço fica guardado no post.** Assim, a arte e a legenda não se contradizem se o cliente mudar o preço depois de gerar o mês. O post guarda `preco_de` e `preco_por` (ou só `preco_por`, na vitrine). Mudar o preço vale para os **próximos** meses e para o "Gerar outro".

**Validação**
- `validarPost` continua barrando preço e promoção em ramos `noPromo`.
- Nos outros ramos, a palavra de promoção só pode aparecer em post de promoção, e a legenda da vitrine não pode dizer "promoção".

## 6. Dados e limites

**Itens:** `produtos` ganha `preco_promo numeric(10,2)`, que pode ficar vazio e, quando preenchido, precisa ser maior que 0 e no máximo igual ao `preco`.

**Fotos de cada item:** várias por item. O formato fica a critério de quem constrói: uma tabela `produto_fotos` com `ordem`, ou um array em `produtos`.
- `foto_path` continua valendo como a 1ª foto, para as telas que já o usam.
- Caminho no Storage: `{uid}/produtos/{produto_id}/{foto_id}.jpg`.
- Os arquivos atuais (`{uid}/produtos/{id}.jpg`) continuam válidos.

**Posts:** `posts` ganha `preco_de numeric(10,2)` e `preco_por numeric(10,2)`, ambos podendo ficar vazios.

**Limites (aprovados):**
- **até 20 itens** por negócio (hoje são 12);
- **até 6 fotos por item**.

Conta de espaço: uma foto reduzida tem uns 300 KB. Então 20 × 6 × 300 KB dá **uns 36 MB por cliente** no pior caso. O Supabase grátis tem 1 GB, o que dá umas 25 contas cheias.

**Remoção:** apagar um item ou uma foto também remove o arquivo do Storage, com o mesmo esforço de hoje.

## 7. Caminhos considerados

| | Caminho | Por que não, ou por que sim |
|---|---|---|
| **A** (escolhido) | Selecionar ou arrastar o .txt e as fotos juntos no navegador; ler, juntar e reduzir no próprio aparelho | Natural no computador, sem programas, e as fotos sobem já reduzidas. |
| B | Enviar um `.zip` | Muita gente não sabe compactar, e o .zip atrapalha em alguns aparelhos. |
| C | Processar no servidor | Sobe as fotos no tamanho original, é mais lento e mais caro, sem ganho para o cliente. |

A Karem escolheu a **A** e pediu **.txt**, para ninguém depender do Office.

## 8. Testes
- **Leitura do arquivo:** separadores, preços, linhas inválidas, codificação e linhas em branco ou com `#`.
- **Normalização e associação das fotos.**
- **Junção com a lista atual:** novo, atualizado e nunca apagar.
- **Limites.**
- **Geração:** contagem de posts de preço por estratégia; a legenda e o selo de cada tratamento; nada de preço em `noPromo`; o preço guardado no post.
- **Integração:** salvar várias fotos, ler, remover uma foto e remover um item.
- **Teste manual da Karem no computador:** um arquivo com os 4 exemplos de §3 e umas 10 fotos.

## 9. Depois deste projeto: calendário de datas por ramo (projeto separado)
Combinado: **o app sugere e o cliente confirma**.
- O quiz do mês ganha o passo *"Datas deste mês que combinam com o seu negócio"*, com as datas já marcadas e a opção de desmarcar.
- Para cada data confirmada:
  - antes da data, saem os **posts de oferta** deste projeto, com os itens em promoção;
  - no dia, sai um **post comemorativo**.
- Psicologia e advocacia recebem as datas sem oferta (ex.: Setembro Amarelo).
- Esse projeto tem especificação própria.

## 9b. Regras finas (decisões do Claude depois da revisão)
- **Mais itens com preço do que vagas:** os posts de preço só ocupam vagas de "demo" do feed. Itens em promoção têm prioridade sobre os de vitrine, na ordem da lista. Os que não couberem ficam sem post de preço naquele mês, e a contagem de posts por rede (`validarMes`) não muda.
- **Como contar:** um "post de preço" é **um dia de feed**. O Instagram e o Facebook do mesmo dia contam como 1. Stories, Status e TikTok não levam preço. A mensagem para a lista do WhatsApp mostra o preço do item só na estratégia "Vender mais", como hoje.
- **Linha do arquivo com preço em branco:** num item que já existe, deixa o preço como está. **`0` explícito** limpa o preço. A linha `portugal;0;0` quer dizer "sem preço"; a linha `portugal` sozinha só acrescenta fotos ou cria o item.
- **"Gerar outro" num post de preço:** o post novo usa os preços **atuais** do item e grava `preco_de`/`preco_por` de novo. Se a vaga regerada não for mais de preço, os campos ficam vazios.
- **Palavras permitidas em cada tratamento:**
  - promoção: tudo;
  - vitrine: `R$`, mas sem "promoção", "desconto", "oferta", "off" e "black friday";
  - sem preço: nada disso;
  - ramos `noPromo`: nada disso, como hoje.
- **Limite de fotos ao juntar:** as fotos que o item já tinha ficam. As novas entram até o limite, e as que sobram aparecem no resumo como "ficaram de fora".

## 10. Decisões do Claude aprovadas pela Karem (2026-11-16)
- Quantidade de posts de preço por mês (§5, opção A).
- Limites: 20 itens e 6 fotos por item (§6).
- Selo de preço desenhado na arte, além da legenda (§5).
- Juntar com a lista atual sem apagar nada (§4.3).
- Separador `,` aceito como alternativa (§3).

## 11. O que fica para quem constrói
- Formato das fotos múltiplas (tabela ou array) e a migração dos dados atuais.
- Desenho exato do selo "de/por" em cada estilo de ramo (`LOOKS`).
- Texto exato das legendas de promoção e vitrine em cada ramo. Os modelos ficam em `_shared/modelos/ramos/`.
- Como a área de arrastar aparece e se comporta.
