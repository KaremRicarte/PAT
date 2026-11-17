import { trocarPostDoCliente, type DepsTroca } from '../../supabase/functions/trocar-post/acoes.ts'
import { gerarMes } from '../../supabase/functions/_shared/modelos/gerar.ts'

const ID = '11111111-1111-4111-8111-111111111111'
const POST = {
  id: ID, mes_id: 'm1', data: '2026-12-02', rede: 'instagram', tipo: 'feed', formato: 'arte', horario: '18:30',
  ordem: 0, trocas: 2, legenda: 'texto antigo', cliente_id: 'c1', ano_mes: '2026-12', estrategia: 'vender',
}

const falsos = (extra: Partial<DepsTroca> = {}): DepsTroca => ({
  cliente: async () => ({ id: 'c1', situacao: 'ativo', senha_provisoria: false, ramo: 'ferramentas' }),
  post: async () => ({ ...POST }),
  trocasDoMes: async () => 3,
  negocio: async () => ({ nome: 'Ferragens', insta: null, tom: 'proximo', horario: '19:00' }),
  produtos: async () => [
    { id: 'p1', nome: 'Furadeira', descricao: null, preco: 99.9, preco_promo: null },
    { id: 'p2', nome: 'Trena a laser', descricao: null, preco: null, preco_promo: null },
  ],
  gravar: vi.fn(async () => {}),
  ...extra,
})

test.each([
  ['sem cliente', { cliente: async () => null }],
  ['bloqueado', { cliente: async () => ({ id: 'c1', situacao: 'bloqueado', senha_provisoria: false, ramo: 'ferramentas' }) }],
  ['senha provisória', { cliente: async () => ({ id: 'c1', situacao: 'ativo', senha_provisoria: true, ramo: 'ferramentas' }) }],
])('%s → 403', async (_, extra) => {
  const deps = falsos(extra as Partial<DepsTroca>)
  expect(await trocarPostDoCliente({ post_id: ID }, deps))
    .toEqual({ status: 403, corpo: { erro: 'Seu acesso não permite trocar posts.' } })
  expect(deps.gravar).not.toHaveBeenCalled()
})

test.each([
  ['post de outro cliente', { post: async () => ({ ...POST, cliente_id: 'c2' }) }, { post_id: ID }],
  ['post que não existe', { post: async () => null }, { post_id: ID }],
  ['id que não é uuid', {}, { post_id: 'abc' }],
  ['sem post_id', {}, {}],
  ['entrada que não é objeto', {}, null],
])('%s → 404', async (_, extra, entrada) => {
  const deps = falsos(extra as Partial<DepsTroca>)
  expect(await trocarPostDoCliente(entrada, deps)).toEqual({ status: 404, corpo: { erro: 'Post não encontrado.' } })
  expect(deps.gravar).not.toHaveBeenCalled()
})

test('id inválido nem chega a consultar o banco', async () => {
  const deps = falsos({ post: vi.fn(async () => null) })
  await trocarPostDoCliente({ post_id: "x' or 1=1" }, deps)
  expect(deps.post).not.toHaveBeenCalled()
})

test.each([10, 11])('%s trocas no mês → 429', async (n) => {
  const deps = falsos({ trocasDoMes: async () => n })
  expect(await trocarPostDoCliente({ post_id: ID }, deps))
    .toEqual({ status: 429, corpo: { erro: 'Você já usou as 10 trocas deste mês.' } })
  expect(deps.gravar).not.toHaveBeenCalled()
})

test('9 trocas no mês ainda deixa trocar', async () => {
  expect((await trocarPostDoCliente({ post_id: ID }, falsos({ trocasDoMes: async () => 9 }))).status).toBe(200)
})

test.each([
  ['sem negócio', { negocio: async () => null }],
  ['sem produtos', { produtos: async () => [] }],
])('%s → 400', async (_, extra) => {
  expect(await trocarPostDoCliente({ post_id: ID }, falsos(extra as Partial<DepsTroca>)))
    .toEqual({ status: 400, corpo: { erro: 'Complete o cadastro do seu negócio antes.' } })
})

test('troca grava o texto novo, volta a situação e soma 1', async () => {
  const deps = falsos()
  const r = await trocarPostDoCliente({ post_id: ID }, deps)
  expect(r.status).toBe(200)
  const [id, campos] = (deps.gravar as ReturnType<typeof vi.fn>).mock.calls[0]
  expect(id).toBe(ID)
  expect(Object.keys(campos).sort()).toEqual(
    ['estado', 'foto_path', 'hashtags', 'legenda', 'pilar', 'preco_de', 'preco_por', 'produto_id', 'roteiro', 'sem_foto',
      'titulo', 'trocas'])
  expect(campos).toMatchObject({ estado: 'gerado', foto_path: null, sem_foto: false, trocas: 3, preco_de: null, preco_por: null })
  expect(campos.legenda).not.toBe('texto antigo')
  expect(r.corpo.post).toMatchObject({
    ...campos, id: ID, mes_id: 'm1', data: POST.data, rede: 'instagram', tipo: 'feed', formato: 'arte', horario: '18:30', ordem: 0,
  })
})

