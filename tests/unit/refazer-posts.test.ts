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

describe('Refazer este post (só um)', () => {
  // o mês atual, gerado com Gramado em promoção para o Natal; o cliente corrige o preço promocional
  const ATUAIS: Pacote['produtos'] = [
    { id: 'p2', nome: 'Gramado', descricao: null, preco: 2199, preco_promo: 1799, promo_data: '2026-12-25' },
    { id: 'p3', nome: 'Portugal', descricao: null, preco: 10299, preco_promo: null },
  ]
  const CORRIGIDOS = ATUAIS.map((p) => (p.id === 'p2' ? { ...p, preco_promo: 1599 } : p))
  const mes = gerarMes(pacote(ATUAIS))
  const noBanco: PostQueFalta[] = mes.map((p, i) => ({ id: `x${i}`, data: p.data, rede: p.rede, tipo: p.tipo, formato: p.formato,
    horario: '08:00', ordem: p.ordem, estado: 'aprovado', postado_em: null, ano_mes: '2026-12', estrategia: 'vender',
    produto_id: p.produto_id, pilar: p.pilar, ocasiao: p.ocasiao, foto_path: p.produto_id ? 'c1/produtos/p2/a.jpg' : null, sem_foto: false }))
  const deps = (extra: Partial<DepsRefazer> = {}): DepsRefazer => ({
    cliente: async () => ({ id: 'c1', situacao: 'ativo', senha_provisoria: false, ramo: 'turismo' }),
    negocio: async () => NEGOCIO, produtos: async () => CORRIGIDOS, hoje: () => '2026-12-01',
    postsQueFaltam: async () => noBanco, gravar: vi.fn(async () => {}), ...extra,
  })

  test('refaz só o post escolhido, com o preço corrigido, o mesmo item e a mesma fase da data', async () => {
    const i = mes.findIndex((p) => p.rede === 'instagram' && p.tipo === 'feed' && p.ocasiao?.fase === 'aquecimento')
    const d = deps()
    expect(await refazerPostsDoCliente({ post_id: '00000000-0000-4000-8000-00000000000' + 'a' }, d)).toMatchObject({ status: 404 })
    const id = '11111111-1111-4111-8111-111111111111'
    const d2 = deps({ postsQueFaltam: async () => noBanco.map((p, j) => (j === i ? { ...p, id } : p)) })
    expect(await refazerPostsDoCliente({ post_id: id }, d2)).toEqual({ status: 200, corpo: { refeitos: 1 } })
    const [[mudancas]] = (d2.gravar as ReturnType<typeof vi.fn>).mock.calls
    expect(mudancas).toHaveLength(1)
    expect(mudancas[0].id).toBe(id)
    expect(mudancas[0].campos).toMatchObject({ produto_id: 'p2', preco_de: 2199, preco_por: 1599, ocasiao: { nome: 'Natal', fase: 'aquecimento' },
      estado: 'gerado', origem: 'modelo', ia_estado: 'fila', foto_path: 'c1/produtos/p2/a.jpg' })
    expect(mudancas[0].campos.legenda).toContain('de R$ 2.199 por R$ 1.599')
  })
  test('post que já foi postado ou de dia passado (fora dos que faltam) → 404, nada gravado', async () => {
    const d = deps({ postsQueFaltam: async () => [] })
    const r = await refazerPostsDoCliente({ post_id: '11111111-1111-4111-8111-111111111111' }, d)
    expect(r.status).toBe(404)
    expect(d.gravar).not.toHaveBeenCalled()
  })
  test('id inválido → 404', async () => {
    expect((await refazerPostsDoCliente({ post_id: 'abc' }, deps())).status).toBe(404)
  })
})

