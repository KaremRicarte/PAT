import { trocarPostDoCliente, type DepsTroca } from '../../supabase/functions/trocar-post/acoes.ts'
import { gerarMes } from '../../supabase/functions/_shared/modelos/gerar.ts'
import { ESQUEMA_POST, type ChamarIA, type PedidoIA, type RespostaIA } from '../../supabase/functions/_shared/ia/escrever.ts'
import type { RegistroUso } from '../../supabase/functions/_shared/ia/uso.ts'

const ID = '11111111-1111-4111-8111-111111111111'
const POST = {
  id: ID, mes_id: 'm1', data: '2026-12-02', rede: 'instagram', tipo: 'feed', formato: 'arte', horario: '18:30',
  ordem: 0, trocas: 2, legenda: 'texto antigo', cliente_id: 'c1', ano_mes: '2026-12', estrategia: 'vender',
  produto_id: null as string | null, foto_path: null as string | null, sem_foto: false,
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
  // sem chave da Anthropic: o caminho de hoje (modelos)
  chamar: null,
  agora: () => 0,
  contarNoMes: async () => 0,
  registrarUso: async () => {},
  fotosInfo: async () => ({}),
  urlAssinada: async (path) => `https://assinada/${path}`,
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
    ['estado', 'foto_path', 'hashtags', 'ia_estado', 'legenda', 'ocasiao', 'origem', 'pilar', 'preco_de', 'preco_por', 'produto_id',
      'roteiro', 'sem_foto', 'titulo', 'trocas'])
  expect(campos).toMatchObject({ estado: 'gerado', foto_path: null, sem_foto: false, trocas: 3, preco_de: null, preco_por: null })
  // texto de modelo pedido pelo cliente: a fila não o reescreve
  expect(campos).toMatchObject({ origem: 'modelo', ia_estado: 'pulado' })
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

// ---------- Com a IA (spec §3.5) ----------

const TEXTO_IA = {
  titulo: 'A ferramenta certa faz o serviço render',
  gancho: 'Sabe aquele furo torto que estraga a parede?',
  meio: 'Com a furadeira certa e a broca do tamanho certo, o furo sai reto na primeira vez.',
  convite: 'Passa aqui na loja e a gente te mostra qual serve para o seu serviço.',
  hashtags: ['#ferramentas'],
  roteiro: 'Como montar: a foto inteira, com o título por cima.',
}
const ok = (dados: unknown): RespostaIA => ({ ok: true, dados, tokensEntrada: 1000, tokensSaida: 100 })

function comIA(responder: (p: PedidoIA) => RespostaIA | Promise<RespostaIA>, extra: Partial<DepsTroca> = {}) {
  const pedidos: PedidoIA[] = []
  const usos: RegistroUso[] = []
  const tempos: number[] = []
  const chamar: ChamarIA = async (p) => { pedidos.push(p); return responder(p) }
  const deps = falsos({
    chamar: (ms) => { tempos.push(ms); return chamar },
    registrarUso: async (r) => { usos.push(r) },
    ...extra,
  })
  return { deps, pedidos, usos, tempos }
}
const gravado = (deps: DepsTroca) => (deps.gravar as ReturnType<typeof vi.fn>).mock.calls[0][1]

// dois serviços com fotos
const COM_FOTOS = [
  { id: 'p1', nome: 'Furadeira', descricao: null, preco: 99.9, preco_promo: null, fotos: ['c1/produtos/a.jpg', 'c1/produtos/b.jpg'] },
  { id: 'p2', nome: 'Trena a laser', descricao: null, preco: null, preco_promo: null, fotos: ['c1/produtos/t.jpg', 'c1/produtos/u.jpg'] },
]

test('IA ok: grava o texto da IA (origem ia, pronto), conta a troca e registra o uso como troca', async () => {
  const { deps, pedidos, usos, tempos } = comIA(() => ok(TEXTO_IA))
  const r = await trocarPostDoCliente({ post_id: ID }, deps)
  expect(r.status).toBe(200)
  expect(pedidos).toHaveLength(1)
  expect(pedidos[0].esquema).toBe(ESQUEMA_POST)
  expect(tempos[0]).toBeLessThanOrEqual(30_000)
  expect(usos).toEqual([expect.objectContaining({ clienteId: 'c1', tipo: 'troca' })])
  const campos = gravado(deps)
  expect(campos).toMatchObject({
    titulo: TEXTO_IA.titulo, hashtags: ['#ferramentas'], roteiro: TEXTO_IA.roteiro,
    estado: 'gerado', sem_foto: false, trocas: 3, origem: 'ia', ia_estado: 'pronto',
  })
  expect(campos.legenda).toContain(TEXTO_IA.gancho)
  expect(campos.legenda).toContain(TEXTO_IA.convite)
  expect(r.corpo.post).toMatchObject({ ...campos, id: ID, data: POST.data, horario: '18:30' })
})

