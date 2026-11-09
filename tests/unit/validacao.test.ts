import { validarNovoCliente } from '../../supabase/functions/_shared/validacao.ts'

test('normaliza e-mail e telefone brasileiro', () => {
  expect(validarNovoCliente({ nome: ' Ana ', email: ' Ana@X.com ', telefone: '(11) 98765-4321', idioma: 'pt' }))
    .toEqual({ ok: true, dados: { nome: 'Ana', email: 'ana@x.com', telefone: '5511987654321', idioma: 'pt' } })
})
test('espanhol sem DDI é recusado', () => {
  expect(validarNovoCliente({ nome: 'Luz', email: 'l@x.mx', telefone: '55 1234 5678', idioma: 'es' }))
    .toEqual({ ok: false, erro: 'Inclua o código do país no telefone.' })
})
test.each([
  [{ nome: 'A', email: 'a@x.com', telefone: '11987654321', idioma: 'pt' }, 'Informe o nome.'],
  [{ nome: 'Ana', email: 'ana@', telefone: '11987654321', idioma: 'pt' }, 'E-mail inválido.'],
  [{ nome: 'Ana', email: 'a@x.com', telefone: '123', idioma: 'pt' }, 'Telefone inválido. Use DDD e número.'],
  [{ nome: 'Ana', email: 'a@x.com', telefone: '11987654321', idioma: 'en' }, 'Idioma deve ser pt ou es.'],
])('recusa %o', (e, erro) => expect(validarNovoCliente(e)).toEqual({ ok: false, erro }))
test('entrada que não é objeto é recusada', () => {
  expect(validarNovoCliente(null)).toEqual({ ok: false, erro: 'Informe o nome.' })
})
