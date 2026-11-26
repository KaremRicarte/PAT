import { vi } from 'vitest'
vi.mock('../../app/src/artes/imagens.js', () => ({ esquecerImagem: vi.fn() }))
import { postsDoPacote, corpoDoTexto, temEditarPacote } from '../../app/src/cliente/editarPacote.js'
import { RAMOS } from '../../supabase/functions/_shared/modelos/ramos/index.ts'

test('postsDoPacote: os posts do mesmo pacote que faltam (de hoje em diante e não postados)', () => {
  const posts = [
    { id: '1', produto_id: 'g', data: '2026-11-26' }, { id: '2', produto_id: 'g', data: '2026-11-30' },
    { id: '3', produto_id: 'g', data: '2026-11-20' }, { id: '4', produto_id: 'g', data: '2026-11-28', postado_em: '2026-11-28T10:00:00Z' },
    { id: '5', produto_id: 'p', data: '2026-11-27' },
  ]
  expect(postsDoPacote(posts, { produto_id: 'g' }, '2026-11-26').map((p) => p.id)).toEqual(['1', '2'])
})

test('corpoDoTexto: só este post ou todos os posts do pacote', () => {
  expect(corpoDoTexto('p1', 'este')).toEqual({ post_id: 'p1' })
  expect(corpoDoTexto('p1', 'todos')).toEqual({ post_id: 'p1', item: true })
})

test('temEditarPacote: só no Turismo, em post de um pacote que existe', () => {
  const produtos = [{ id: 'g', nome: 'Gramado' }]
  expect(temEditarPacote({ produto_id: 'g' }, RAMOS.turismo, produtos)).toBe(true)
  expect(temEditarPacote({ produto_id: null }, RAMOS.turismo, produtos)).toBe(false)
  expect(temEditarPacote({ produto_id: 'x' }, RAMOS.turismo, produtos)).toBe(false)
  expect(temEditarPacote({ produto_id: 'g' }, RAMOS.beleza, produtos)).toBe(false)
})
