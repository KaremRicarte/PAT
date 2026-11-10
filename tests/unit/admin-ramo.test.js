import { nomeDoRamo } from '../../app/src/admin/ramo.js'

test('nomeDoRamo mostra o nome do ramo registrado', () => {
  expect(nomeDoRamo('beleza')).toBe('Beleza e bem-estar')
})
test('nomeDoRamo sem ramo ou com ramo desconhecido mostra um traço', () => {
  expect(nomeDoRamo(null)).toBe('—')
  expect(nomeDoRamo('padaria')).toBe('—')
})
