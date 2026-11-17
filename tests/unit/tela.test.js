import { telaInicial } from '../../app/src/cliente/tela.js'

const c = (x = {}) => ({ situacao: 'ativo', senha_provisoria: false, nome: 'Ana', ...x })
test.each([
  [{ sessao: null, cliente: null }, 'entrar'],
  [{ sessao: {}, cliente: null }, 'erro'],
  [{ sessao: {}, cliente: c({ situacao: 'bloqueado', senha_provisoria: true }) }, 'pausado'],
  [{ sessao: {}, cliente: c({ senha_provisoria: true }) }, 'trocar-senha'],
  [{ sessao: {}, cliente: c() }, 'sem-ramo'],
  [{ sessao: {}, cliente: c({ ramo: 'padaria' }) }, 'sem-ramo'],
  [{ sessao: {}, cliente: c({ ramo: 'beleza' }), negocio: null }, 'quiz-negocio'],
  // negócio sem itens e sem mês: os itens agora são pedidos junto com o mês
  [{ sessao: {}, cliente: c({ ramo: 'beleza' }), negocio: {}, produtos: [], mes: null }, 'quiz-mes'],
  [{ sessao: {}, cliente: c({ ramo: 'beleza' }), negocio: {}, produtos: [], mes: {} }, 'mes'],
  [{ sessao: {}, cliente: c({ ramo: 'beleza' }), negocio: {}, produtos: [{}], mes: null }, 'quiz-mes'],
  [{ sessao: {}, cliente: c({ ramo: 'beleza' }), negocio: {}, produtos: [{}], mes: {} }, 'mes'],
  [{ sessao: {}, cliente: c({ ramo: 'beleza', senha_provisoria: true }), negocio: {}, mes: {} }, 'trocar-senha'],
  [{ sessao: {}, cliente: c({ ramo: 'beleza', situacao: 'bloqueado' }), negocio: {}, mes: {} }, 'pausado'],
])('%o → %s', (e, tela) => expect(telaInicial(e)).toBe(tela))

import { erroTrocaSenha } from '../../app/src/cliente/tela.js'
test('nova senha igual à provisória tem mensagem própria', () => {
  expect(erroTrocaSenha({ code: 'same_password' })).toBe('senha.igual')
  expect(erroTrocaSenha({ code: 'weak_password' })).toBe('senha.fraca')
  expect(erroTrocaSenha({ code: 'outra_coisa' })).toBe('erro.geral')
})

// Link de "Esqueci minha senha": a sessão de recuperação vai para a tela de nova senha, mesmo bloqueado.
test.each([
  [{ sessao: {}, recuperando: true, cliente: c() }, 'nova-senha'],
  [{ sessao: {}, recuperando: true, cliente: c({ situacao: 'bloqueado' }) }, 'nova-senha'],
  [{ sessao: {}, recuperando: true, cliente: null }, 'nova-senha'],
  [{ sessao: null, recuperando: true, cliente: null }, 'entrar'],
])('recuperação: %o → %s', (e, tela) => expect(telaInicial(e)).toBe(tela))

import { erroEsqueci } from '../../app/src/cliente/tela.js'
test('pedido de link repetido demais tem mensagem própria', () => {
  expect(erroEsqueci({ status: 429 })).toBe('esqueci.limite')
  expect(erroEsqueci({ code: 'over_email_send_rate_limit' })).toBe('esqueci.limite')
  expect(erroEsqueci({ status: 500 })).toBe('erro.geral')
})