test('advocacia: troca não fala de preço', async () => {
  const deps = falsos({
    cliente: async () => ({ id: 'c1', situacao: 'ativo', senha_provisoria: false, ramo: 'advocacia' }),
    produtos: async () => [{ id: 'p1', nome: 'Consulta', descricao: null, preco: 300 }],
  })
  const r = await trocarPostDoCliente({ post_id: ID }, deps)
  expect(r.status).toBe(200)
  expect(JSON.stringify(r.corpo.post)).not.toMatch(/R\$|oferta|promo|desconto/i)
})

test('post que não passa na validação → 500 e nada é gravado', async () => {
  // um nome com marcador sobrando (o feed do Facebook leva o nome da loja) faz a validação recusar
  const deps = falsos({
    post: async () => ({ ...POST, rede: 'facebook' }),
    negocio: async () => ({ nome: 'Loja {prod}', insta: null, tom: 'proximo', horario: '19:00' }),
  })
  const erro = vi.spyOn(console, 'error').mockImplementation(() => {})
  expect(await trocarPostDoCliente({ post_id: ID }, deps))
    .toEqual({ status: 500, corpo: { erro: 'Não foi possível gerar outro post.' } })
  expect(deps.gravar).not.toHaveBeenCalled()
  erro.mockRestore()
})

test('sem texto novo para oferecer → 422 e nada é gravado (nem a troca conta)', async () => {
  // com 1 produto, as duas mensagens da lista do mês têm o mesmo texto
  const deps = falsos({
    post: async () => ({ ...POST, rede: 'whatsapp', tipo: 'lista', formato: 'texto', data: '2026-12-03' }),
    produtos: async () => [{ id: 'p1', nome: 'Furadeira', descricao: null, preco: 99.9 }],
  })
  expect(await trocarPostDoCliente({ post_id: ID }, deps)).toEqual({ status: 422, corpo: {
    erro: 'Não encontrei outro texto diferente para este post. Você pode usar "Só descartar".' } })
  expect(deps.gravar).not.toHaveBeenCalled()
})

test('troca de um post de preço grava preco_de/preco_por do item atual', async () => {
  const produtos = [
    { id: 'p1', nome: 'Furadeira', descricao: null, preco: 99.9, preco_promo: 79.9 },
    { id: 'p2', nome: 'Serra circular', descricao: null, preco: 450, preco_promo: 399 },
  ]
  const original = gerarMes({
    ramo: 'ferramentas', estrategia: 'vender', anoMes: '2026-12', inicio: '2026-12-01',
    negocio: { nome: 'Ferragens', insta: null, tom: 'proximo', horario: '19:00' }, produtos,
  }).find((p) => p.rede === 'instagram' && p.tipo === 'feed' && p.data === '2026-12-04')!
  expect(original).toMatchObject({ produto_id: 'p1', preco_de: 99.9, preco_por: 79.9 })
  const deps = falsos({
    post: async () => ({ ...POST, data: '2026-12-04', trocas: 0, legenda: original.legenda }),
    produtos: async () => produtos,
  })
  const r = await trocarPostDoCliente({ post_id: ID }, deps)
  expect(r.status).toBe(200)
  const [, campos] = (deps.gravar as ReturnType<typeof vi.fn>).mock.calls[0]
  expect(campos).toMatchObject({ produto_id: 'p2', preco_de: 450, preco_por: 399 })
  expect(campos.legenda).toContain('De R$ 450 por R$ 399.')
  expect(r.corpo.post).toMatchObject({ preco_de: 450, preco_por: 399 })
})

test('descrição do cliente com R$ não trava a troca (Facebook leva a descrição)', async () => {
  const deps = falsos({
    post: async () => ({ ...POST, rede: 'facebook' }),
    produtos: async () => [
      { id: 'p1', nome: 'Furadeira', descricao: 'A partir de R$ 1.500, com desconto', preco: 99.9, preco_promo: null },
      { id: 'p2', nome: 'Trena a laser', descricao: 'Desde R$ 80', preco: null, preco_promo: null },
    ],
  })
  const r = await trocarPostDoCliente({ post_id: ID }, deps)
  expect(r.status).toBe(200)
  expect(deps.gravar).toHaveBeenCalled()
})