test('IA ok num lugar de serviço: escreve a partir da foto do serviço (pulando a reprovada) e grava essa foto', async () => {
  const { deps, pedidos } = comIA(() => ok(TEXTO_IA), {
    produtos: async () => COM_FOTOS,
    fotosInfo: async (paths) => Object.fromEntries(paths.map((p) => [p, { descricao: `Foto ${p}`, serve: !p.endsWith('a.jpg') && !p.endsWith('t.jpg') }])),
  })
  const r = await trocarPostDoCliente({ post_id: ID }, deps)
  expect(r.status).toBe(200)
  const campos = gravado(deps)
  expect(campos.produto_id).not.toBeNull() // este lugar é de serviço
  expect(campos.foto_path).toBe(campos.produto_id === 'p1' ? 'c1/produtos/b.jpg' : 'c1/produtos/u.jpg')
  expect(pedidos[0].conteudo[0]).toEqual({ tipo: 'imagem', url: `https://assinada/${campos.foto_path}` })
  expect(JSON.stringify(pedidos[0].conteudo)).toContain(`Foto ${campos.foto_path}`)
})

test('lugar de tema geral com a foto que o cliente escolheu: a foto fica e a IA escreve a partir dela', async () => {
  // o feed de 09/12 é de tema geral e continua geral depois da troca
  const { deps, pedidos } = comIA(() => ok(TEXTO_IA), {
    post: async () => ({ ...POST, data: '2026-12-09', ordem: 15, foto_path: 'c1/posts/x.jpg' }),
  })
  expect((await trocarPostDoCliente({ post_id: ID }, deps)).status).toBe(200)
  const campos = gravado(deps)
  expect(campos.produto_id).toBeNull()
  expect(campos.foto_path).toBe('c1/posts/x.jpg')
  expect(pedidos[0].conteudo[0]).toEqual({ tipo: 'imagem', url: 'https://assinada/c1/posts/x.jpg' })
})

test('foto de outra pasta nunca vai para a IA nem para o post', async () => {
  const { deps, pedidos } = comIA(() => ok(TEXTO_IA), {
    post: async () => ({ ...POST, foto_path: 'c2/posts/x.jpg' }),
    produtos: async () => [
      { id: 'p1', nome: 'Furadeira', descricao: null, preco: null, preco_promo: null, fotos: ['c2/produtos/a.jpg'] },
      { id: 'p2', nome: 'Trena a laser', descricao: null, preco: null, preco_promo: null, fotos: ['c2/produtos/t.jpg'] },
    ],
  })
  await trocarPostDoCliente({ post_id: ID }, deps)
  expect(pedidos).toHaveLength(1)
  expect(JSON.stringify(pedidos)).not.toContain('c2/')
  expect(gravado(deps).foto_path).toBeNull()
})

test.each([
  ['a IA falha', () => ({ ok: false, motivo: 'erro' }) as RespostaIA],
  ['a IA recusa', () => ({ ok: false, motivo: 'recusa' }) as RespostaIA],
  ['a IA demora', () => ({ ok: false, motivo: 'tempo' }) as RespostaIA],
  ['o texto da IA reprova duas vezes', () => ok({ ...TEXTO_IA, meio: 'Hoje com 50% de desconto!' })],
])('%s → fica o modelo, como hoje (e a troca conta)', async (_, responder) => {
  const { deps } = comIA(responder)
  const r = await trocarPostDoCliente({ post_id: ID }, deps)
  expect(r.status).toBe(200)
  const campos = gravado(deps)
  expect(campos).toMatchObject({ origem: 'modelo', ia_estado: 'pulado', foto_path: null, trocas: 3 })
  expect(campos.legenda).not.toContain(TEXTO_IA.gancho)
})

test('erro inesperado no caminho da IA (ex.: Storage) → modelo, sem erro para o cliente', async () => {
  const erro = vi.spyOn(console, 'error').mockImplementation(() => {})
  const { deps } = comIA(() => ok(TEXTO_IA), {
    produtos: async () => COM_FOTOS,
    urlAssinada: async () => { throw new Error('storage fora') },
  })
  const r = await trocarPostDoCliente({ post_id: ID }, deps)
  expect(r.status).toBe(200)
  expect(gravado(deps)).toMatchObject({ origem: 'modelo', ia_estado: 'pulado' })
  erro.mockRestore()
})

