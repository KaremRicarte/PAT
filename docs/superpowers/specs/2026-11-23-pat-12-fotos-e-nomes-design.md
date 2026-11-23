# PAT · Até 12 fotos por item, revezamento entre meses e nomes de arquivo sem confusão

Data: 2026-11-23 · Tamanho: mudança pequena (design curto)

## Por quê
A Malibu vende Gramado duas vezes por ano e tem 8 fotos do pacote. Com o limite de 6, as fotos extras são
recusadas na importação, e os posts repetem as mesmas imagens. A Karem quer **guardar mais fotos por item** e
**variar as imagens ao longo do ano**. Também quer que nomes de arquivo como `october_fest`, `octoberfest` e
`Octoberfest` contem como o mesmo item, porque para quem usa o app eles são a mesma coisa.

## Objetivos
1. **Até 12 fotos por item**: no app (cadastro e importação), na trava do banco (`produtos.fotos`, que hoje é
   `cardinality <= 6`) e nos textos ("no máximo 6 fotos" passa a dizer 12).
2. **Os nomes de arquivo encontram o item certo.** Na chave da foto, só sai do fim do nome a numeração
   (`_01`, `-2`, ` (3)`, ` 4`) e a extensão. Ficam de fora maiúsculas, acentos, espaços, `_` e `-`. Exemplos:
   `october_fest_01.jpg`, `Octoberfest-2.JPG` e `october fest (3).jpg` → item "October Fest". Hoje,
   `october_fest_01.jpg` vira "october" e não acha o item. Arquivo sem número (`gramado.jpg`) continua valendo.
3. **Nada de itens repetidos.** Dois itens cujos nomes ficam iguais pela mesma regra ("October Fest" e
   "october fest") não podem ser salvos juntos. Aparece o aviso "Esse item já está na lista".
4. **Nada de fotos repetidas.** Se a mesma foto (o mesmo conteúdo) for importada de novo para o mesmo item,
   ela é ignorada em silêncio e não ocupa uma das 12 vagas.
5. **Revezamento entre meses.** Hoje a foto de um post de item é escolhida pela ordem do post dentro do mês,
   então todo mês recomeça das mesmas fotos. Com 12 fotos, as **menos usadas recentemente** vêm primeiro, e o
   revezamento continua de um mês para o outro. Isso vale também quando a IA escolhe a foto
   (`melhorar-posts`): entre as fotos do item que servem para o post, ela prefere as que não foram usadas
   pelo cliente nos últimos meses.

## Fora do escopo
- Não haverá drive externo (Google Drive, Dropbox). As fotos continuam no armazenamento do próprio PAT
  (Supabase, bucket `marcas`). O espaço do plano grátis (1 GB) dá cerca de 2.500 fotos no total. Com mais
  clientes, será preciso o plano pago.
- Não haverá "sinônimo" por grafia diferente (Oktoberfest com k × October): só maiúsculas, acentos, espaços e
  separadores.
- Os dados atuais da Malibu não serão corrigidos automaticamente (o item duplicado e as fotos repetidas). A
  Karem apaga o item duplicado à mão, e o aviso do objetivo 3 aparece para ela.

## Abordagens consideradas
- **Drive na nuvem externo**: cada cliente conectaria a própria conta, com mais pontos de falha e sem ganho.
  Descartado.
- **Limite maior (escolhida: 12)**: cobre o caso da Malibu com folga, com tela e espaço razoáveis. 20 e "sem
  limite" foram descartados por deixar a tela do item longa no celular e gastar espaço rápido.

## Decisões deixadas para quem constrói
- Como guardar o "uso recente": reaproveitar `fotos_usadas` (que já existe para o banco de imagens), um
  deslocamento por mês, ou outra solução. O resultado precisa ser estável: o mesmo post mostra sempre a mesma
  foto enquanto nada mudar.
- Como reconhecer a foto repetida: um resumo do conteúdo (hash) no nome do arquivo guardado é uma boa opção.
- A migração que troca a trava de 6 para 12.
