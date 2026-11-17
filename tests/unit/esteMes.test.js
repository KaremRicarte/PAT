import { podeTrocarEstrategia, postsQueMudam, resumoServicos } from '../../app/src/cliente/esteMes.js'
import { RAMOS } from '../../supabase/functions/_shared/modelos/ramos/index.ts'

test('só troca a estratégia do mês atual ou de um mês futuro', () => {
  expect(podeTrocarEstrategia({ ano_mes: '2026-11' }, '2026-11-17')).toBe(true)
  expect(podeTrocarEstrategia({ ano_mes: '2026-12' }, '2026-11-17')).toBe(true)
  expect(podeTrocarEstrategia({ ano_mes: '2026-10' }, '2026-11-17')).toBe(false)
  expect(podeTrocarEstrategia({ ano_mes: '2025-12' }, '2026-01-01')).toBe(false)
})

const p = (data, postado_em = null) => ({ data, postado_em })

test('posts que mudam: não postados de hoje em diante (mês atual)', () => {
  const posts = [p('2026-11-10'), p('2026-11-17'), p('2026-11-18'), p('2026-11-20', '2026-11-20T10:00:00Z'), p('2026-11-30')]
  expect(postsQueMudam(posts, { ano_mes: '2026-11' }, '2026-11-17')).toBe(3)
})

test('posts que mudam: num mês futuro, todos os não postados', () => {
  const posts = [p('2026-12-01'), p('2026-12-05'), p('2026-12-06', '2026-12-06T10:00:00Z')]
  expect(postsQueMudam(posts, { ano_mes: '2026-12' }, '2026-11-17')).toBe(2)
  expect(postsQueMudam([], { ano_mes: '2026-12' }, '2026-11-17')).toBe(0)
})

test('resumo dos serviços: quantidade e quantos estão sem foto', () => {
  const com = { id: 1, nome: 'A', fotos: ['a.jpg'] }
  const sem = { id: 2, nome: 'B', fotos: [] }
  expect(resumoServicos([com, sem, sem, com], RAMOS.beleza)).toBe('4 itens · 2 sem foto')
  expect(resumoServicos([com, sem], RAMOS.beleza)).toBe('2 itens · 1 sem foto')
  expect(resumoServicos([com], RAMOS.beleza)).toBe('1 item')
  expect(resumoServicos([], RAMOS.beleza)).toBe('0 itens')
})
