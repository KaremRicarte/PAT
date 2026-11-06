# PAT – Presença Ativa · Versão 2 — Especificação

Data: 2026-11-06 · Status: aguardando revisão da Karem

## 1. Objetivo

Dar ao dono de pequeno negócio um mês inteiro de conteúdo profissional para as redes sociais, alinhado a uma meta que ele escolhe, e fazer com que ele poste de fato, sem esquecer.

Sucesso = clientes que geram o mês, publicam a maior parte dos posts previstos e relatam resultado (contatos, seguidores, credibilidade).

## 2. Decisões

| Tema | Decisão |
|---|---|
| Público | Dono do pequeno negócio, que faz tudo sozinho |
| Estratégia | Escolhida todo mês no quiz: Vender mais · Crescer o perfil · Credibilidade · Economizar tempo |
| Resultados | No mês seguinte o app pergunta como foi, mostra a evolução e sugere a próxima estratégia. Sem integração com as redes |
| Redes | Instagram, Facebook, TikTok e WhatsApp |
| Textos | IA (Claude), com os modelos prontos como reserva |
| Acesso | A administradora cria os logins; a cobrança é feita fora do app |
| Entrega | Calendário com lembrete; o dono copia, baixa e posta manualmente |
| Lembrete | Notificação do celular (web push). WhatsApp fica para a v2 |
| Visual | Fotos do dono + modelos de arte com a identidade dele + roteiros de vídeo para gravar |
| Idiomas | Português (Brasil) e espanhol neutro (América Latina), escolhidos por cliente; valem para as telas e para os posts |
| Plataforma | App web instalável no celular (PWA) + painel de administração |
| Infraestrutura | Supabase (login, banco Postgres, armazenamento, funções) + Netlify (hospedagem, ligado ao GitHub) |

Suposições confirmadas: os 5 ramos atuais continuam e outros podem ser acrescentados; as regras do CFP e da OAB continuam valendo; o código do PAT atual é aproveitado e dividido em módulos.

## 3. Componentes

### 3.1 App do cliente (PWA)
- **Entrar:** e-mail e senha criados pela administradora. Troca obrigatória da senha no primeiro acesso.
- **Quiz do negócio** (uma vez, editável): ramo, nome, @ do Instagram, logo, cores, fotos dos produtos ou serviços, idioma, tipo de assinatura (logo / @ / os dois).
- **Quiz do mês:** resultados do mês anterior (a partir do 2º mês) e estratégia, com sugestão do app.
- **Geração:** monta o calendário do mês para as 4 redes.
- **Revisão:** aprovar, editar o texto ou "gerar outro" em cada post.
- **Calendário do dia a dia:** em cada post, os botões *copiar legenda*, *baixar arte*, *ver roteiro* e **✓ Postei**.
- **Evolução:** gráfico simples mês a mês, com a taxa de publicação e os resultados informados.
- As artes (canvas) e os vídeos (Reels/TikTok) são montados no próprio aparelho, como no PAT atual.

### 3.2 Painel de administração
Acesso só para a conta com o papel `admin`.
- **Visão geral:** clientes ativos, posts gerados e publicados no mês, taxa de publicação (publicados ÷ previstos até hoje) e alertas: 7 dias sem acesso, 7 dias sem postar, mês atual não gerado, notificações desligadas.
- **Lista de clientes:** nome, ramo, idioma, último acesso, estratégia do mês, barra postados/previstos e situação (ativo / parado / bloqueado). Com filtros e ordenação.
- **Ficha do cliente:** calendário com os dias postados, histórico de meses (estratégia, taxa, resultados) e as ações: criar/redefinir senha, bloquear/reativar, "chamar no WhatsApp" (link `wa.me` com mensagem pronta).
- **Criar cliente:** nome, e-mail, telefone e idioma, com senha provisória gerada pelo sistema.

### 3.3 Base no Supabase
- **Auth:** papéis `admin` e `cliente`.
- **Tabelas** (rascunho):
  - `clientes` (id, nome, email, telefone, idioma, situacao, criado_em)
  - `negocios` (cliente_id, ramo, nome, insta, assinatura, cores, logo_path, dados do quiz)
  - `produtos` (negocio_id, nome, descricao, preco opcional, foto_path)
  - `meses` (cliente_id, ano_mes, estrategia, origem ia|modelo, gerado_em)
  - `posts` (mes_id, data, rede, tipo, titulo, legenda, hashtags, horario, roteiro, estado: gerado|aprovado|editado, trocas)
  - `postagens` (post_id, confirmado_em): o "✓ Postei"
  - `resultados` (mes_id, contatos, seguidores, percepcao, respondido_em)
  - `eventos` (cliente_id, tipo, criado_em): acessos e ações, para o painel
  - `push_inscricoes` (cliente_id, endpoint, chaves)
