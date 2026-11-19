import { vi } from 'vitest'
vi.mock('../../app/src/artes/imagens.js', () => ({ esquecerImagem: vi.fn() }))
import { datasDaEstrategia, itensEmPromocao, mudancasDeDatas } from '../../app/src/cliente/mes.js'
import { rotuloOcasiao } from '../../app/src/cliente/situacao.js'
import { validarItens, itensParaSalvar } from '../../app/src/cliente/negocio.js'
import { estadoDoNegocio } from '../../app/src/cliente/perguntas.js'
import { itensMudaram } from '../../app/src/cliente/refazer.js'
import { RAMOS } from '../../supabase/functions/_shared/modelos/ramos/index.ts'

const turismo = RAMOS.turismo
const item = (extra = {}) => ({ id: 'a', nome: 'Gramado', descricao: '', precoTexto: '2199', promoTexto: '1799', promoData: null, fotos: [], ...extra })

describe('caixinha "Promoção só para uma data especial"', () => {
  test('marcada pede preço promocional e um dia escolhido', () => {
    expect(validarItens([item({ promoData: '2026-12-25' })], turismo)).toBeNull()
    expect(validarItens([item({ promoData: '2026-12-25', promoTexto: '' })], turismo)).toBe('quiz.itens.datasempromo')
    expect(validarItens([item({ promoData: '' })], turismo)).toBe('quiz.itens.datainvalida')
    expect(validarItens([item()], turismo)).toBeNull()
  })
  test('grava a data só com preço promocional; ida e volta pelo estado do formulário', () => {
    expect(itensParaSalvar([item({ promoData: '2026-12-25' })], turismo)[0]).toMatchObject({ preco: 2199, preco_promo: 1799, promo_data: '2026-12-25' })
    expect(itensParaSalvar([item({ promoData: '2026-12-25', promoTexto: '' })], turismo)[0].promo_data).toBeNull()
    const salvo = { id: 'a', nome: 'Gramado', descricao: null, preco: 2199, preco_promo: 1799, promo_data: '2026-12-25', fotos: [] }
    expect(estadoDoNegocio(null, [salvo], turismo).itens[0].promoData).toBe('2026-12-25')
    expect(estadoDoNegocio(null, [{ ...salvo, promo_data: null }], turismo).itens[0].promoData).toBeNull()
  })
  test('mudar a data da promoção conta como mudança nos itens (oferece refazer os posts)', () => {
    const p = { id: 'a', nome: 'Gramado', preco: 2199, preco_promo: 1799, promo_data: null, fotos: [] }
    expect(itensMudaram([p], [{ ...p, promo_data: '2026-12-25' }])).toBe(true)
  })
})

describe('datas na tela da estratégia', () => {
  const produtos = [
    { nome: 'Gramado', preco: 2199, preco_promo: 1799, promo_data: '2026-12-25' },
    { nome: 'Portugal', preco: 10299, preco_promo: 9999, promo_data: '2026-12-12' },
    { nome: 'Porto Seguro', preco: 1999, preco_promo: null, promo_data: null },
  ]
  test('datas do mês a partir do início, com as promoções marcadas e os "outros dias"', () => {
    const l = datasDaEstrategia({ anoMes: '2026-12', inicio: '2026-12-01' }, turismo, produtos)
    expect(l.map((x) => [x.data, x.nome, x.itens])).toEqual([
      ['2026-12-12', 'Promoção do dia', ['Portugal']],
      ['2026-12-25', 'Natal', ['Gramado']],
      ['2026-12-31', 'Réveillon', []],
    ])
  })
  test('mês gerado do meio: datas que já passaram ficam de fora', () => {
    expect(datasDaEstrategia({ anoMes: '2026-12', inicio: '2026-12-26' }, turismo, produtos).map((x) => x.nome)).toEqual(['Réveillon'])
  })
})

test('tela da estratégia: só itens com preço promocional menor podem ser marcados; grava só o que mudou', () => {
  const produtos = [
    { id: 'g', nome: 'Gramado', preco: '2199.00', preco_promo: '1799.00', promo_data: null },
    { id: 'p', nome: 'Portugal', preco: 10299, preco_promo: 9999, promo_data: '2026-12-12' },
    { id: 's', nome: 'Porto Seguro', preco: 1999, preco_promo: 1999, promo_data: null },
    { id: 'c', nome: 'Cruzeiro', preco: null, preco_promo: null, promo_data: null },
  ]
  expect(itensEmPromocao(produtos, turismo).map((p) => p.id)).toEqual(['g', 'p'])
  expect(itensEmPromocao(produtos, RAMOS.psicologia)).toEqual([])
  const marcadas = new Map([['g', '2026-11-27'], ['p', '2026-12-12']])
  expect(mudancasDeDatas(produtos, marcadas)).toEqual([{ id: 'g', promo_data: '2026-11-27' }])
  marcadas.set('p', null)
  expect(mudancasDeDatas(produtos, marcadas)).toEqual([{ id: 'g', promo_data: '2026-11-27' }, { id: 'p', promo_data: null }])
})

test('marca da data no post', () => {
  expect(rotuloOcasiao({ nome: 'Natal', data: '2026-12-25', fase: 'tema' })).toBe('📅 Natal')
  expect(rotuloOcasiao({ nome: 'Natal', data: '2026-12-25', fase: 'dia' })).toBe('🏷️ Oferta de Natal · 25/12')
  expect(rotuloOcasiao({ nome: 'Dia das Mães', data: '2027-05-09', fase: 'aquecimento' })).toBe('🏷️ Vem aí: oferta do Dia das Mães · 09/05')
  expect(rotuloOcasiao({ nome: null, data: '2026-12-12', fase: 'dia' })).toBe('🏷️ Oferta · 12/12')
  expect(rotuloOcasiao(null)).toBeNull()
  expect(rotuloOcasiao({ fase: 'dia' })).toBeNull()
})
