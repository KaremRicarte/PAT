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