- **Row Level Security:** o cliente só lê e escreve o que é dele; o `admin` lê tudo.
- **Storage:** bucket privado para logos e fotos.
- **Edge Functions:**
  - `gerar-mes`: chama o Claude e valida a resposta; usa os modelos prontos como reserva.
  - `gerar-post`: troca de um único post.
  - `lembrete-diario` (agendada, de manhã no fuso do cliente): envia a notificação para quem tem post no dia.
  - `admin-clientes`: cria e redefine usuários (precisa da chave de serviço, que fica só no servidor).

### 3.4 Aproveitado do PAT
Os ramos, a tabela `LOOKS`, o desenho das artes, a montagem dos Reels, `sig()`, as regras `textOnly`/`noPromo` e os modelos de texto (que viram a reserva e ganham versão em espanhol).

## 4. Conteúdo do mês

| Rede | Entrega |
|---|---|
| Instagram | 12 posts no feed (3 por semana; arte única e carrossel) + Stories nos mesmos dias |
| Facebook | Os mesmos 12, com legenda adaptada (mais longa, menos hashtags) e o tamanho da imagem ajustado |
| TikTok / Reels | 4 vídeos: 2 montados com as fotos + 2 roteiros para gravar |
| WhatsApp | 8 Status + 2 mensagens para a lista de clientes (uma por quinzena) |

**Mistura por estratégia**
- *Vender mais:* produto e oferta, chamadas para o WhatsApp, mensagens de lista com oferta.
- *Crescer o perfil:* posts úteis e curiosidades, chamadas do tipo "salva e compartilha", mais vídeos.
- *Credibilidade:* bastidores, depoimentos, autoridade no assunto, equipe.
- *Economizar tempo:* mistura equilibrada, menos vídeos para gravar.

**Regras do ramo têm prioridade.** Em psicologia e advocacia, "Vender mais" vira "Atrair contatos", sem preço nem promoção.

## 5. Fluxo de geração

1. O app envia o pacote: negócio, produtos, ramo, estratégia, idioma e resultados anteriores.
2. `gerar-mes` pede ao Claude o calendário completo em JSON (para cada post: data, rede, tipo, título da arte, legenda, hashtags, horário, roteiro).
3. O servidor valida: esquema, palavras proibidas pelo ramo, tamanho das legendas, quantidade de posts por rede.
4. O que falhar na validação é preenchido pelos modelos prontos (um post ou o mês inteiro), sem aviso de erro ao cliente.
5. O aparelho monta as artes e os vídeos com a identidade visual do cliente.
6. Revisão: aprovar, editar ou "gerar outro" (limite: 10 trocas por mês).

Modelo: o Claude mais recente com bom custo-benefício para texto (definido no plano). Custo-alvo: menos de R$ 1 por cliente por mês.

## 6. Erros e situações especiais

- **IA indisponível ou lenta (mais de 60 s):** usa os modelos prontos.
- **Sem internet:** o calendário do mês fica salvo no aparelho; o "✓ Postei" entra numa fila e é enviado quando a conexão voltar.
- **Foto grande:** é reduzida no aparelho antes do envio.
- **Notificação recusada ou indisponível:** aviso no calendário; no iPhone, instruções para adicionar à tela inicial.
- **Cliente bloqueado:** a tela "Seu acesso está pausado", com o contato da administradora.

## 7. Segurança

- As chaves do Claude e de serviço do Supabase ficam só nas Edge Functions.
- A RLS fica em todas as tabelas, com testes.
- Limite de gerações por cliente por mês (1 mês completo + 10 trocas).
- Backup diário (padrão do Supabase).

## 8. Testes

- **Automáticos:** as regras de cada ramo (por exemplo, nunca preço em psicologia ou advocacia), a mistura de cada estratégia, os modelos de reserva em PT e ES, a validação da resposta da IA e as políticas de RLS (um cliente não lê os dados de outro).
- **Manual, antes de cada entrega:** criar cliente → quiz → gerar mês → aprovar → "✓ Postei" → conferir no painel.
- **Piloto:** 3 a 5 clientes reais durante um mês.

## 9. Ordem de construção

1. Supabase (tabelas, RLS, login) + painel de administração mínimo (criar clientes).
2. App do cliente: quiz + geração por modelos prontos (código do PAT dividido em módulos).
3. Integração com o Claude + revisão de posts.
4. Calendário, "✓ Postei", modo sem internet e notificações.
5. Painel completo, resultados mensais e espanhol.
6. Piloto.

## 10. Fora desta versão

Publicação automática nas redes · lembrete por WhatsApp · imagens geradas por IA · pagamento dentro do app · LinkedIn e Google Meu Negócio · leitura automática de métricas das redes.
