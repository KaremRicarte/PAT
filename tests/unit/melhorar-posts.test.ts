import {
  ESQUEMA_ESCOLHA, melhorarUmPost, processarFila,
  type Contexto, type DepsMelhorar, type LinhaFotoIA, type PostDaFila,
} from '../../supabase/functions/melhorar-posts/acoes.ts'
import { ESQUEMA_POST, type ChamarIA, type PedidoIA, type RespostaIA } from '../../supabase/functions/_shared/ia/escrever.ts'
import { ESQUEMA_FOTO } from '../../supabase/functions/_shared/ia/descrever.ts'
import type { RegistroUso } from '../../supabase/functions/_shared/ia/uso.ts'

const UID = '11111111-1111-1111-1111-111111111111'
const OUTRO = '22222222-2222-2222-2222-222222222222'

const TEXTO_IA = {
  titulo: 'O brilho que dura a semana inteira',
  gancho: 'Esse brilho aí da foto não é filtro.',
  meio: 'É a escova progressiva feita com calma, mecha por mecha.',
  convite: 'Quer o seu? Chama no WhatsApp e escolhe o horário.',
  hashtags: ['#escovaprogressiva'],
  roteiro: 'Como montar: a foto inteira, com o título por cima.',
}
const ok = (dados: unknown): RespostaIA => ({ ok: true, dados, tokensEntrada: 1000, tokensSaida: 100 })

const post = (extra: Partial<PostDaFila> = {}): PostDaFila => ({
  id: 'p1', mes_id: 'm1', data: '2026-11-20', rede: 'instagram', tipo: 'feed', formato: 'arte', pilar: 'demo',
  titulo: 'Por que fazer escova?', legenda: 'Texto de modelo.', hashtags: ['#cabelo'], roteiro: null,
  produto_id: 's1', ordem: 0, foto_path: null, preco_de: null, preco_por: null,
  estado: 'gerado', postado_em: null, ia_em: '2026-11-17T12:00:00.000+00:00',
  ...extra,
})

const contexto = (extra: Partial<Contexto> = {}): Contexto => ({
  clienteId: UID, situacao: 'ativo', ramo: 'beleza', estrategia: 'vender',
  negocio: { nome: 'Studio Lia', insta: 'studiolia', tom: 'proximo', fotos: [] },
  produtos: [{ id: 's1', nome: 'Escova progressiva', descricao: 'Alisamento natural', fotos: [`${UID}/produtos/a.jpg`], foto_path: null }],
  ...extra,
})

type Opcoes = {
  semChave?: boolean,
  usoNoMes?: number,
  ctx?: Contexto | null,
  info?: Record<string, { descricao: string | null, serve: boolean | null }>,
  // respostas da IA por tipo de pedido
  escrever?: (p: PedidoIA) => RespostaIA,
  descrever?: (p: PedidoIA) => RespostaIA,
  escolher?: (p: PedidoIA) => RespostaIA,
  gravarPega?: boolean,
  banco?: { path: string, descricao: string, serve?: boolean }[],
  pexels?: { id: string, url: string, autor: string, descricao?: string }[],
}

function montar(o: Opcoes = {}) {
  const pedidos: PedidoIA[] = []
  const usos: RegistroUso[] = []
  const gravados: { post: PostDaFila, campos: Record<string, unknown> }[] = []
  const marcados: { id: string, estado: string }[] = []
  const fotosGravadas: LinhaFotoIA[] = []
  const urls: string[] = []
  const copias: string[] = []
  const usadas: [string, string][] = []
  const chamar: ChamarIA = async (p) => {
    pedidos.push(p)
    if (p.esquema === ESQUEMA_POST) return (o.escrever ?? (() => ok(TEXTO_IA)))(p)
    if (p.esquema === ESQUEMA_FOTO) return (o.descrever ?? (() => ok({ descricao: 'Cabelo liso e brilhante.', serve: true, motivo: null })))(p)
    if (p.esquema === ESQUEMA_ESCOLHA) return (o.escolher ?? (() => ok({ id: null })))(p)
    throw new Error('pedido inesperado')
  }
  const deps: DepsMelhorar = {
    chamar: o.semChave ? null : chamar,
    contarNoMes: async () => (o.usoNoMes ?? 0) + usos.length,
    registrarUso: async (r) => { usos.push(r) },
    contexto: async () => (o.ctx !== undefined ? o.ctx : contexto()),
    fotosInfo: async (paths) => Object.fromEntries(paths.filter((p) => o.info?.[p]).map((p) => [p, o.info![p]])),
    urlAssinada: async (path) => { urls.push(path); return `https://assinada/${path}` },
    gravarFoto: async (l) => { fotosGravadas.push(l) },
    bancoDoRamo: async () => o.banco ?? [],
    usadasPeloCliente: async () => [],
    buscarPexels: async () => o.pexels ?? [],
    buscarPixabay: async () => [],
    idsUsados: async () => [],
    copiarExterna: async (cliente, origem, e) => { copias.push(e.url); return `${cliente}/banco/${origem}-${e.id}.jpg` },
    copiarDoBanco: async (cliente, path) => { copias.push(path); return `${cliente}/banco/banco-${path.split('/').pop()}` },
    registrarUsada: async (cliente, path) => { usadas.push([cliente, path]) },
    gravar: async (p, campos) => { gravados.push({ post: p, campos }); return o.gravarPega ?? true },
    marcar: async (p, estado) => { marcados.push({ id: p.id, estado }) },
    hoje: () => '2026-11-17',
  }
  return { deps, pedidos, usos, gravados, marcados, fotosGravadas, urls, copias, usadas }
}

