import { vi } from 'vitest'
import { itensMudaram, contarParaRefazer, depoisDeSalvar } from '../../app/src/cliente/refazer.js'
import { carregarNegocio } from '../../app/src/cliente/negocio.js'

vi.mock('../../app/src/comum.js', () => ({ el: vi.fn(), logo: vi.fn(), mostrar: vi.fn(), aviso: vi.fn(), invocar: (sb, nome, o) => sb.functions.invoke(nome, o) }))
vi.mock('../../app/src/cliente/negocio.js', () => ({ carregarNegocio: vi.fn() }))

const A = { id: 'a', nome: 'Gramado', descricao: null, preco: 2199, preco_promo: 1799, fotos: ['u/a.jpg'], foto_path: 'u/a.jpg' }
const B = { id: 'b', nome: 'Portugal', descricao: null, preco: null, preco_promo: null, fotos: [], foto_path: null }

describe('itensMudaram', () => {
  test('mesma lista: não mudou', () => {
    expect(itensMudaram([A, B], [{ ...A }, { ...B }])).toBe(false)
  })
  test.each([
    ['ordem', [B, A]],
    ['nome', [{ ...A, nome: 'Gramado RS' }, B]],
    ['preço', [{ ...A, preco: 2299 }, B]],
    ['promoção', [{ ...A, preco_promo: null }, B]],
    ['fotos', [{ ...A, fotos: ['u/a.jpg', 'u/a2.jpg'] }, B]],
    ['descrição', [A, { ...B, descricao: 'Lisboa e Porto' }]],
    ['item novo', [A, B, { id: 'c', nome: 'Bonito' }]],
    ['item removido', [A]],
  ])('mudou: %s', (_, depois) => {
    expect(itensMudaram([A, B], depois)).toBe(true)
  })
  test('foto antiga (foto_path) igual à lista de fotos não conta como mudança', () => {
    expect(itensMudaram([{ ...A, fotos: [] }], [A])).toBe(false)
  })
})

test('contarParaRefazer: não aprovados (pendentes e descartados) e todos', () => {
  const posts = [{ estado: 'gerado' }, { estado: 'reprovado' }, { estado: 'aprovado' }]
  expect(contarParaRefazer(posts)).toEqual({ naoAprovados: 2, todos: 3 })
  expect(contarParaRefazer([])).toEqual({ naoAprovados: 0, todos: 0 })
})

describe('depoisDeSalvar segue direto para o app quando não há o que perguntar', () => {
  const supabase = { from: vi.fn() }
  const cliente = { id: 'c1' }

  test('sem mês gerado', async () => {
    const atualizar = vi.fn()
    await depoisDeSalvar({ supabase, cliente, produtos: [A], meses: [], atualizar })
    expect(atualizar).toHaveBeenCalled()
    expect(carregarNegocio).not.toHaveBeenCalled()
  })
  test('itens iguais', async () => {
    carregarNegocio.mockResolvedValueOnce({ produtos: [A] })
    const atualizar = vi.fn()
    await depoisDeSalvar({ supabase, cliente, produtos: [A], meses: [{ id: 'm1' }], atualizar })
    expect(atualizar).toHaveBeenCalled()
    expect(supabase.from).not.toHaveBeenCalled()
  })
  test('itens mudaram mas nenhum post falta', async () => {
    carregarNegocio.mockResolvedValueOnce({ produtos: [A, B] })
    const consulta = { select: () => consulta, in: () => consulta, gte: () => consulta, is: async () => ({ data: [], error: null }) }
    const atualizar = vi.fn()
    await depoisDeSalvar({ supabase: { from: () => consulta }, cliente, produtos: [A], meses: [{ id: 'm1' }], atualizar })
    expect(atualizar).toHaveBeenCalled()
  })
  test('erro ao consultar: o cadastro já está salvo, segue para o app', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    carregarNegocio.mockRejectedValueOnce(new Error('offline'))
    const atualizar = vi.fn()
    await depoisDeSalvar({ supabase, cliente, produtos: [A], meses: [{ id: 'm1' }], atualizar })
    expect(atualizar).toHaveBeenCalled()
  })
})

test('itensMudaram: só marcar ou desmarcar "Ocultar preço" já conta como mudança', () => {
  const A = { id: 'a', nome: 'Gramado', preco: 2199, preco_promo: null, promo_data: null, fotos: [] }
  expect(itensMudaram([A], [{ ...A, ocultar_preco: true }])).toBe(true)
  expect(itensMudaram([{ ...A, ocultar_preco: false }], [A])).toBe(false)
})