test('sem chave da Anthropic: nada de IA nem de uso registrado', async () => {
  const registrarUso = vi.fn(async () => {})
  const contarNoMes = vi.fn(async () => 0)
  const deps = falsos({ registrarUso, contarNoMes })
  expect((await trocarPostDoCliente({ post_id: ID }, deps)).status).toBe(200)
  expect(registrarUso).not.toHaveBeenCalled()
  expect(contarNoMes).not.toHaveBeenCalled()
  expect(gravado(deps)).toMatchObject({ origem: 'modelo', ia_estado: 'pulado' })
})

test('limite do mês da IA estourado: modelo, e a troca conta nas 10', async () => {
  const { deps, pedidos } = comIA(() => ok(TEXTO_IA), { contarNoMes: async () => 400 })
  expect((await trocarPostDoCliente({ post_id: ID }, deps)).status).toBe(200)
  expect(pedidos).toHaveLength(0)
  expect(gravado(deps)).toMatchObject({ origem: 'modelo', trocas: 3 })
})

test('o cliente espera no máximo ~30 s: sem tempo para a nova tentativa, fica o modelo', async () => {
  const relogio = { t: 0 }
  const { deps, pedidos } = comIA(() => { relogio.t += 25_000; return ok({ ...TEXTO_IA, meio: 'Hoje com 50% de desconto!' }) },
    { agora: () => relogio.t })
  await trocarPostDoCliente({ post_id: ID }, deps)
  expect(pedidos).toHaveLength(1) // a 2ª tentativa não começa com só 5 s
  expect(gravado(deps)).toMatchObject({ origem: 'modelo' })
})

test('limite de trocas e post alheio barram antes da IA', async () => {
  const a = comIA(() => ok(TEXTO_IA), { trocasDoMes: async () => 10 })
  expect((await trocarPostDoCliente({ post_id: ID }, a.deps)).status).toBe(429)
  const b = comIA(() => ok(TEXTO_IA), { post: async () => ({ ...POST, cliente_id: 'c2' }) })
  expect((await trocarPostDoCliente({ post_id: ID }, b.deps)).status).toBe(404)
  expect([...a.pedidos, ...b.pedidos]).toHaveLength(0)
})

test('sem a IA (ou com ela falhando), a foto que o cliente escolheu fica se o serviço do lugar não mudou', async () => {
  const escolheu = async () => ({ ...POST, data: '2026-12-09', ordem: 15, foto_path: 'c1/posts/x.jpg' })
  const semChave = falsos({ post: escolheu })
  expect((await trocarPostDoCliente({ post_id: ID }, semChave)).status).toBe(200)
  expect(gravado(semChave)).toMatchObject({ origem: 'modelo', produto_id: null, foto_path: 'c1/posts/x.jpg' })
  const falhou = comIA(() => ({ ok: false, motivo: 'ocupado' }) as RespostaIA, { post: escolheu })
  await trocarPostDoCliente({ post_id: ID }, falhou.deps)
  expect(gravado(falhou.deps)).toMatchObject({ origem: 'modelo', foto_path: 'c1/posts/x.jpg' })
})

test('sem a IA: serviço do lugar mudou, foto de outra pasta ou "sem foto" → sem foto escolhida', async () => {
  // o lugar de 02/12 vira de serviço: a foto escolhida no post de tema geral não vale para ele
  const mudou = falsos({ post: async () => ({ ...POST, foto_path: 'c1/posts/x.jpg' }) })
  await trocarPostDoCliente({ post_id: ID }, mudou)
  expect(gravado(mudou).produto_id).not.toBeNull()
  expect(gravado(mudou).foto_path).toBeNull()
  const alheia = falsos({ post: async () => ({ ...POST, data: '2026-12-09', ordem: 15, foto_path: 'c2/posts/x.jpg' }) })
  await trocarPostDoCliente({ post_id: ID }, alheia)
  expect(gravado(alheia).foto_path).toBeNull()
  const semFoto = falsos({ post: async () => ({ ...POST, data: '2026-12-09', ordem: 15, foto_path: 'c1/posts/x.jpg', sem_foto: true }) })
  await trocarPostDoCliente({ post_id: ID }, semFoto)
  expect(gravado(semFoto).foto_path).toBeNull()
})
