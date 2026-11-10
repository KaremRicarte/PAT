// Textos de interface. Chaves planas; {var} é trocado pelo valor de vars.var.
// A etapa 5 acrescenta o objeto `es`.
const pt = {
  // entrar
  'entrar.titulo': 'Entrar',
  'entrar.email': 'E-mail',
  'entrar.senha': 'Senha',
  'entrar.botao': 'Entrar',
  'entrar.erro': 'E-mail ou senha incorretos.',

  // trocar senha
  'senha.titulo': 'Crie sua senha',
  'senha.nova': 'Nova senha',
  'senha.repetir': 'Repita a senha',
  'senha.botao': 'Salvar senha',
  'senha.curta': 'A senha precisa ter pelo menos 8 caracteres.',
  'senha.diferente': 'As senhas não são iguais.',
  'senha.igual': 'Escolha uma senha diferente da provisória.',
  'senha.fraca': 'Essa senha é muito fraca. Tente outra.',

  // acesso pausado
  'pausado.titulo': 'Seu acesso está pausado.',
  'pausado.texto': 'Fale com a administração para reativar.',

  // início
  'inicio.ola': 'Olá, {nome}!',
  'inicio.embreve': 'Em breve: seu mês de posts aparece aqui.',

  // cadastro ainda sem ramo (definido pela administração)
  // estratégias (spec §4)
  'estrategia.vender': 'Vender mais',
  'estrategia.vender.desc': 'Produtos e ofertas, com chamadas para o WhatsApp.',
  'estrategia.contatos': 'Atrair contatos',
  'estrategia.contatos.desc': 'Mostrar o seu trabalho e convidar para conversar.',
  'estrategia.crescer': 'Crescer o perfil',
  'estrategia.crescer.desc': 'Posts úteis e curiosidades para salvar e compartilhar, com mais vídeos.',
  'estrategia.credibilidade': 'Credibilidade',
  'estrategia.credibilidade.desc': 'Bastidores, equipe e autoridade no assunto.',
  'estrategia.tempo': 'Economizar tempo',
  'estrategia.tempo.desc': 'Mistura equilibrada, com menos vídeos para gravar.',

  // quiz do mês e geração
  'mesq.titulo': 'O que você quer este mês?',
  'mesq.dica': 'Escolha a estratégia de {mes}. Dá para mudar no mês seguinte.',
  'mesq.sugerido': 'Sugerido',
  'mesq.gerar': 'Gerar meu mês de {mes}',
  'gerando.titulo': 'Montando o seu mês…',
  'gerando.1': 'Lendo seus itens',
  'gerando.2': 'Separando os dias do mês',
  'gerando.3': 'Escrevendo legendas e roteiros',

  // lista do mês
  'mes.titulo': 'Seu mês: {mes}',
  'mes.total': '{n} posts',
  'mes.hoje': 'Hoje',
  'mes.gerarproximo': 'Gerar o mês de {mes}',
  'mes.copiar': 'Copiar legenda',
  'mes.copiado': 'Copiada!',
  'mes.naocopiou': 'Não deu para copiar',
  'mes.roteiro': 'Roteiro / como montar',
  'rede.instagram': 'Instagram',
  'rede.facebook': 'Facebook',
  'rede.tiktok': 'TikTok / Reels',
  'rede.whatsapp': 'WhatsApp',
  'formato.arte': 'Post',
  'formato.carrossel': 'Carrossel',
  'formato.montagem': 'Vídeo com fotos',
  'formato.gravar': 'Vídeo para gravar',
  'formato.stories': 'Stories',
  'formato.status': 'Status',
  'formato.lista': 'Mensagem para a lista',
  'mes.editar': 'Editar meu negócio',
  'semramo.texto': 'Seu cadastro ainda está sendo preparado. Fale com a administração.',

  // quiz do negócio
  'quiz.passo': 'Passo {n} de {total}',
  'quiz.ramo': 'Ramo: {ramo}',
  'quiz.voltar': 'Voltar',
  'quiz.continuar': 'Continuar',
  'quiz.salvar': 'Salvar e continuar',
  'quiz.nome.titulo': 'Como se chama o seu negócio?',
  'quiz.nome.erro': 'Escreva o nome, com pelo menos 2 letras.',
  'quiz.itens.dica': 'Toque numa sugestão ou adicione os seus. Até {max}.',
  'quiz.itens.min': 'Inclua pelo menos 1 item.',
  'quiz.itens.max': 'São no máximo {max} itens.',
  'quiz.itens.promo': 'Na sua área, os textos não podem falar de preço nem de promoção. Revise nomes e descrições.',
  'quiz.nome.promo': 'Na sua área, o nome não pode falar de preço nem de promoção.',
  'quiz.itens.nome': 'Cada item precisa de um nome, com pelo menos 2 letras.',
  'quiz.item.nome': 'Nome',
  'quiz.item.descricao': 'Descrição (opcional)',
  'quiz.item.preco': 'Preço (opcional)',
  'quiz.item.foto': 'Foto (opcional)',
  'quiz.item.remover': 'Remover',
  'quiz.item.adicionar': '+ Adicionar outro',
  'quiz.foto.ok': 'Foto pronta ✓',
  'quiz.foto.salva': 'Foto já enviada ✓ (escolha outra para trocar)',
  'quiz.foto.erro': 'Não consegui abrir essa foto. Tente outra (JPG ou PNG).',
  'quiz.tom': 'Como você gosta de falar com {quem}?',
  'quiz.horario': 'Que horas seus clientes mais usam o celular?',
  'quiz.horario.manha': 'De manhã cedo',
  'quiz.horario.manha.desc': 'Por volta das 7h',
  'quiz.horario.almoco': 'Na hora do almoço',
  'quiz.horario.almoco.desc': 'Por volta do meio-dia',
  'quiz.horario.noite': 'À noite',
  'quiz.horario.noite.desc': 'Por volta das 19h',
  'quiz.marca': 'Sua logo e seu Instagram',
  'quiz.logo': 'Logo (opcional)',
  'quiz.insta': '@ do Instagram (opcional)',
  'quiz.insta.erro': 'O @ só pode ter letras, números, ponto e _ (até 30).',
  'quiz.assinatura': 'Como assinar as artes?',
  'quiz.assinatura.ambos': 'Logo e @',
  'quiz.assinatura.logo': 'Só a logo',
  'quiz.assinatura.insta': 'Só o @',
  'quiz.cores': 'Escolha as cores da sua marca',
  'quiz.cor1': 'Cor principal',
  'quiz.cor2': 'Cor de fundo',

  // erro de cadastro
  'erro.cadastro': 'Não encontramos seu cadastro. Fale com a administração.',
  'erro.geral': 'Algo deu errado. Tente de novo.',

  // comum
  'comum.sair': 'Sair',
  'comum.carregando': 'Carregando…',
  'comum.tentar': 'Tentar de novo',

  // administração
  'admin.soadmin': 'Esta área é só para a administração.',
  'admin.titulo': 'Clientes',
  'admin.novo': 'Novo cliente',
  'admin.nome': 'Nome',
  'admin.email': 'E-mail',
  'admin.telefone': 'Telefone',
  'admin.idioma': 'Idioma',
  'admin.idioma.pt': 'Português',
  'admin.idioma.es': 'Español',
  'admin.situacao': 'Situação',
  'admin.ramo': 'Ramo',
  'admin.ramo.escolha': 'Escolha o ramo',
  'admin.ramo.confirma': 'Trocar o ramo muda os próximos meses gerados. Continuar?',
  'admin.semramo': 'Sem ramo',
  'admin.ativo': 'Ativo',
  'admin.bloqueado': 'Bloqueado',
  'admin.provisoria': 'Senha provisória',
  'admin.criar': 'Criar cliente',
  'admin.senhaprov': 'Senha provisória: {senha}',
  'admin.copiar': 'Copiar',
  'admin.copiado': 'Copiado!',
  'admin.envie': 'Envie ao cliente. Ela não aparece de novo.',
  'admin.redefinir': 'Redefinir senha',
  'admin.redefinir.confirma': 'Redefinir a senha de {nome}?',
  'admin.bloquear': 'Bloquear',
  'admin.bloquear.confirma': 'Bloquear o acesso de {nome}?',
  'admin.reativar': 'Reativar',
  'admin.reativar.confirma': 'Reativar o acesso de {nome}?',
  'admin.vazio': 'Nenhum cliente ainda.',
  'admin.emailrepetido': 'Já existe um cliente com este e-mail.',
}

const textos = { pt }

export function t(chave, vars = {}, idioma = 'pt') {
  const modelo = (textos[idioma] ?? pt)[chave]
  if (modelo === undefined) throw new Error(`texto ausente: ${chave}`)
  return modelo.replace(/\{(\w+)\}/g, (_, nome) => (nome in vars ? String(vars[nome]) : `{${nome}}`))
}
