import { vi } from 'vitest'
vi.mock('../../app/src/artes/imagens.js', () => ({ esquecerImagem: vi.fn() }))
import { itemParaGravar, fotoSugerida, postsDoDia, corpoDoRefazer } from '../../app/src/cliente/refazerPost.js'
import { RAMOS } from '../../supabase/functions/_shared/modelos/ramos/index.ts'

test('Refazer este post: os dados corrigidos do item no formato do banco', () => {
  const item = { id: 'g', nome: ' Gramado ', descricao: '', precoTexto: '2.199', promoTexto: '1.599,90', promoData: '2026-12-25', fotos: [] }
  expect(itemParaGravar(item, RAMOS.turismo)).toEqual({ nome: 'Gramado', descricao: null, preco: 2199, preco_promo: 1599.9, promo_data: '2026-12-25', ocultar_preco: false, pacote: null })
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

test('fotoSugerida: a próxima foto do item depois da atual, em ciclo', () => {
  expect(fotoSugerida(['a', 'b', 'c'], 'b')).toBe('c')
  expect(fotoSugerida(['a', 'b', 'c'], 'c')).toBe('a')
  expect(fotoSugerida(['a'], 'a')).toBeNull()
  expect(fotoSugerida(['a', 'b'], 'x')).toBe('a')
  expect(fotoSugerida([], null)).toBeNull()
})

test('postsDoDia: os posts do mesmo dia que ainda não foram postados', () => {
  const posts = [{ id: '1', data: '2026-11-25' }, { id: '2', data: '2026-11-25', postado_em: '2026-11-25T10:00:00Z' },
    { id: '3', data: '2026-11-26' }, { id: '4', data: '2026-11-25', postado_em: null }]
  expect(postsDoDia(posts, posts[0]).map((p) => p.id)).toEqual(['1', '4'])
})

test('corpoDoRefazer: a foto só vai quando foi escolhida; o dia só quando pedido', () => {
  expect(corpoDoRefazer({ postId: 'p', foto: null, dia: false })).toEqual({ post_id: 'p' })
  expect(corpoDoRefazer({ postId: 'p', foto: 'u/x.jpg', dia: true })).toEqual({ post_id: 'p', foto_path: 'u/x.jpg', dia: true })
})

test('Refazer este post: os detalhes do pacote vão para o banco (só Turismo)', () => {
  const pacote = { ativo: true, hotel: 'Serra Azul', ida: null, volta: null, transporte: 'aviao', transfer: false,
    refeicoes: { cafe: false, almoco: false, jantar: false }, preco_por: null, parcelas: null, taxas: false, pix: null }
  const item = { id: 'g', nome: 'Gramado', descricao: '', precoTexto: '2199', promoTexto: '', promoData: null, pacote, fotos: [] }
  expect(itemParaGravar(item, RAMOS.turismo).pacote).toEqual(pacote)
  expect(itemParaGravar(item, RAMOS.psicologia).pacote).toBe(null)
})
