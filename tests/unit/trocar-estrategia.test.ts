import { trocarEstrategiaDoMes, type DepsTrocaEstrategia } from '../../supabase/functions/trocar-estrategia/acoes.ts'

const ID = '11111111-1111-4111-8111-111111111111'
const NEGOCIO = { nome: 'Ferragens Teste', insta: null, tom: 'proximo' as const, horario: '19:00' }
const PRODUTOS = [{ id: 'p1', nome: 'Furadeira', descricao: null, preco: 299.9, preco_promo: null }, { id: 'p2', nome: 'Trena', descricao: null, preco: null, preco_promo: null }]

function deps(extra: Partial<DepsTrocaEstrategia> = {}, mes: Record<string, unknown> | null = {}) {
  const gravar = vi.fn(async () => 7)
  const mesFn = vi.fn(async () => mes === null ? null : ({ id: ID, cliente_id: 'c1', ano_mes: '2026-11', estrategia: 'vender', redes: ['instagram', 'whatsapp'], ...mes }))
  const d: DepsTrocaEstrategia = {
    cliente: async () => ({ id: 'c1', situacao: 'ativo', senha_provisoria: false, ramo: 'ferramentas' }),
    mes: mesFn, negocio: async () => NEGOCIO, produtos: async () => PRODUTOS,
    hoje: () => '2026-11-17', gravar, ...extra,
  }
  return { d, gravar, mesFn }
}
const entrada = { mes_id: ID, estrategia: 'crescer' }

describe('trocarEstrategiaDoMes', () => {
  test('403 sem acesso', async () => {
    for (const c of [null, { id: 'c1', situacao: 'suspenso', senha_provisoria: false, ramo: 'ferramentas' }, { id: 'c1', situacao: 'ativo', senha_provisoria: true, ramo: 'ferramentas' }]) {
      const r = await trocarEstrategiaDoMes(entrada, deps({ cliente: async () => c }).d)
      expect(r.status).toBe(403)
    }
  })
  test('400 sem ramo', async () => {
    const r = await trocarEstrategiaDoMes(entrada, deps({ cliente: async () => ({ id: 'c1', situacao: 'ativo', senha_provisoria: false, ramo: null }) }).d)
    expect(r.status).toBe(400)
  })
  test('400 estratégia inválida', async () => {
    const r = await trocarEstrategiaDoMes({ mes_id: ID, estrategia: 'x' }, deps().d)
    expect(r).toEqual({ status: 400, corpo: { erro: 'Escolha uma estratégia.' } })
  })
  test('id não-uuid: 404 sem consultar', async () => {
    const { d, mesFn } = deps()
    const r = await trocarEstrategiaDoMes({ mes_id: 'abc', estrategia: 'crescer' }, d)
    expect(r).toEqual({ status: 404, corpo: { erro: 'Mês não encontrado.' } })
    expect(mesFn).not.toHaveBeenCalled()
  })
  test('404 inexistente ou de outro cliente', async () => {
    expect((await trocarEstrategiaDoMes(entrada, deps({}, null).d)).status).toBe(404)
    expect((await trocarEstrategiaDoMes(entrada, deps({}, { cliente_id: 'outro' }).d)).status).toBe(404)
  })
  test('409 mês que já terminou', async () => {
    const r = await trocarEstrategiaDoMes(entrada, deps({}, { ano_mes: '2026-10' }).d)
    expect(r).toEqual({ status: 409, corpo: { erro: 'Este mês já terminou.' } })
  })
  test('400 sem negócio ou sem itens', async () => {
    expect((await trocarEstrategiaDoMes(entrada, deps({ negocio: async () => null }).d)).status).toBe(400)
    const r = await trocarEstrategiaDoMes(entrada, deps({ produtos: async () => [] }).d)
    expect(r).toEqual({ status: 400, corpo: { erro: 'Complete o cadastro do seu negócio antes.' } })
  })
  test('mês atual: desde = hoje, só posts de hoje em diante nas redes do mês', async () => {
    const { d, gravar } = deps()
    const r = await trocarEstrategiaDoMes(entrada, d)
    expect(r).toEqual({ status: 200, corpo: { refeitos: 7 } })
    const [mesId, est, desde, posts] = gravar.mock.calls[0] as unknown as [string, string, string, { data: string, rede: string }[]]
    expect([mesId, est, desde]).toEqual([ID, 'crescer', '2026-11-17'])
    expect(posts.length).toBeGreaterThan(0)
    expect(posts.every((p) => p.data >= '2026-11-17' && ['instagram', 'whatsapp'].includes(p.rede))).toBe(true)
  })
  test('mês futuro: desde = primeiro dia do mês', async () => {
    const { d, gravar } = deps({}, { ano_mes: '2026-12' })
    expect((await trocarEstrategiaDoMes(entrada, d)).status).toBe(200)
    const [, , desde, posts] = gravar.mock.calls[0] as unknown as [string, string, string, { data: string }[]]
    expect(desde).toBe('2026-12-01')
    expect(posts.every((p) => p.data >= '2026-12-01')).toBe(true)
  })
  test('validação recusa o mês: 500 sem gravar', async () => {
    const { d, gravar } = deps({ negocio: async () => ({ ...NEGOCIO, nome: 'Loja {prod}' }) })
    const erro = vi.spyOn(console, 'error').mockImplementation(() => {})
    expect(await trocarEstrategiaDoMes(entrada, d)).toEqual({ status: 500, corpo: { erro: 'Não foi possível montar o mês.' } })
    expect(gravar).not.toHaveBeenCalled()
    erro.mockRestore()
  })
})
