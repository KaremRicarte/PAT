import { vi } from 'vitest'
vi.mock('../../app/src/artes/imagens.js', () => ({ esquecerImagem: vi.fn() }))
import { itemParaGravar } from '../../app/src/cliente/refazerPost.js'
import { RAMOS } from '../../supabase/functions/_shared/modelos/ramos/index.ts'

test('Refazer este post: os dados corrigidos do item no formato do banco', () => {
  const item = { id: 'g', nome: ' Gramado ', descricao: '', precoTexto: '2.199', promoTexto: '1.599,90', promoData: '2026-12-25', fotos: [] }
  expect(itemParaGravar(item, RAMOS.turismo)).toEqual({ nome: 'Gramado', descricao: null, preco: 2199, preco_promo: 1599.9, promo_data: '2026-12-25', ocultar_preco: false })
  // sem preço promocional, a data da promoção continua (o post da data sai com o preço que houver)
  expect(itemParaGravar({ ...item, promoTexto: '' }, RAMOS.turismo)).toMatchObject({ preco_promo: null, promo_data: '2026-12-25' })
  // ramos com conselho: sem preço
  expect(itemParaGravar(item, RAMOS.psicologia)).toMatchObject({ preco: null, preco_promo: null, promo_data: null })
})

test('Refazer este post: a caixinha Ocultar preço vai para o banco (e nunca em ramos sem preço)', () => {
  const item = { id: 'g', nome: 'Gramado', descricao: '', precoTexto: '2199', promoTexto: '', promoData: null, ocultarPreco: true, fotos: [] }
  expect(itemParaGravar(item, RAMOS.turismo)).toMatchObject({ preco: 2199, ocultar_preco: true })
  expect(itemParaGravar(item, RAMOS.psicologia)).toMatchObject({ ocultar_preco: false })
})
