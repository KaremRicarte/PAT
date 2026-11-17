import { reescreverPostDoCliente, type DepsReescrever, type PostParaReescrever } from '../../supabase/functions/reescrever-post/acoes.ts'
import { ESQUEMA_POST, type ChamarIA, type PedidoIA, type RespostaIA } from '../../supabase/functions/_shared/ia/escrever.ts'
import type { RegistroUso } from '../../supabase/functions/_shared/ia/uso.ts'

const UID = '11111111-1111-1111-1111-111111111111'
const ID = '33333333-3333-4333-8333-333333333333'

const TEXTO_IA = {
  titulo: 'O brilho que dura a semana inteira',
  gancho: 'Esse brilho aí da foto não é filtro.',
  meio: 'É a escova progressiva feita com calma, mecha por mecha.',
  convite: 'Quer o seu? Chama no WhatsApp e escolhe o horário.',
  hashtags: ['#escovaprogressiva'],
  roteiro: 'Como montar: a foto inteira, com o título por cima.',
}
const ok = (dados: unknown): RespostaIA => ({ ok: true, dados, tokensEntrada: 1000, tokensSaida: 100 })

const POST: PostParaReescrever = {
  id: ID, mes_id: 'm1', data: '2026-11-20', rede: 'instagram', tipo: 'feed', formato: 'arte', pilar: 'demo',
  titulo: 'Por que fazer escova?', legenda: 'Texto antigo.', hashtags: ['#cabelo'], roteiro: null,
  produto_id: 's1', ordem: 0, foto_path: `${UID}/posts/${ID}.jpg`, sem_foto: false, preco_de: null, preco_por: null,
  estado: 'gerado', postado_em: null, cliente_id: UID, estrategia: 'vender',
}

function montar(o: { semChave?: boolean, responder?: (p: PedidoIA) => RespostaIA, gravarPega?: boolean } = {}, extra: Partial<DepsReescrever> = {}) {
  const pedidos: PedidoIA[] = []
  const usos: RegistroUso[] = []
  const chamar: ChamarIA = async (p) => { pedidos.push(p); return (o.responder ?? (() => ok(TEXTO_IA)))(p) }
  const gravar = vi.fn(async () => o.gravarPega ?? true)
  const deps: DepsReescrever = {
    cliente: async () => ({ id: UID, situacao: 'ativo', senha_provisoria: false, ramo: 'beleza' }),
    post: async () => ({ ...POST }),
    negocio: async () => ({ nome: 'Studio Lia', insta: 'studiolia', tom: 'proximo' }),
    produtos: async () => [{ id: 's1', nome: 'Escova progressiva', descricao: 'Alisamento natural', fotos: [`${UID}/produtos/a.jpg`], foto_path: null }],
    gravar,
    chamar: o.semChave ? null : () => chamar,
    agora: () => 0,
    contarNoMes: async () => usos.length,
    registrarUso: async (r) => { usos.push(r) },
    fotosInfo: async (paths) => Object.fromEntries(paths.map((p) => [p, { descricao: `Descrição guardada de ${p}`, serve: true }])),
    urlAssinada: async (path) => `https://assinada/${path}`,
    ...extra,
  }
  return { deps, pedidos, usos, gravar }
}

test.each([
  ['sem cliente', { cliente: async () => null }],
  ['bloqueado', { cliente: async () => ({ id: UID, situacao: 'bloqueado', senha_provisoria: false, ramo: 'beleza' }) }],
  ['senha provisória', { cliente: async () => ({ id: UID, situacao: 'ativo', senha_provisoria: true, ramo: 'beleza' }) }],
])('%s → 403', async (_, extra) => {
  const { deps, pedidos } = montar({}, extra as Partial<DepsReescrever>)
  expect((await reescreverPostDoCliente({ post_id: ID }, deps)).status).toBe(403)
  expect(pedidos).toHaveLength(0)
})

test.each([
  ['post de outro cliente', { post: async () => ({ ...POST, cliente_id: 'outro' }) }, { post_id: ID }],
  ['post que não existe', { post: async () => null }, { post_id: ID }],
  ['id que não é uuid', {}, { post_id: 'abc' }],
  ['sem post_id', {}, {}],
  ['entrada que não é objeto', {}, null],
])('%s → 404', async (_, extra, entrada) => {
  const { deps, pedidos, gravar } = montar({}, extra as Partial<DepsReescrever>)
  expect(await reescreverPostDoCliente(entrada, deps)).toEqual({ status: 404, corpo: { erro: 'Post não encontrado.' } })
  expect(pedidos).toHaveLength(0)
  expect(gravar).not.toHaveBeenCalled()
})

test('IA ok: reescreve a legenda para a foto atual, grava condicional e devolve o post', async () => {
  const { deps, pedidos, usos, gravar } = montar({}, {
    fotosInfo: async (paths) => Object.fromEntries(paths.map((p) => [p, { descricao: 'Cabelo liso e brilhante.', serve: true }])),
    post: async () => ({ ...POST, foto_path: `${UID}/produtos/a.jpg` }),
  })
  const r = await reescreverPostDoCliente({ post_id: ID }, deps)
  expect(r.status).toBe(200)
  expect(pedidos).toHaveLength(1)
  expect(pedidos[0].esquema).toBe(ESQUEMA_POST)
  expect(pedidos[0].conteudo[0]).toEqual({ tipo: 'imagem', url: `https://assinada/${UID}/produtos/a.jpg` })
  expect(JSON.stringify(pedidos[0].conteudo)).toContain('Cabelo liso e brilhante.')
  expect(usos).toEqual([expect.objectContaining({ clienteId: UID, tipo: 'troca' })])
  const [lido, campos] = gravar.mock.calls[0] as unknown as [PostParaReescrever, Record<string, unknown>]
  expect(lido).toMatchObject({ id: ID, legenda: 'Texto antigo.', foto_path: `${UID}/produtos/a.jpg`, estado: 'gerado', sem_foto: false })
  expect(campos).toMatchObject({ titulo: TEXTO_IA.titulo, hashtags: TEXTO_IA.hashtags, roteiro: TEXTO_IA.roteiro })
  expect(campos.legenda).toContain(TEXTO_IA.gancho)
  expect(r.corpo).toEqual({ post: { id: ID, ...campos, origem: 'ia', ia_estado: 'pronto' } })
})

