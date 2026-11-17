import { progressoIA, fotosQueServem } from '../../app/src/cliente/situacao.js'

const p = (data, ia_estado) => ({ data, ia_estado })

test('progressoIA: conta só de hoje em diante, na fila ou já feitos', () => {
  const posts = [
    p('2026-11-01', 'pronto'), // passado: não conta
    p('2026-11-17', 'pronto'), p('2026-11-18', 'desistiu'),
    p('2026-11-19', 'fila'), p('2026-11-20', 'trabalhando'),
    p('2026-11-21', 'pulado'), p('2026-11-22', null),
  ]
  expect(progressoIA(posts, '2026-11-17')).toEqual({ feitos: 2, total: 4, ativo: true })
})

test('progressoIA: sem fila ativa, ativo é falso; sem posts, total 0', () => {
  expect(progressoIA([p('2026-11-20', 'pronto')], '2026-11-17')).toEqual({ feitos: 1, total: 1, ativo: false })
  expect(progressoIA([], '2026-11-17')).toEqual({ feitos: 0, total: 0, ativo: false })
})

test('fotosQueServem: tira só as reprovadas; foto sem análise serve', () => {
  const info = new Map([['a', { serve: false, motivo: 'escura' }], ['b', { serve: true }]])
  expect(fotosQueServem(['a', 'b', 'c'], info)).toEqual(['b', 'c'])
  expect(fotosQueServem(['a'], undefined)).toEqual(['a'])
})
