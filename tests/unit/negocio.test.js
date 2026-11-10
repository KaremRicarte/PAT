import { medidaReduzida, validarItens, precoDoTexto, normalizarInsta } from '../../app/src/cliente/negocio.js'

test.each([
  [4000, 3000, 1600, { largura: 1600, altura: 1200 }],
  [800, 600, 1600, { largura: 800, altura: 600 }],
  [1000, 3000, 1600, { largura: 533, altura: 1600 }],
  [1600, 1600, 1600, { largura: 1600, altura: 1600 }],
])('medidaReduzida(%i, %i, %i)', (l, a, max, esperado) => {
  expect(medidaReduzida(l, a, max)).toEqual(esperado)
})

const item = (nome, preco = null) => ({ nome, preco })
test('validarItens', () => {
  expect(validarItens([])).toBe('quiz.itens.min')
  expect(validarItens(Array.from({ length: 13 }, (_, i) => item(`Item ${i}`)))).toBe('quiz.itens.max')
  expect(validarItens([item(' a ')])).toBe('quiz.itens.nome')
  expect(validarItens([item('x'.repeat(81))])).toBe('quiz.itens.nome')
  expect(validarItens([item('Furadeira'), item('  Trena  ')])).toBeNull()
  expect(validarItens(Array.from({ length: 12 }, (_, i) => item(`Item ${i}`)))).toBeNull()
})

test.each([
  ['299,90', 299.9], ['R$ 1.299,90', 1299.9], ['50', 50], ['  80,5 ', 80.5], ['1299.90', 1299.9],
  ['', null], ['   ', null], ['abc', null], ['0', null], ['-10', null],
])('precoDoTexto(%j) → %s', (s, esperado) => {
  expect(precoDoTexto(s)).toBe(esperado)
})

test.each([
  ['', null], ['  ', null], ['loja', '@loja'], ['@loja.da_ana', '@loja.da_ana'], [' @Loja ', '@Loja'],
  ['loja da ana', undefined], ['@' + 'a'.repeat(31), undefined],
])('normalizarInsta(%j) → %s', (s, esperado) => {
  expect(normalizarInsta(s)).toBe(esperado)
})

test('em ramo sem promoção, item com preço ou promoção no texto é recusado no quiz', () => {
  expect(validarItens([{ nome: 'Consulta R$ 200', descricao: '' }], { noPromo: true })).toBe('quiz.itens.promo')
  expect(validarItens([{ nome: 'Consulta', descricao: 'com desconto' }], { noPromo: true })).toBe('quiz.itens.promo')
  expect(validarItens([{ nome: 'Psicoterapia 100% online', descricao: 'promover bem-estar' }], { noPromo: true })).toBeNull()
  expect(validarItens([{ nome: 'Corte com desconto', descricao: '' }], { noPromo: false })).toBeNull()
})
