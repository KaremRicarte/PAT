import {
  ESQUEMA_ESCOLHA, melhorarUmPost, processarFila,
  type Contexto, type DepsMelhorar, type LinhaFotoIA, type PostDaFila,
} from '../../supabase/functions/melhorar-posts/acoes.ts'
import { ESQUEMA_POST, type ChamarIA, type PedidoIA, type RespostaIA } from '../../supabase/functions/_shared/ia/escrever.ts'
import { ESQUEMA_PALAVRAS } from '../../supabase/functions/_shared/ia/palavras.ts'
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
const PALAVRAS = { busca_pt: 'mesa posta', busca_en: 'table setting', prompt_imagem: 'a set table' }
const GERADA = { id: 'g1', url: 'https://v3b.fal.media/g1.jpg', largura: 864, altura: 1080, bloqueada: false }
const ok = (dados: unknown): RespostaIA => ({ ok: true, dados, tokensEntrada: 1000, tokensSaida: 100 })

const post = (extra: Partial<PostDaFila> = {}): PostDaFila => ({
  id: 'p1', mes_id: 'm1', data: '2026-11-20', rede: 'instagram', tipo: 'feed', formato: 'arte', pilar: 'demo',
  titulo: 'Por que fazer escova?', legenda: 'Texto de modelo.', hashtags: ['#cabelo'], roteiro: null,
  produto_id: 's1', ordem: 0, foto_path: null, sem_foto: false, preco_de: null, preco_por: null,
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
  // relógio falso (ms); cada chamada à IA pode avançá-lo
  relogio?: { t: number },
  duracaoChamada?: number,
  // imagem gerada devolvida por deps.gerarImagem (null = a geração falhou; omitido = sem chave, gerarImagem null)
  gerada?: typeof GERADA | null,
  geradas?: number,
  palavras?: (p: PedidoIA) => RespostaIA,
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
  const tempos: number[] = []
  const buscas: string[] = []
  const geracoes: [string, string, number][] = []
  const relogio = o.relogio ?? { t: 0 }
  const chamar: ChamarIA = async (p) => {
    pedidos.push(p)
    relogio.t += o.duracaoChamada ?? 0
    if (p.esquema === ESQUEMA_POST) return (o.escrever ?? (() => ok(TEXTO_IA)))(p)
    if (p.esquema === ESQUEMA_FOTO) return (o.descrever ?? (() => ok({ descricao: 'Cabelo liso e brilhante.', serve: true, motivo: null })))(p)
    if (p.esquema === ESQUEMA_ESCOLHA) return (o.escolher ?? (() => ok({ id: null })))(p)
    if (p.esquema === ESQUEMA_PALAVRAS) return (o.palavras ?? (() => ok(PALAVRAS)))(p)
    throw new Error('pedido inesperado')
  }
  const deps: DepsMelhorar = {
    chamar: o.semChave ? null : (ms) => { tempos.push(ms); return chamar },
    agora: () => relogio.t,
    contarNoMes: async () => (o.usoNoMes ?? 0) + usos.length,
    registrarUso: async (r) => { usos.push(r) },
    contexto: async () => (o.ctx !== undefined ? o.ctx : contexto()),
    fotosInfo: async (paths) => Object.fromEntries(paths.filter((p) => o.info?.[p]).map((p) => [p, o.info![p]])),
    urlAssinada: async (path) => { urls.push(path); return `https://assinada/${path}` },
    gravarFoto: async (l) => { fotosGravadas.push(l) },
    bancoDoRamo: async () => { buscas.push('banco'); return o.banco ?? [] },
    usadasPeloCliente: async () => [],
    buscarPexels: async () => { buscas.push('pexels'); return o.pexels ?? [] },
    buscarPixabay: async () => [],
    idsUsados: async () => [],
    gerarImagem: o.gerada === undefined ? null : async (prompt, formato, ms) => { geracoes.push([prompt, formato, ms]); return o.gerada! },
    geradasNoMes: async () => o.geradas ?? 0,
    copiarExterna: async (cliente, origem, e) => { copias.push(e.url); return `${cliente}/banco/${origem}-${e.id}.jpg` },
    copiarDoBanco: async (cliente, path) => { copias.push(path); return `${cliente}/banco/banco-${path.split('/').pop()}` },
    registrarUsada: async (cliente, path) => { usadas.push([cliente, path]) },
    gravar: async (p, campos) => { gravados.push({ post: p, campos }); return o.gravarPega ?? true },
    marcar: async (p, estado) => { marcados.push({ id: p.id, estado }) },
    hoje: () => '2026-11-17',
  }
  return { deps, pedidos, usos, gravados, marcados, fotosGravadas, urls, copias, usadas, tempos, buscas, geracoes }
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
    expect(m.usos.map((u) => u.tipo)).toEqual(['imagem', 'imagem', 'post']) // palavras-chave + escolha
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

describe('prazo da execução (relógio falso)', () => {
  const descrita = { [`${UID}/produtos/a.jpg`]: { descricao: 'Cabelo liso.', serve: true } }

  test('pouco tempo para escrever: volta para a fila intacto, sem chamar a IA', async () => {
    const m = montar({ info: descrita, relogio: { t: 100_000 } })
    expect(await melhorarUmPost(m.deps, post(), 110_000)).toBe('adiado')
    expect(m.pedidos).toEqual([])
    expect(m.usos).toEqual([])
    expect(m.gravados).toEqual([])
    expect(m.marcados).toEqual([{ id: 'p1', estado: 'fila' }])
  })

  test('cada chamada tem o tempo cortado pelo prazo', async () => {
    const m = montar({ info: descrita, relogio: { t: 0 } })
    expect(await melhorarUmPost(m.deps, post(), 50_000)).toBe('pronto')
    expect(m.tempos).toEqual([45_000])
    const m2 = montar({ info: descrita })
    expect(await melhorarUmPost(m2.deps, post())).toBe('pronto')
    expect(m2.tempos).toEqual([60_000])
  })

  test('sem tempo para descrever a foto na hora (guardando a reserva da escrita): adiado, nada gasto', async () => {
    const m = montar({ relogio: { t: 0 } })
    expect(await melhorarUmPost(m.deps, post(), 60_000)).toBe('adiado')
    expect(m.pedidos).toEqual([])
    expect(m.fotosGravadas).toEqual([])
    expect(m.marcados).toEqual([{ id: 'p1', estado: 'fila' }])
  })

  test('sem tempo para a IA escolher a imagem do post geral: adiado', async () => {
    const m = montar({ ctx: contexto({ produtos: [] }), pexels: [{ id: '1', url: 'https://images.pexels.com/1.jpg', autor: 'A' }],
      relogio: { t: 0 } })
    expect(await melhorarUmPost(m.deps, post({ produto_id: null }), 60_000)).toBe('adiado')
    expect(m.pedidos).toEqual([])
    expect(m.gravados).toEqual([])
  })

  test('a nova tentativa da escrita sem tempo: adiado (não desiste)', async () => {
    const ruim = ok({ ...TEXTO_IA, titulo: '', gancho: '' })
    const m = montar({ info: descrita, relogio: { t: 0 }, duracaoChamada: 45_000, escrever: () => ruim })
    expect(await melhorarUmPost(m.deps, post(), 60_000)).toBe('adiado')
    expect(m.pedidos).toHaveLength(1)
    expect(m.marcados).toEqual([{ id: 'p1', estado: 'fila' }])
  })

  test('chamada cortada pelo prazo que estoura o tempo: adiado', async () => {
    const m = montar({ info: descrita, relogio: { t: 0 }, escrever: () => ({ ok: false, motivo: 'tempo' }) })
    expect(await melhorarUmPost(m.deps, post(), 50_000)).toBe('adiado')
    // com o tempo inteiro (não cortado), estourar o tempo é falha da IA: desiste
    const m2 = montar({ info: descrita, escrever: () => ({ ok: false, motivo: 'tempo' }) })
    expect(await melhorarUmPost(m2.deps, post())).toBe('desistiu')
  })
})

describe('API ocupada (429, 529, 5xx)', () => {
  const descrita = { [`${UID}/produtos/a.jpg`]: { descricao: 'Cabelo liso.', serve: true } }

  test('ocupada ao escrever: o post volta para a fila (não desiste), nada gravado', async () => {
    const m = montar({ info: descrita, escrever: () => ({ ok: false, motivo: 'ocupado' }) })
    expect(await melhorarUmPost(m.deps, post())).toBe('ocupado')
    expect(m.gravados).toEqual([])
    expect(m.marcados).toEqual([{ id: 'p1', estado: 'fila' }])
  })

  test('ocupada ao descrever a foto: volta para a fila sem escrever nem guardar a descrição', async () => {
    const m = montar({ descrever: () => ({ ok: false, motivo: 'ocupado' }) })
    expect(await melhorarUmPost(m.deps, post())).toBe('ocupado')
    expect(m.pedidos.map((p) => p.esquema)).toEqual([ESQUEMA_FOTO])
    expect(m.fotosGravadas).toEqual([])
    expect(m.marcados).toEqual([{ id: 'p1', estado: 'fila' }])
  })

  test('ocupada ao escolher a imagem do post geral: volta para a fila', async () => {
    const m = montar({ ctx: contexto({ produtos: [] }), pexels: [{ id: '1', url: 'https://images.pexels.com/1.jpg', autor: 'A' }],
      escolher: () => ({ ok: false, motivo: 'ocupado' }) })
    expect(await melhorarUmPost(m.deps, post({ produto_id: null }))).toBe('ocupado')
    expect(m.gravados).toEqual([])
    expect(m.marcados).toEqual([{ id: 'p1', estado: 'fila' }])
  })

  test('descrever a foto e escolher a imagem pedem esforço baixo; escrever, não', async () => {
    const m = montar({ ctx: contexto({ produtos: [], negocio: { nome: 'Studio Lia', insta: null, tom: 'proximo', fotos: [`${UID}/fotos/x.jpg`] } }),
      pexels: [{ id: '1', url: 'https://images.pexels.com/1.jpg', autor: 'A' }] })
    await melhorarUmPost(m.deps, post({ produto_id: null }))
    const por = (e: object) => m.pedidos.filter((p) => p.esquema === e)
    expect(por(ESQUEMA_FOTO).length).toBeGreaterThan(0)
    expect(por(ESQUEMA_ESCOLHA).length).toBeGreaterThan(0)
    expect([...por(ESQUEMA_FOTO), ...por(ESQUEMA_ESCOLHA)].every((p) => p.esforco === 'low' && p.maxTokens === 8000)).toBe(true)
    expect(por(ESQUEMA_POST).every((p) => p.esforco === undefined && p.maxTokens === 16000)).toBe(true)
  })
})

describe('sem foto e ramos só de texto', () => {
  test('sem_foto: escreve sem foto e grava foto_path null', async () => {
    const minha = `${UID}/negocio/minha.jpg`
    const m = montar({ info: { [minha]: { descricao: 'x', serve: true }, [`${UID}/produtos/a.jpg`]: { descricao: 'y', serve: true } } })
    expect(await melhorarUmPost(m.deps, post({ sem_foto: true, foto_path: minha }))).toBe('pronto')
    expect(m.urls).toEqual([])
    expect(imagensDo(m.pedidos.find((p) => p.esquema === ESQUEMA_POST)!)).toEqual([])
    expect(m.gravados[0].campos.foto_path).toBeNull()
    expect(m.gravados[0].post.sem_foto).toBe(true)
  })

  const psico = (extra: Partial<Contexto> = {}) => contexto({
    ramo: 'psicologia',
    negocio: { nome: 'Consultório Ana', insta: null, tom: 'proximo', fotos: [`${UID}/negocio/f.jpg`] },
    produtos: [{ id: 's1', nome: 'Terapia individual', descricao: null, fotos: [`${UID}/produtos/a.jpg`], foto_path: null }],
    ...extra,
  })
  const TEXTO_PSICO = {
    titulo: 'Um espaço para falar com calma', gancho: 'Nem tudo precisa ser resolvido sozinho.',
    meio: 'A terapia é um espaço de escuta, no seu ritmo.', convite: 'Quer conversar? Chama no WhatsApp.',
    hashtags: ['#terapia'], roteiro: null,
  }

  test('ramo só de texto: post geral fica só texto, sem procurar imagem', async () => {
    const m = montar({ ctx: psico(), info: { [`${UID}/negocio/f.jpg`]: { descricao: 'Sala.', serve: true } },
      escrever: () => ok(TEXTO_PSICO), escolher: () => ok({ id: `${UID}/negocio/f.jpg` }) })
    const r = await melhorarUmPost(m.deps, post({ produto_id: null }))
    expect(m.buscas).toEqual([])
    expect(m.pedidos.filter((p) => p.esquema !== ESQUEMA_POST)).toEqual([])
    expect(m.urls).toEqual([])
    expect(r).toBe('pronto')
    expect(m.gravados[0].campos.foto_path).toBeNull()
  })

  test('ramo só de texto: post de serviço continua com a foto do serviço', async () => {
    const m = montar({ ctx: psico(), info: { [`${UID}/produtos/a.jpg`]: { descricao: 'Sala.', serve: true } }, escrever: () => ok(TEXTO_PSICO) })
    expect(await melhorarUmPost(m.deps, post())).toBe('pronto')
    expect(m.gravados[0].campos.foto_path).toBe(`${UID}/produtos/a.jpg`)
  })
})

describe('imagem gerada, aproximação e imagem ilustrativa', () => {
  const geral = () => contexto({ produtos: [] })
  const pg = (extra: Partial<PostDaFila> = {}) => post({ produto_id: null, ...extra })
  const escrita = (m: ReturnType<typeof montar>) => JSON.stringify(m.pedidos.find((p) => p.esquema === ESQUEMA_POST))

  test('post geral sem foto nenhuma gera: copia como gerada, grava a foto e o uso, escreve com imagem ilustrativa', async () => {
    const m = montar({ ctx: geral(), gerada: GERADA })
    expect(await melhorarUmPost(m.deps, pg())).toBe('pronto')
    const path = `${UID}/banco/gerada-g1.jpg`
    expect(m.copias).toEqual([GERADA.url])
    expect(m.fotosGravadas).toContainEqual({ path, cliente_id: UID, origem: 'gerada', ramo: 'beleza', externo_id: 'g1',
      autor: null, descricao: 'a set table', serve: true, motivo: null })
    expect(m.usos).toContainEqual({ clienteId: UID, tipo: 'gerada', tokensEntrada: 0, tokensSaida: 0, custoUsd: 0.003 })
    expect(m.gravados[0].campos.foto_path).toBe(path)
    expect(escrita(m)).toContain('imagem ilustrativa')
  })

  test('bloqueada: registra o uso, não copia nada e grava só texto', async () => {
    const m = montar({ ctx: geral(), gerada: { ...GERADA, bloqueada: true } })
    expect(await melhorarUmPost(m.deps, pg())).toBe('pronto')
    expect(m.usos.filter((u) => u.tipo === 'gerada')).toHaveLength(1)
    expect(m.copias).toEqual([])
    expect(m.gravados[0].campos.foto_path).toBeNull()
  })

  test('sem chave de geração (gerarImagem null): só texto e nenhum uso gerada', async () => {
    const m = montar({ ctx: geral() })
    expect(await melhorarUmPost(m.deps, pg())).toBe('pronto')
    expect(m.gravados[0].campos.foto_path).toBeNull()
    expect(m.usos.filter((u) => u.tipo === 'gerada')).toEqual([])
  })

  test('geração que falha (null): só texto e nenhum uso gerada', async () => {
    const m = montar({ ctx: geral(), gerada: null })
    expect(await melhorarUmPost(m.deps, pg())).toBe('pronto')
    expect(m.geracoes).toHaveLength(1)
    expect(m.usos.filter((u) => u.tipo === 'gerada')).toEqual([])
  })

  test('limite de geradas no mês: não gera', async () => {
    const m = montar({ ctx: geral(), gerada: GERADA, geradas: 20 })
    expect(await melhorarUmPost(m.deps, pg())).toBe('pronto')
    expect(m.geracoes).toEqual([])
  })

  test('post de serviço sem fotos: não gera', async () => {
    const m = montar({ gerada: GERADA, ctx: contexto({ produtos: [{ id: 's1', nome: 'Escova', descricao: null, fotos: [], foto_path: null }] }) })
    expect(await melhorarUmPost(m.deps, post())).toBe('pronto')
    expect(m.geracoes).toEqual([])
  })

  test('ramo só de texto: nunca gera', async () => {
    const m = montar({ gerada: GERADA, ctx: contexto({ ramo: 'psicologia', produtos: [] }) })
    expect(await melhorarUmPost(m.deps, pg())).toBe('pronto')
    expect(m.geracoes).toEqual([])
  })

  test('formato: feed gera feed; stories gera vertical; o tempo da geração é no máximo 30 s', async () => {
    const m = montar({ ctx: geral(), gerada: GERADA })
    await melhorarUmPost(m.deps, pg())
    const m2 = montar({ ctx: geral(), gerada: GERADA })
    await melhorarUmPost(m2.deps, pg({ tipo: 'stories' }))
    expect(m.geracoes).toEqual([['a set table', 'feed', 30_000]])
    expect(m2.geracoes).toEqual([['a set table', 'vertical', 30_000]])
  })

  test('pouco tempo antes da geração: adiado e não gera', async () => {
    // prazo 80 s: a chamada de palavras-chave começa com 30 s úteis (>= 15 s) e leva 11 s; a geração vê
    // 69 s - 45 s (escrita) - 15 s (cópia) - 5 s (margem) = 4 s < 10 s e é adiada pela guarda de gerar (não pelo mínimo de chamada da IA)
    const m = montar({ ctx: geral(), gerada: GERADA, relogio: { t: 0 }, duracaoChamada: 11_000 })
    expect(await melhorarUmPost(m.deps, pg(), 80_000)).toBe('adiado')
    expect(m.pedidos.some((p) => p.esquema === ESQUEMA_PALAVRAS)).toBe(true)
    expect(m.geracoes).toEqual([])
    expect(m.marcados).toEqual([{ id: 'p1', estado: 'fila' }])
  })

  test('a cópia da imagem gerada também tem tempo reservado: sem ele, adia em vez de pagar e perder a imagem', async () => {
    // prazo 80 s, palavras-chave levam 15 s: sobram 65 s. Sem reservar a cópia (15 s) a geração teria 65 - 45 - 5 = 15 s
    // e seria feita; com a reserva sobram 0 s e o post é adiado sem gerar nem registrar uso.
    const m = montar({ ctx: geral(), gerada: GERADA, relogio: { t: 0 }, duracaoChamada: 15_000 })
    expect(await melhorarUmPost(m.deps, pg(), 80_000)).toBe('adiado')
    expect(m.pedidos.some((p) => p.esquema === ESQUEMA_PALAVRAS)).toBe(true)
    expect(m.geracoes).toEqual([])
    expect(m.usos.filter((u) => u.tipo === 'gerada')).toEqual([])
    expect(m.marcados).toEqual([{ id: 'p1', estado: 'fila' }])
  })

  test('pilar aprox: a escolha recebe a foto de Minhas fotos antes da foto de produto', async () => {
    const minha = `${UID}/negocio/f.jpg`, prod = `${UID}/produtos/a.jpg`
    const m = montar({
      ctx: contexto({ negocio: { nome: 'Studio Lia', insta: null, tom: 'proximo', fotos: [minha] } }),
      info: { [prod]: { descricao: 'Produto.', serve: true }, [minha]: { descricao: 'Fachada.', serve: true } },
    })
    await melhorarUmPost(m.deps, pg({ pilar: 'aprox' }))
    const e = JSON.stringify(m.pedidos.find((p) => p.esquema === ESQUEMA_ESCOLHA))
    expect(e.indexOf(minha)).toBeGreaterThan(-1)
    expect(e.indexOf(minha)).toBeLessThan(e.indexOf(prod))
    expect(e).toContain('Foto do próprio negócio: Fachada.')
  })

  test('imagem do banco ou do Pexels é ilustrativa; foto do cliente não', async () => {
    const m = montar({ ctx: geral(), banco: [{ path: 'beleza/b1.jpg', descricao: 'Pincéis.', serve: true }], escolher: () => ok({ id: 'beleza/b1.jpg' }) })
    await melhorarUmPost(m.deps, pg())
    expect(escrita(m)).toContain('imagem ilustrativa')
    const minha = `${UID}/negocio/f.jpg`
    const m2 = montar({
      ctx: contexto({ produtos: [], negocio: { nome: 'Studio Lia', insta: null, tom: 'proximo', fotos: [minha] } }),
      info: { [minha]: { descricao: 'Fachada.', serve: true } }, escolher: () => ok({ id: minha }),
    })
    await melhorarUmPost(m2.deps, pg())
    expect(escrita(m2)).not.toContain('imagem ilustrativa')
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
    expect(r).toEqual({ pronto: 1, desistiu: 0, 'cliente-mexeu': 0, adiado: 0, ocupado: 0, erro: 1 })
  })

  test('passa o prazo da execução (início + 110 s) para cada post', async () => {
    const prazos: number[] = []
    const lotes = [[post()], []]
    await processarFila({
      pegar: async () => lotes.shift() ?? [],
      melhorar: async (_p, prazo) => { prazos.push(prazo); return 'pronto' },
      desistir: async () => {},
      agora: () => 1_000,
    })
    expect(prazos).toEqual([111_000])
  })

  test('API ocupada num post: termina o lote e não pega outro; o lote é de 3', async () => {
    const limites: number[] = []
    const r = await processarFila({
      pegar: async (n) => { limites.push(n); return [post({ id: 'a' }), post({ id: 'b' })] },
      melhorar: async (p) => (p.id === 'a' ? 'ocupado' : 'pronto'),
      desistir: async () => {},
      agora: () => 0,
    })
    expect(limites).toEqual([3])
    expect(r).toMatchObject({ pronto: 1, ocupado: 1 })
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