test('foto enviada para o post (mesmo caminho a cada envio): a descrição guardada não vale, vai só a imagem', async () => {
  const { deps, pedidos } = montar()
  expect((await reescreverPostDoCliente({ post_id: ID }, deps)).status).toBe(200)
  expect(pedidos[0].conteudo[0]).toEqual({ tipo: 'imagem', url: `https://assinada/${UID}/posts/${ID}.jpg` })
  expect(JSON.stringify(pedidos[0].conteudo)).not.toContain('Descrição guardada')
  expect(JSON.stringify(pedidos[0].conteudo)).toContain('Veja a foto anexada.')
})

test('sem foto_path num post de serviço: a foto da vez do serviço', async () => {
  const { deps, pedidos } = montar({}, { post: async () => ({ ...POST, foto_path: null }) })
  await reescreverPostDoCliente({ post_id: ID }, deps)
  expect(pedidos[0].conteudo[0]).toEqual({ tipo: 'imagem', url: `https://assinada/${UID}/produtos/a.jpg` })
})

test('"Sem foto": reescreve só com texto', async () => {
  const { deps, pedidos } = montar({}, {
    cliente: async () => ({ id: UID, situacao: 'ativo', senha_provisoria: false, ramo: 'psicologia' }),
    post: async () => ({ ...POST, sem_foto: true, produto_id: null }),
  })
  expect((await reescreverPostDoCliente({ post_id: ID }, deps)).status).toBe(200)
  expect(pedidos[0].conteudo.some((c) => c.tipo === 'imagem')).toBe(false)
})

test('foto de outra pasta: não reescreve nem manda a foto para a IA', async () => {
  const { deps, pedidos, gravar } = montar({}, { post: async () => ({ ...POST, foto_path: 'outro/posts/x.jpg' }) })
  expect(await reescreverPostDoCliente({ post_id: ID }, deps)).toEqual({ status: 200, corpo: { post: null } })
  expect(pedidos).toHaveLength(0)
  expect(gravar).not.toHaveBeenCalled()
})

test.each([
  ['a IA falha', { responder: () => ({ ok: false, motivo: 'erro' }) as RespostaIA }],
  ['a IA demora', { responder: () => ({ ok: false, motivo: 'tempo' }) as RespostaIA }],
  ['o texto reprova duas vezes', { responder: () => ok({ ...TEXTO_IA, meio: 'Hoje com 50% de desconto!' }) }],
])('%s → { post: null } com 200 e nada gravado', async (_, o) => {
  const { deps, gravar } = montar(o)
  expect(await reescreverPostDoCliente({ post_id: ID }, deps)).toEqual({ status: 200, corpo: { post: null } })
  expect(gravar).not.toHaveBeenCalled()
})

test('erro inesperado no caminho da IA → { post: null } com 200', async () => {
  const erro = vi.spyOn(console, 'error').mockImplementation(() => {})
  const { deps } = montar({}, { urlAssinada: async () => { throw new Error('storage fora') } })
  expect(await reescreverPostDoCliente({ post_id: ID }, deps)).toEqual({ status: 200, corpo: { post: null } })
  erro.mockRestore()
})

test('sem chave da Anthropic: { post: null } sem IA nem uso registrado', async () => {
  const contarNoMes = vi.fn(async () => 0)
  const registrarUso = vi.fn(async () => {})
  const { deps, gravar } = montar({ semChave: true }, { contarNoMes, registrarUso })
  expect(await reescreverPostDoCliente({ post_id: ID }, deps)).toEqual({ status: 200, corpo: { post: null } })
  expect(contarNoMes).not.toHaveBeenCalled()
  expect(registrarUso).not.toHaveBeenCalled()
  expect(gravar).not.toHaveBeenCalled()
})

test('o cliente mexeu no post enquanto a IA escrevia: nada muda → { post: null }', async () => {
  const { deps, gravar } = montar({ gravarPega: false })
  expect(await reescreverPostDoCliente({ post_id: ID }, deps)).toEqual({ status: 200, corpo: { post: null } })
  expect(gravar).toHaveBeenCalled()
})

test.each([
  ['aprovado', { estado: 'aprovado' }],
  ['postado', { postado_em: '2026-11-20T12:00:00Z' }],
])('post %s: o texto que o cliente já aceitou fica → { post: null } sem IA', async (_, mudanca) => {
  const { deps, pedidos } = montar({}, { post: async () => ({ ...POST, ...mudanca }) })
  expect(await reescreverPostDoCliente({ post_id: ID }, deps)).toEqual({ status: 200, corpo: { post: null } })
  expect(pedidos).toHaveLength(0)
})

test('sem negócio cadastrado → { post: null }', async () => {
  const { deps, pedidos } = montar({}, { negocio: async () => null })
  expect(await reescreverPostDoCliente({ post_id: ID }, deps)).toEqual({ status: 200, corpo: { post: null } })
  expect(pedidos).toHaveLength(0)
})
