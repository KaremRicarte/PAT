import { telaInicial } from '../../app/src/cliente/tela.js'

const c = (x = {}) => ({ situacao: 'ativo', senha_provisoria: false, nome: 'Ana', ...x })
test.each([
  [{ sessao: null, cliente: null }, 'entrar'],
  [{ sessao: {}, cliente: null }, 'erro'],
  [{ sessao: {}, cliente: c({ situacao: 'bloqueado', senha_provisoria: true }) }, 'pausado'],
  [{ sessao: {}, cliente: c({ senha_provisoria: true }) }, 'trocar-senha'],
  [{ sessao: {}, cliente: c() }, 'inicio'],
])('%o → %s', (e, tela) => expect(telaInicial(e)).toBe(tela))

import { erroTrocaSenha } from '../../app/src/cliente/tela.js'
test('nova senha igual à provisória tem mensagem própria', () => {
  expect(erroTrocaSenha({ code: 'same_password' })).toBe('senha.igual')
  expect(erroTrocaSenha({ code: 'weak_password' })).toBe('senha.fraca')
  expect(erroTrocaSenha({ code: 'outra_coisa' })).toBe('erro.geral')
})
