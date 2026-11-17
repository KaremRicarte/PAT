# Separar "Meu negócio" (fixo) de "Este mês" — design

**Data:** 17/11/2026 · **Dona do produto:** Karem · **Status:** aguardando aprovação (revisado por um leitor externo)

## 1. Por quê

Hoje tudo fica no "Editar meu negócio", um passo a passo de 6 telas que mistura o que quase nunca muda
(nome, logo, cores) com o que muda todo mês (serviços, fotos, importação). A estratégia só aparece na hora de gerar o mês
e não dá para encontrá-la depois. O cliente precisa pensar onde está cada coisa.

**Objetivo:** cada coisa no lugar onde o cliente a procura, com layout simples e intuitivo:
- **Meu negócio** (fixo, raro de mudar): botão no topo, ao lado da logo PAT.
- **Este mês** (muda todo mês): um cartão no calendário, logo abaixo do nome do mês.

**Não objetivos (agora):** cobrança por rede e controle das redes pelo painel da administradora (vem depois; os dados ficam prontos
para isso, §6). Mudar como os posts são gerados. Mudar o calendário abaixo do cartão.

**Anti-objetivos:** o cliente perder posts postados; uma troca mudar algo sem ele confirmar; mais telas e passos do que hoje
para a mesma tarefa.

## 2. O que vai em cada lugar (aprovado pela Karem)

| Meu negócio (fixo) | Este mês |
|---|---|
| Nome · Marca (logo, @, assinatura) · Tom de voz · Horário · Cores · **Redes** | **Estratégia** · **Serviços/produtos** (preços, fotos, importação) |

- **Redes ficam em Meu negócio** e uma mudança **só vale a partir do próximo mês gerado**. O mês em andamento segue com as
  redes com que foi gerado. (Karem: "só seja permitido adicionar ou excluir no início do mês"; no futuro a quantidade de redes
  será cobrada e controlada pelo painel da administradora.)

## 3. Telas

### 3.1 Topo do app (todas as telas do cliente com o calendário)
```
[PAT]                ⚙ Meu negócio   🔔   Sair
```

### 3.2 Calendário
```
Novembro
┌ Este mês ─────────────────────────────┐
│ Estratégia: Vender mais      [Trocar] │
│ Serviços: 4 itens · 1 sem foto        │
│                    [Editar/Importar]  │
│ Redes: Instagram, WhatsApp            │  ← só informação; muda em Meu negócio
└───────────────────────────────────────┘
[Gerar o mês de dezembro]   (só a partir do dia 21, como hoje)
resumo · avisos · calendário · posts (como hoje)
```
- O botão "Editar meu negócio" sai do calendário (vira o ⚙ do topo).
- O aviso "N serviços estão sem foto" passa a abrir a tela de serviços (3.4), não mais o quiz inteiro.

### 3.3 Meu negócio (página-resumo, sem passo a passo)
```
Meu negócio                         [Voltar]
Nome          Viagens Ana           [Alterar]
Marca         logo · @viagensana    [Alterar]
Tom de voz    Próximo               [Alterar]
Horário       19h                   [Alterar]
Cores         ■ ■                   [Alterar]
Redes         Instagram, WhatsApp   [Alterar]
              Vale a partir do próximo mês.
```
- Cada "Alterar" abre **só aquela pergunta** (a mesma tela do quiz de hoje) com **Salvar** e **Voltar**; salvar grava e volta
  para a página-resumo.
- Mudar o nome, a marca, o tom, o horário ou as cores **não** refaz posts (o horário e as cores já valem nas artes na hora).

### 3.4 Serviços do mês (Editar/Importar)
- A tela de itens de hoje (importação no topo, itens do arquivo primeiro, depois a lista manual), sozinha, com **Salvar** e **Voltar**.
- Depois de salvar: a pergunta de refazer que já existe (refazer os não aprovados / todos que faltam / manter).

### 3.5 Trocar a estratégia (no meio do mês)
- Mostra as estratégias (os mesmos cartões do quiz do mês), com a atual marcada.
- Ao escolher outra: confirmação
  > "Os **N posts que faltam** (de hoje até o fim do mês) serão refeitos com a estratégia *Crescer o perfil*,
  > inclusive os aprovados. Os já postados não mudam." [Trocar e refazer] [Cancelar]
- Por que refaz todos que faltam (e não só os não aprovados): cada estratégia tem um calendário diferente (ex.: "Crescer" tem
  mais vídeos), então os dias e os tipos de post mudam; não dá para manter só parte deles sem misturar as duas agendas.

