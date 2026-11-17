import { refazerPostsDoCliente, postsDoModo, type DepsRefazer, type PostQueFalta } from '../../supabase/functions/refazer-posts/acoes.ts'
import { refazerPosts } from '../../supabase/functions/_shared/modelos/refazer.ts'
import { gerarMes, type Pacote } from '../../supabase/functions/_shared/modelos/gerar.ts'

const NEGOCIO = { nome: 'Viagens Teste', insta: null, tom: 'proximo' as const, horario: '19:00' }
const ANTIGOS = [{ id: 'p1', nome: 'Bonito', descricao: null, preco: null, preco_promo: null }]
const NOVOS = [
  { id: 'p2', nome: 'Gramado', descricao: null, preco: 2199, preco_promo: 1799 },
  { id: 'p3', nome: 'Portugal', descricao: null, preco: null, preco_promo: null },
]
const pacote = (produtos: Pacote['produtos']): Pacote =>
  ({ ramo: 'turismo', estrategia: 'vender', anoMes: '2026-12', inicio: '2026-12-01', negocio: NEGOCIO, produtos })

// O mês "antigo", como se tivesse sido gerado com os itens de antes.
const mesAntigo = gerarMes(pacote(ANTIGOS))
const comoNoBanco = (extra: (i: number) => Partial<PostQueFalta> = () => ({})): PostQueFalta[] =>
  mesAntigo.map((p, i) => ({ id: `id${i}`, data: p.data, rede: p.rede, tipo: p.tipo, formato: p.formato, horario: '08:00',
    ordem: p.ordem, estado: 'gerado', postado_em: null, ano_mes: '2026-12', estrategia: 'vender', ...extra(i) }))

describe('refazerPosts', () => {
  test('cada lugar ganha o post dos itens novos e mantém data, rede, tipo, formato e horário', () => {
    const lugares = comoNoBanco()
    const novos = refazerPosts(pacote(NOVOS), lugares)
    expect(novos).toHaveLength(lugares.length)
    novos.forEach((n, i) => {
      expect(n).toMatchObject({ data: lugares[i].data, rede: lugares[i].rede, tipo: lugares[i].tipo,
        formato: lugares[i].formato, horario: '08:00', ordem: lugares[i].ordem })
      expect(n!.produto_id === null || ['p2', 'p3'].includes(n!.produto_id)).toBe(true)
    })
    // o post de oferta do Gramado aparece com o preço
    expect(novos.some((n) => n!.preco_de === 2199 && n!.preco_por === 1799)).toBe(true)
  })
  test('sem o lugar exato (mês gerado a partir do meio), usa a data mais próxima da mesma rede e tipo', () => {
    const feed = mesAntigo.find((p) => p.rede === 'instagram' && p.tipo === 'feed')!
    const [novo] = refazerPosts(pacote(NOVOS), [{ ...feed, data: '2026-12-31', horario: '08:00' }])
    expect(novo).toMatchObject({ data: '2026-12-31', rede: 'instagram', tipo: 'feed' })
  })
})

describe('postsDoModo', () => {
  const posts = [
    { data: '2026-12-01', estado: 'gerado', postado_em: null },
    { data: '2026-12-10', estado: 'gerado', postado_em: null },
    { data: '2026-12-10', estado: 'reprovado', postado_em: null },
    { data: '2026-12-10', estado: 'aprovado', postado_em: null },
    { data: '2026-12-10', estado: 'aprovado', postado_em: '2026-12-09T10:00:00Z' },
  ]
  test('não aprovados: pendentes e descartados de hoje em diante', () => {
    expect(postsDoModo(posts, 'nao_aprovados', '2026-12-05')).toEqual([posts[1], posts[2]])
  })
  test('todos: também os aprovados que faltam postar; nunca os postados nem os dias passados', () => {
    expect(postsDoModo(posts, 'todos', '2026-12-05')).toEqual([posts[1], posts[2], posts[3]])
  })
})

describe('refazerPostsDoCliente', () => {
  const falsos = (extra: Partial<DepsRefazer> = {}): DepsRefazer => ({
    cliente: async () => ({ id: 'c1', situacao: 'ativo', senha_provisoria: false, ramo: 'turismo' }),
    negocio: async () => NEGOCIO,
    produtos: async () => NOVOS,
    hoje: () => '2026-12-10',
    postsQueFaltam: async () => comoNoBanco((i) => (i % 3 === 0 ? { estado: 'aprovado' } : {})).filter((p) => p.data >= '2026-12-10'),
    gravar: vi.fn(async () => {}),
    ...extra,
  })

  test.each([
    ['sem cliente', { cliente: async () => null }],
    ['bloqueado', { cliente: async () => ({ id: 'c1', situacao: 'bloqueado', senha_provisoria: false, ramo: 'turismo' }) }],
  ])('%s → 403', async (_, extra) => {
    const deps = falsos(extra as Partial<DepsRefazer>)
    expect((await refazerPostsDoCliente({ modo: 'todos' }, deps)).status).toBe(403)
    expect(deps.gravar).not.toHaveBeenCalled()
  })
  test.each([[{}], [{ modo: 'tudo' }], [null]])('modo inválido %j → 400', async (entrada) => {
    expect(await refazerPostsDoCliente(entrada, falsos())).toEqual({ status: 400, corpo: { erro: 'Escolha o que refazer.' } })
  })
  test('sem itens → 400', async () => {
    expect((await refazerPostsDoCliente({ modo: 'todos' }, falsos({ produtos: async () => [] }))).status).toBe(400)
  })
  test('não aprovados: grava só os não aprovados, voltando a pendente e sem foto escolhida', async () => {
    const deps = falsos()
    const todos = await deps.postsQueFaltam('2026-12-10')
    const esperados = todos.filter((p) => p.estado !== 'aprovado').map((p) => p.id)
    const r = await refazerPostsDoCliente({ modo: 'nao_aprovados' }, deps)
    expect(r).toEqual({ status: 200, corpo: { refeitos: esperados.length } })
    const gravados = (deps.gravar as ReturnType<typeof vi.fn>).mock.calls[0][0]
    expect(gravados.map((m: { id: string }) => m.id)).toEqual(esperados)
    for (const m of gravados) expect(m.campos).toMatchObject({ estado: 'gerado', foto_path: null, sem_foto: false, origem: 'modelo', ia_estado: 'fila' })
    expect(gravados.every((m: { campos: { produto_id: string | null } }) => m.campos.produto_id !== 'p1')).toBe(true)
  })
  test('todos: grava também os aprovados', async () => {
    const deps = falsos()
    const total = (await deps.postsQueFaltam('2026-12-10')).length
    expect((await refazerPostsDoCliente({ modo: 'todos' }, deps)).corpo).toEqual({ refeitos: total })
  })
  test('nada para refazer: não grava', async () => {
    const deps = falsos({ postsQueFaltam: async () => [] })
    expect((await refazerPostsDoCliente({ modo: 'todos' }, deps)).corpo).toEqual({ refeitos: 0 })
    expect(deps.gravar).not.toHaveBeenCalled()
  })
})