describe('Refazer com versão nova: foto escolhida e o dia inteiro', () => {
  const ITENS: Pacote['produtos'] = [
    { id: 'p2', nome: 'Gramado', descricao: null, preco: 2199, preco_promo: 1799, promo_data: '2026-12-25' },
    { id: 'p3', nome: 'Portugal', descricao: null, preco: 10299, preco_promo: null },
  ]
  const mes = gerarMes(pacote(ITENS))
  const ID = '11111111-1111-4111-8111-111111111111'
  // o dia com mais posts; o primeiro dele é o post clicado
  const contagem = new Map<string, number>()
  for (const p of mes) contagem.set(p.data, (contagem.get(p.data) ?? 0) + 1)
  const DIA = [...contagem].sort((a, b) => b[1] - a[1])[0][0]
  const noBanco: PostQueFalta[] = mes.map((p, i) => ({ id: `x${i}`, data: p.data, rede: p.rede, tipo: p.tipo, formato: p.formato,
    horario: '08:00', ordem: p.ordem, estado: 'aprovado', postado_em: null, ano_mes: '2026-12', estrategia: 'vender',
    titulo: `Título ${i}`, produto_id: p.produto_id, pilar: p.pilar, ocasiao: p.ocasiao,
    foto_path: p.produto_id ? `c1/produtos/${p.produto_id}/f${i}.jpg` : `c1/banco/g${i}.jpg`, sem_foto: false }))
  const iClicado = noBanco.findIndex((p) => p.data === DIA)
  noBanco[iClicado] = { ...noBanco[iClicado], id: ID }
  // um post geral (sem item) no mesmo dia, com imagem do banco
  const iGeral = noBanco.findIndex((p, j) => p.data === DIA && j !== iClicado)
  noBanco[iGeral] = { ...noBanco[iGeral], produto_id: null, foto_path: 'c1/banco/geral.jpg' }
  const doDia = noBanco.filter((p) => p.data === DIA)
  const deps = (extra: Partial<DepsRefazer> = {}): DepsRefazer => ({
    cliente: async () => ({ id: 'c1', situacao: 'ativo', senha_provisoria: false, ramo: 'turismo' }),
    negocio: async () => NEGOCIO, produtos: async () => ITENS, hoje: () => '2026-12-01',
    postsQueFaltam: async () => noBanco, gravar: vi.fn(async () => {}), marcarUsadas: vi.fn(async () => {}), ...extra,
  })
  const gravados = (d: DepsRefazer) => (d.gravar as ReturnType<typeof vi.fn>).mock.calls[0][0] as { id: string, campos: Record<string, unknown> }[]

  test('dia: refaz os posts do mesmo dia que faltam, com titulo_anterior, e volta para "para aprovar"', async () => {
    expect(doDia.length).toBeGreaterThan(1)
    const d = deps()
    expect(await refazerPostsDoCliente({ post_id: ID, dia: true }, d)).toEqual({ status: 200, corpo: { refeitos: doDia.length } })
    const g = gravados(d)
    expect(g.map((x) => x.id).sort()).toEqual(doDia.map((p) => p.id).sort())
    for (const x of g) {
      const antes = doDia.find((p) => p.id === x.id)!
      expect(x.campos).toMatchObject({ titulo_anterior: antes.titulo, estado: 'gerado', origem: 'modelo', ia_estado: 'fila' })
    }
  })
  test('foto escolhida vai para o post clicado; os outros do dia ficam sem foto e as fotos antigas são marcadas como usadas', async () => {
    const d = deps()
    await refazerPostsDoCliente({ post_id: ID, dia: true, foto_path: 'c1/produtos/p2/nova.jpg' }, d)
    const g = gravados(d)
    expect(g.find((x) => x.id === ID)!.campos.foto_path).toBe('c1/produtos/p2/nova.jpg')
    for (const x of g.filter((y) => y.id !== ID)) expect(x.campos.foto_path).toBeNull()
    const marcadas = (d.marcarUsadas as ReturnType<typeof vi.fn>).mock.calls[0][0] as string[]
    expect(marcadas.sort()).toEqual(doDia.map((p) => p.foto_path!).sort())
  })
  test('manter a foto (sem foto_path): o post clicado mantém a foto e não marca o uso dela', async () => {
    const d = deps()
    await refazerPostsDoCliente({ post_id: ID }, d)
    const g = gravados(d)
    expect(g).toHaveLength(1)
    expect(g[0].campos).toMatchObject({ foto_path: noBanco[iClicado].foto_path, titulo_anterior: noBanco[iClicado].titulo })
    expect(d.marcarUsadas).not.toHaveBeenCalled()
  })
  test('foto de outro cliente: 400 Foto inválida.', async () => {
    const d = deps()
    expect(await refazerPostsDoCliente({ post_id: ID, foto_path: 'c2/produtos/p2/x.jpg' }, d)).toEqual({ status: 400, corpo: { erro: 'Foto inválida.' } })
    expect(d.gravar).not.toHaveBeenCalled()
  })
  test('post geral no modo dia: foto_path null e a imagem antiga marcada como usada', async () => {
    const geral = doDia.find((p) => !p.produto_id && p.id !== ID)
    expect(geral).toBeDefined() // o dia de teste tem post geral
    const d = deps()
    await refazerPostsDoCliente({ post_id: ID, dia: true }, d)
    expect(gravados(d).find((x) => x.id === geral.id)!.campos.foto_path).toBeNull()
    expect((d.marcarUsadas as ReturnType<typeof vi.fn>).mock.calls[0][0]).toContain(geral.foto_path)
  })
  test('erro ao marcar as fotos usadas não derruba o refazer', async () => {
    const log = vi.spyOn(console, 'error').mockImplementation(() => {})
    const d = deps({ marcarUsadas: vi.fn(async () => { throw new Error('rede') }) })
    expect((await refazerPostsDoCliente({ post_id: ID, dia: true }, d)).status).toBe(200)
    log.mockRestore()
  })
})
