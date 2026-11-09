import { telaInicial } from '../../app/src/cliente/tela.js'

const c = (x = {}) => ({ situacao: 'ativo', senha_provisoria: false, nome: 'Ana', ...x })
test.each([
  [{ sessao: null, cliente: null }, 'entrar'],
  [{ sessao: {}, cliente: null }, 'erro'],
  [{ sessao: {}, cliente: c({ situacao: 'bloqueado', senha_provisoria: true }) }, 'pausado'],
  [{ sessao: {}, cliente: c({ senha_provisoria: true }) }, 'trocar-senha'],
  [{ sessao: {}, cliente: c() }, 'inicio'],
])('%o → %s', (e, tela) => expect(telaInicial(e)).toBe(tela))