### 3.6 Primeiro acesso
1. **Meu negócio** (passo a passo, como hoje, mas só o fixo): nome → marca → tom → horário → cores → redes.
2. **Seu mês**: serviços (com importação) → estratégia → **Gerar meu mês**.

### 3.7 Gerar o mês seguinte (a partir do dia 21)
"Gerar o mês de dezembro" abre **Seu mês**: serviços (já preenchidos, para conferir ou importar) → estratégia → Gerar.
As redes vêm de Meu negócio (o quiz do mês deixa de perguntar as redes).

## 4. Regras

- **Redes:** guardadas no negócio (`negocios.redes`, padrão: as 4). A geração do mês usa as redes do negócio, lidas no
  servidor (não mais enviadas pelo app). Clientes atuais: as redes do negócio começam iguais às do mês mais recente.
  Mínimo uma rede (como hoje no quiz do mês).
- **Troca de estratégia no meio do mês:** só no mês em andamento (o que contém hoje) ou num mês futuro já gerado.
  Grava a nova estratégia no mês; apaga os posts **não postados** de hoje em diante e gera os novos de hoje até o fim do mês
  com a nova estratégia, nas redes do mês; tudo numa transação só (se falhar, nada muda). Se algum post postado ocupar o mesmo
  dia/rede/tipo de um novo, o novo não é criado. Não gasta o limite de trocas.
- **Serviços:** iguais a hoje (são do cliente, não de um mês); a mudança vale para os próximos posts e oferece o refazer.

## 5. Abordagens consideradas

1. **Reorganizar as telas reaproveitando as perguntas do quiz** (escolhida): cada pergunta do quiz vira um "bloco" que pode
   rodar sozinho (Alterar) ou em sequência (primeiro acesso). Pouca lógica nova; o que muda é a navegação.
2. **Página de configurações única, com todos os campos e um Salvar no fim:** mais rápida de fazer, mas é um formulário longo
   para quem só quer trocar a cor — o contrário do "simples e intuitivo".
3. **Manter o quiz e só adicionar atalhos:** não resolve a mistura de fixo com mensal.

## 6. Pronto para o futuro (sem construir agora)

- A cobrança por rede vai precisar de "redes contratadas" por cliente, definidas no painel. Com as redes já no negócio,
  isso será: a administradora define as permitidas; o cliente escolhe dentre elas em Meu negócio. Nada disso entra agora.

## 7. Chamadas minhas (Claude) — conferir

1. As redes ficam em `negocios.redes` (e não em `clientes`), porque é escolha do cliente; as "contratadas" do futuro irão em `clientes`.
2. Trocar a estratégia refaz **todos** os posts que faltam, inclusive aprovados (motivo em 3.5), com confirmação mostrando o número.
3. Trocar a estratégia só de hoje em diante; dias passados ficam como estão.
4. Um cliente atual que tenha negócio salvo mas nenhum serviço cai em **Seu mês** (antes caía no quiz do negócio).
5. "Meu negócio" não refaz posts; só os serviços e a estratégia oferecem refazer.
6. **Qual mês o cartão mostra:** o mês aberto no calendário. "Trocar" aparece no mês em andamento e num mês futuro já gerado;
   num mês que já terminou, a estratégia aparece sem botão. Num mês futuro, a troca refaz o mês inteiro (a partir do dia em que
   ele começou), não "de hoje em diante".
7. **Sem mês gerado** o cartão não existe: o app já leva o cliente para "Seu mês" (3.6) antes do calendário.
8. **Troca no meio do mês:** os novos posts vão de hoje (inclusive) até o fim do mês, usando a agenda que o gerador já monta
   para um mês começado no meio (mesmas regras de quando o mês é gerado até o dia 20: os dias que restam, com os limites de cada
   tipo). Um post postado bloqueia só o novo post do mesmo dia, rede e tipo. Precisa de uma função nova no banco (apagar e
   inserir numa transação só).
9. **Refazer nos serviços** vale para qualquer caminho que abra a tela de serviços (cartão ou aviso de fotos).
10. **Redes:** o cartão mostra as redes do mês (as com que ele foi gerado); Meu negócio mostra as do negócio, com o aviso
    "Vale a partir do próximo mês que você gerar". Se o próximo mês já foi gerado, a mudança vale para o seguinte.
11. **Compatibilidade:** a função gerar-mes passa a ignorar as redes enviadas pelo app e usa as do negócio.

## 8. Fica com quem constrói

Nomes de arquivos e funções, o desenho exato do cartão "Este mês" e da página-resumo (seguindo o estilo atual: `cartao`,
`selo`, `acoes`), a ordem das tarefas, os testes.
