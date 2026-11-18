# Como configurar a IA do PAT (passo a passo)

Para a IA escrever os posts, o PAT precisa de **4 chaves** (pense nelas como senhas de acesso para o app):

| Chave | Para que serve | Custa? |
|---|---|---|
| Anthropic (Claude) | Escreve os textos dos posts | Sim, pago por uso (centavos por post) |
| Pexels | Busca fotos | Grátis |
| Pixabay | Busca fotos (reserva) | Grátis |
| fal.ai (FLUX) | Cria imagens quando não há foto | Sim, por uso (menos de 1 centavo de dólar por imagem) |

Tempo estimado: uns 20 minutos. Os nomes de menus podem mudar um pouco com o tempo; se algo não estiver exatamente onde escrevi, procure um item parecido.

> **Regra de ouro:** chave é segredo. Nunca cole em conversas (nem aqui no Claude Code), e-mails, mensagens ou dentro do app. O único lugar onde ela entra é o Supabase (seção 4). Se vazar, é só apagar a chave no site e criar outra (veja a seção 8).

Dica: abra o Bloco de Notas e vá colando as chaves lá enquanto cria. **Não salve o arquivo**: no final, feche o Bloco de Notas e escolha **"Não salvar"**.

---

## 1. Anthropic (Claude)

### 1.1 Criar a conta
1. Abra **https://console.anthropic.com**.
2. Crie uma conta (e-mail ou Google) e confirme o e-mail.

### 1.2 Colocar crédito
1. Dentro do console, procure **"Billing"** (Cobrança) ou **"Plans & Billing"** no menu.
2. Adicione um cartão e compre um crédito pequeno para começar (por exemplo, **US$ 10**).
3. Você deve ver o saldo de crédito aparecendo na tela.

### 1.3 Definir um limite de gasto mensal
Isso evita surpresas na fatura.
1. Ainda na área de cobrança/limites, procure **"Limits"** ou **"Spend limits"** (limite de gasto).
2. Defina um limite mensal baixo para o teste, por exemplo **US$ 20**.
3. Salve.

### 1.4 Criar a chave
1. No menu, procure **"API Keys"**.
2. Clique em **"Create Key"** (criar chave).
3. Dê um nome, por exemplo `PAT teste`.
4. **Copie a chave agora.** Ela começa com `sk-ant-...` e **só aparece uma vez**. Se fechar a tela sem copiar, é só apagar e criar outra.
5. Cole no Bloco de Notas com o rótulo `ANTHROPIC`.

---

## 2. Pexels (fotos, grátis)

1. Abra **https://www.pexels.com/api**.
2. Crie uma conta gratuita (ou entre, se já tiver).
3. Peça a chave de API (botão tipo **"Get Started"** / **"Request API Key"**) e preencha o formulário curto (nome, e-mail e para que vai usar, por exemplo "app de posts para redes sociais").
4. A chave aparece na tela. Copie e cole no Bloco de Notas com o rótulo `PEXELS`.

## 3. Pixabay (fotos, grátis)

1. Abra **https://pixabay.com** e crie uma conta gratuita.
2. Depois de entrar (logada), abra **https://pixabay.com/api/docs**.
3. A sua chave aparece na própria página de documentação (procure por "key" ou "Your API key"). Copie e cole no Bloco de Notas com o rótulo `PIXABAY`.

## 3b. fal.ai (imagens criadas pela IA)

Usada só quando nenhuma foto serve para o post: aí a IA cria uma imagem nova.

1. Abra **https://fal.ai** e crie uma conta (e-mail, Google ou GitHub).
2. Procure **"Billing"** (Cobrança) no menu e adicione um crédito pequeno, por exemplo **US$ 5**.
3. No menu, abra **"API Keys"** e clique em criar uma chave (**"Add key"** / **"Create key"**). Dê um nome, por exemplo `PAT teste`.
4. **Copie a chave agora**, pois ela pode não aparecer de novo. Cole no Bloco de Notas com o rótulo `FAL`.

---

## 4. Colocar as 4 chaves no Supabase de teste

As chaves ficam guardadas como **segredos** no projeto de teste (`pat-dev`). Escolha **uma** das opções. **Prefira a Opção A.**

Os nomes precisam ser **exatamente** estes (letras maiúsculas e underline):

- `ANTHROPIC_API_KEY`
- `PEXELS_API_KEY`
- `PIXABAY_API_KEY`
- `FAL_KEY`

### Opção A: pelo site do Supabase
1. Entre em **https://supabase.com/dashboard** e abra o projeto **pat-dev**.
2. No menu da esquerda, clique em **Edge Functions**.
3. Procure **Secrets** (segredos) e clique para adicionar.
4. Em **Name**, digite `ANTHROPIC_API_KEY`; em **Value**, cole a chave da Anthropic. Salve.
5. Repita para `PEXELS_API_KEY`, `PIXABAY_API_KEY` e `FAL_KEY` (com a chave do fal.ai).
6. Você deve ver os 4 nomes na lista (o valor fica escondido, isso é normal).

