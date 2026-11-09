import { t } from '../../app/src/textos.js'
test('substitui variáveis', () => {
  expect(t('inicio.ola', { nome: 'Ana' })).toBe('Olá, Ana!')
})
test('chave ausente lança erro', () => {
  expect(() => t('nao.existe')).toThrow('texto ausente: nao.existe')
})