const imagensDo = (p: PedidoIA) => p.conteudo.filter((c) => c.tipo === 'imagem').map((c) => (c as { url: string }).url)

describe('melhorarUmPost', () => {
  test('caminho feliz: grava origem ia com a foto do serviço e a IA vê essa foto', async () => {
    const m = montar({ info: { [`${UID}/produtos/a.jpg`]: { descricao: 'Cabelo liso.', serve: true } } })
    const r = await melhorarUmPost(m.deps, post())
    expect(r).toBe('pronto')
    expect(m.gravados).toHaveLength(1)
    expect(m.gravados[0].campos).toMatchObject({
      titulo: TEXTO_IA.titulo, hashtags: ['#escovaprogressiva'], roteiro: TEXTO_IA.roteiro,
      foto_path: `${UID}/produtos/a.jpg`, origem: 'ia', ia_estado: 'pronto',
    })
    expect(m.gravados[0].campos.legenda).toContain('Esse brilho aí da foto não é filtro.')
    // a gravação é condicional ao post que foi lido
    expect(m.gravados[0].post.legenda).toBe('Texto de modelo.')
    const escrita = m.pedidos.find((p) => p.esquema === ESQUEMA_POST)!
    expect(imagensDo(escrita)).toEqual([`https://assinada/${UID}/produtos/a.jpg`])
    expect(m.usos.map((u) => [u.clienteId, u.tipo])).toEqual([[UID, 'post']])
    expect(m.marcados).toEqual([])
  })

  test('IA devolve null: desistiu e nada além do estado', async () => {
    const m = montar({ info: { [`${UID}/produtos/a.jpg`]: { descricao: 'x', serve: true } }, escrever: () => ({ ok: false, motivo: 'recusa' }) })
    const r = await melhorarUmPost(m.deps, post())
    expect(r).toBe('desistiu')
    expect(m.gravados).toEqual([])
    expect(m.fotosGravadas).toEqual([])
    expect(m.marcados).toEqual([{ id: 'p1', estado: 'desistiu' }])
  })

  test('gravação condicional sem linha: cliente-mexeu (sai da fila sem sobrescrever)', async () => {
    const m = montar({ info: { [`${UID}/produtos/a.jpg`]: { descricao: 'x', serve: true } }, gravarPega: false })
    const r = await melhorarUmPost(m.deps, post())
    expect(r).toBe('cliente-mexeu')
    expect(m.gravados).toHaveLength(1)
    expect(m.marcados).toEqual([{ id: 'p1', estado: 'pulado' }])
  })

  test('limite do mês estourado: não chama a IA', async () => {
    const m = montar({ usoNoMes: 400 })
    const r = await melhorarUmPost(m.deps, post())
    expect(r).toBe('desistiu')
    expect(m.pedidos).toEqual([])
    expect(m.gravados).toEqual([])
    expect(m.marcados).toEqual([{ id: 'p1', estado: 'desistiu' }])
  })

  test('sem chave da Anthropic: desistiu sem chamar nada nem registrar uso', async () => {
    const m = montar({ semChave: true })
    expect(await melhorarUmPost(m.deps, post())).toBe('desistiu')
    expect(m.usos).toEqual([])
    expect(m.marcados).toEqual([{ id: 'p1', estado: 'desistiu' }])
  })

  test('post geral sem imagem em nenhuma fonte: grava só o texto, foto_path null', async () => {
    const m = montar({ ctx: contexto({ produtos: [] }) })
    const r = await melhorarUmPost(m.deps, post({ produto_id: null }))
    expect(r).toBe('pronto')
    expect(m.gravados[0].campos).toMatchObject({ foto_path: null, origem: 'ia', ia_estado: 'pronto' })
    expect(imagensDo(m.pedidos.find((p) => p.esquema === ESQUEMA_POST)!)).toEqual([])
  })

  test('foto de serviço reprovada é pulada', async () => {
    const a = `${UID}/produtos/a.jpg`, b = `${UID}/produtos/b.jpg`
    const ctx = contexto({ produtos: [{ id: 's1', nome: 'Escova progressiva', descricao: null, fotos: [a, b], foto_path: null }] })
    const m = montar({ ctx, info: { [a]: { descricao: 'Escura.', serve: false }, [b]: { descricao: 'Boa.', serve: true } } })
    expect(await melhorarUmPost(m.deps, post({ ordem: 0 }))).toBe('pronto')
    expect(m.gravados[0].campos.foto_path).toBe(b)
    expect(m.urls).not.toContain(a)
  })

  test('serviço só com foto reprovada: só texto', async () => {
    const a = `${UID}/produtos/a.jpg`
    const m = montar({ info: { [a]: { descricao: 'Escura.', serve: false } } })
    expect(await melhorarUmPost(m.deps, post())).toBe('pronto')
    expect(m.gravados[0].campos.foto_path).toBeNull()
    expect(m.urls).toEqual([])
  })

  test('foto do serviço ainda sem descrição: descreve na hora e grava em fotos_ia', async () => {
    const m = montar()
    expect(await melhorarUmPost(m.deps, post())).toBe('pronto')
    expect(m.fotosGravadas).toEqual([{ path: `${UID}/produtos/a.jpg`, cliente_id: UID, origem: 'cliente', ramo: 'beleza',
      descricao: 'Cabelo liso e brilhante.', serve: true, motivo: null }])
    expect(m.usos.map((u) => u.tipo)).toEqual(['foto', 'post'])
    expect(m.gravados[0].campos.foto_path).toBe(`${UID}/produtos/a.jpg`)
  })

  test('descrita na hora como reprovada: pula para a próxima', async () => {
    const a = `${UID}/produtos/a.jpg`, b = `${UID}/produtos/b.jpg`
    const ctx = contexto({ produtos: [{ id: 's1', nome: 'Escova progressiva', descricao: null, fotos: [a, b], foto_path: null }] })
    const m = montar({ ctx, info: { [b]: { descricao: 'Boa.', serve: true } },
      descrever: () => ok({ descricao: 'Escura.', serve: false, motivo: 'Escura demais.' }) })
    expect(await melhorarUmPost(m.deps, post({ ordem: 0 }))).toBe('pronto')
    expect(m.fotosGravadas[0]).toMatchObject({ path: a, serve: false })
    expect(m.gravados[0].campos.foto_path).toBe(b)
  })

  test('foto escolhida pelo cliente no post vence', async () => {
    const minha = `${UID}/negocio/minha.jpg`
    const m = montar({ info: { [minha]: { descricao: 'Fachada.', serve: true } } })
    expect(await melhorarUmPost(m.deps, post({ foto_path: minha }))).toBe('pronto')
    expect(m.gravados[0].campos.foto_path).toBe(minha)
    expect(m.gravados[0].post.foto_path).toBe(minha)
  })

  test('foto de outro cliente nunca vai para a IA nem para o post', async () => {
    const alheia = `${OUTRO}/produtos/x.jpg`
    const ctx = contexto({ produtos: [{ id: 's1', nome: 'Escova progressiva', descricao: null, fotos: [alheia], foto_path: null }] })
    const m = montar({ ctx, info: { [alheia]: { descricao: 'x', serve: true } } })
    expect(await melhorarUmPost(m.deps, post())).toBe('pronto')
    expect(m.urls).toEqual([])
    expect(m.gravados[0].campos.foto_path).toBeNull()
    // e no lugar do post (foto_path que não é da pasta do cliente) a IA não trabalha
    const m2 = montar()
    expect(await melhorarUmPost(m2.deps, post({ foto_path: alheia }))).toBe('desistiu')
    expect(m2.pedidos).toEqual([])
  })

  test('post geral: foto do Pexels é copiada para a pasta do cliente e só o caminho é gravado', async () => {
    const m = montar({
      ctx: contexto({ produtos: [] }),
      pexels: [{ id: '77', url: 'https://images.pexels.com/77.jpg', autor: 'Ana', descricao: 'salão claro' }],
      escolher: (p) => ok({ id: imagensDo(p).length ? '77' : null }),
    })
    expect(await melhorarUmPost(m.deps, post({ produto_id: null }))).toBe('pronto')
    const path = `${UID}/banco/pexels-77.jpg`
    expect(m.copias).toEqual(['https://images.pexels.com/77.jpg'])
    expect(m.gravados[0].campos.foto_path).toBe(path)
    expect(m.fotosGravadas).toContainEqual({ path, cliente_id: UID, origem: 'pexels', ramo: 'beleza', externo_id: '77',
      autor: 'Ana', descricao: 'salão claro', serve: true, motivo: null })
    // a IA escreve vendo a cópia, não a URL externa
    expect(imagensDo(m.pedidos.find((p) => p.esquema === ESQUEMA_POST)!)).toEqual([`https://assinada/${path}`])
    expect(m.usos.map((u) => u.tipo)).toEqual(['imagem', 'post'])
  })

  test('post geral: foto do banco próprio é copiada e registrada em fotos_usadas', async () => {
    const m = montar({
      ctx: contexto({ produtos: [] }),
      banco: [{ path: 'beleza/b1.jpg', descricao: 'Pincéis de maquiagem.', serve: true }],
      escolher: () => ok({ id: 'beleza/b1.jpg' }),
    })
    expect(await melhorarUmPost(m.deps, post({ produto_id: null }))).toBe('pronto')
    expect(m.copias).toEqual(['beleza/b1.jpg'])
    expect(m.usadas).toEqual([[UID, 'beleza/b1.jpg']])
    expect(m.gravados[0].campos.foto_path).toBe(`${UID}/banco/banco-b1.jpg`)
  })

  test('post geral: foto do próprio cliente (Minhas fotos) escolhida pela descrição', async () => {
    const minha = `${UID}/negocio/f.jpg`
    const m = montar({
      ctx: contexto({ produtos: [], negocio: { nome: 'Studio Lia', insta: null, tom: 'proximo', fotos: [minha] } }),
      info: { [minha]: { descricao: 'Fachada do studio.', serve: true } },
      escolher: () => ok({ id: minha }),
    })
    expect(await melhorarUmPost(m.deps, post({ produto_id: null }))).toBe('pronto')
    expect(m.copias).toEqual([])
    expect(m.gravados[0].campos.foto_path).toBe(minha)
  })

  test('cliente inativo ou mês sem contexto: desistiu sem chamar a IA', async () => {
    const m = montar({ ctx: contexto({ situacao: 'pausado' }) })
    expect(await melhorarUmPost(m.deps, post())).toBe('desistiu')
    const m2 = montar({ ctx: null })
    expect(await melhorarUmPost(m2.deps, post())).toBe('desistiu')
    expect([...m.pedidos, ...m2.pedidos]).toEqual([])
  })
})

describe('processarFila', () => {
  test('erro inesperado num post não derruba os outros e o post com erro desiste', async () => {
    const lotes = [[post({ id: 'a' }), post({ id: 'b' })], []]
    const marcados: string[] = []
    const feitos: string[] = []
    const r = await processarFila({
      pegar: async () => lotes.shift() ?? [],
      melhorar: async (p) => { if (p.id === 'a') throw new Error('boom'); feitos.push(p.id); return 'pronto' },
      desistir: async (p) => { marcados.push(p.id) },
      agora: () => 0,
    })
    expect(feitos).toEqual(['b'])
    expect(marcados).toEqual(['a'])
    expect(r).toEqual({ pronto: 1, desistiu: 0, 'cliente-mexeu': 0, erro: 1 })
  })

  test('para de pegar lotes quando o tempo acaba', async () => {
    let t = 0
    let pegou = 0
    await processarFila({
      pegar: async () => { pegou++; return [post()] },
      melhorar: async () => { t += 70_000; return 'pronto' },
      desistir: async () => {},
      agora: () => t,
    })
    expect(pegou).toBe(1)
  })
})