### Opção B: copiando um comando
Atenção: o comando com as chaves fica guardado no histórico do terminal (as setas para cima mostram de novo). Por isso a Opção A é melhor; use esta só se a A não funcionar.

1. Abra o terminal na pasta do PAT.
2. Troque os quatro trechos `COLE_AQUI_...` pelas suas chaves (mantenha o resto igual) e cole o comando inteiro:

```
npx supabase secrets set ANTHROPIC_API_KEY=COLE_AQUI_A_ANTHROPIC PEXELS_API_KEY=COLE_AQUI_A_PEXELS PIXABAY_API_KEY=COLE_AQUI_A_PIXABAY FAL_KEY=COLE_AQUI_A_FAL --project-ref bvliykfmrgbrqimmdria
```

3. Aperte Enter. Deve aparecer uma mensagem de que os segredos foram atualizados (algo como "Finished supabase secrets set").

> **Atenção:** nunca cole as chaves em chats (nem aqui no Claude Code), e-mails, redes sociais ou dentro do app PAT. Para configurar, use só a Opção A ou a B.

---

## 5. Como testar

1. Abra o PAT (versão de teste) e **gere um mês** de posts. Se já existe um mês, **troque a estratégia do mês** ou **gere o próximo mês**.
2. Você deve ver a faixa **"✨ Melhorando seus posts…"**. Melhorar um mês inteiro leva **vários minutos**; pode deixar a tela aberta e fazer outra coisa.
3. Se a faixa parar de andar, feche e abra o calendário de novo: ela volta a mostrar o andamento.
4. Quando terminar, os posts escritos pela IA mostram o selo **"✨ Escrito para você"**.

Se as chaves não estiverem configuradas, **tudo continua funcionando**: os posts saem com os textos-modelo de sempre (os "templates"), só sem o selo.

**Posts que passaram pela IA sem chave, com a chave errada ou sem crédito ficam como templates.** Eles não são melhorados sozinhos depois que você arruma as chaves. Quando as chaves estiverem certas, peça ao Claude Code: *"coloque de novo na fila da IA os posts que ficaram como template"*. Ele faz isso por você.

---

## 6. Como acompanhar o gasto

**No Claude Console:** abra o console, procure **"Usage"** (uso) ou **"Cost"** (custo) no menu. Lá você vê quanto já gastou e quantas chamadas foram feitas.

**No Supabase (tabela `uso_ia`):**
1. Abra o projeto **pat-dev**.
2. Clique em **Table Editor** e escolha a tabela **`uso_ia`**.
3. Cada linha é uma chamada à IA. As colunas principais:
   - **tipo**: que tipo de chamada foi: `foto` (descrever uma foto), `post` (escrever um post), `troca` ("Gerar outro" ou reescrever depois de "Trocar imagem"), `imagem` (escolher a imagem do post) ou `gerada` (imagem criada pelo fal.ai).
   - **tokens_entrada** e **tokens_saida**: o "tamanho" do que foi enviado e do que voltou. Quanto mais tokens, mais caro.
   - **custo_usd**: custo estimado dessa chamada, em dólares.

**Limite de segurança:** cada cliente pode fazer no máximo **400 chamadas de IA por mês**. Passou disso, os posts continuam sendo gerados com os textos-modelo, sem a IA, até o mês seguinte.

**Imagens criadas (fal.ai):** aparecem na tabela `uso_ia` com o tipo `gerada`. Cada cliente pode ter no máximo **20 imagens criadas por mês**, e elas **não contam** nas 400 chamadas acima. Passou do limite, o post segue sem imagem criada.

---

## 7. E se algo der errado?

- **Chave errada ou faltando:** os posts saem com os textos-modelo. Nada quebra. Confira os nomes dos segredos e se copiou a chave inteira, sem espaços. Depois, peça ao Claude Code para pôr de novo na fila os posts que ficaram como template (seção 5).
- **Crédito acabou ou limite mensal atingido:** mesma coisa, os posts continuam com os textos-modelo. Para voltar a usar a IA, adicione crédito (ou aumente o limite) no Claude Console e peça ao Claude Code para pôr de novo na fila os posts que ficaram como template.
- **Sem imagem gerada:** sem chave, sem crédito ou limite do mês: o post sai só com texto.
- **Sem foto da IA:** se o Pexels falhar, o app tenta o Pixabay; se os dois falharem, o post fica sem foto sugerida, mas o texto aparece normal.

## 8. Se uma chave vazar

1. Entre no site de onde ela veio (Anthropic, Pexels, Pixabay ou fal.ai).
2. Apague/revogue a chave antiga e crie uma nova.
3. Troque o valor no Supabase repetindo o passo 4 com a chave nova.

Pronto. Qualquer dúvida em algum passo, me mande um print da tela (sem mostrar a chave).
