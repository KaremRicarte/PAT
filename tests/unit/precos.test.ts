import { precosVisiveis } from '../../supabase/functions/_shared/modelos/precos.ts'

test('precosVisiveis: item com "Ocultar preço" vale como item sem preço (a data da promoção continua)', () => {
  const produtos = [
    { id: 'a', nome: 'Gramado', preco: 2199, preco_promo: 1799, promo_data: '2026-11-27', ocultar_preco: true },
    { id: 'b', nome: 'Porto', preco: 1999, preco_promo: null, promo_data: null, ocultar_preco: false },
    { id: 'c', nome: 'Antigo', preco: 10, preco_promo: null, promo_data: null },
  ]
  expect(precosVisiveis(produtos)).toEqual([
    { id: 'a', nome: 'Gramado', preco: null, preco_promo: null, promo_data: '2026-11-27', ocultar_preco: true },
    produtos[1], produtos[2],
  ])
})
