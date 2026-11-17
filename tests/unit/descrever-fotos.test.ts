import { descreverFotos, MAX_FOTOS, type DepsDescrever, type LinhaFotoIA } from '../../supabase/functions/descrever-fotos/acoes.ts'
import type { ChamarIA, PedidoIA, RespostaIA } from '../../supabase/functions/_shared/ia/escrever.ts'
import type { RegistroUso } from '../../supabase/functions/_shared/ia/uso.ts'

const UID = '11111111-1111-1111-1111-111111111111'
const OUTRO = '22222222-2222-2222-2222-222222222222'
const BOA: RespostaIA = { ok: true, tokensEntrada: 1500, tokensSaida: 80, dados: { descricao: 'Fachada da loja.', serve: true, motivo: null } }
const RUIM: RespostaIA = { ok: true, tokensEntrada: 1500, tokensSaida: 80, dados: { descricao: 'Foto escura.', serve: false, motivo: 'Escura demais.' } }

function montar(o: {
  admin?: boolean, resposta?: (p: PedidoIA) => RespostaIA, semChave?: boolean, usoNoMes?: number,
  descritas?: string[], semArquivo?: string[], cliente?: Awaited<ReturnType<DepsDescrever['cliente']>>,
} = {}) {
  const pedidos: PedidoIA[] = []
  const gravadas: LinhaFotoIA[] = []
  const usos: RegistroUso[] = []
  const urls: [string, string][] = []
  const chamar: ChamarIA = async (p) => { pedidos.push(p); return (o.resposta ?? (() => BOA))(p) }
  const deps: DepsDescrever = {
    quem: { id: UID, admin: o.admin ?? false },
    cliente: async () => (o.cliente !== undefined ? o.cliente
      : { id: UID, situacao: 'ativo', senha_provisoria: false, ramo: 'beleza' }),
    jaDescritas: async (paths) => paths.filter((p) => (o.descritas ?? []).includes(p)),
    urlAssinada: async (bucket, path) => {
      urls.push([bucket, path])
      return (o.semArquivo ?? []).includes(path) ? null : `https://assinada/${bucket}/${path}`
    },
    chamar: o.semChave ? null : chamar,
    contarNoMes: async () => (o.usoNoMes ?? 0) + usos.length,
    registrarUso: async (r) => { usos.push(r) },
    gravarFoto: async (l) => { gravadas.push(l) },
  }
  return { deps, pedidos, gravadas, usos, urls }
}

describe('cliente', () => {
  test('só paths alheios: 403 e a IA não é chamada', async () => {
    const m = montar()
    const r = await descreverFotos({ paths: [`${OUTRO}/negocio/a.jpg`] }, m.deps)
    expect(r.status).toBe(403)
    expect(m.pedidos).toHaveLength(0)
    expect(m.urls).toHaveLength(0)
  })

  test('paths misturados: descreve só os dele, no bucket marcas, e grava como origem cliente', async () => {
    const m = montar({ resposta: (p) => (p.conteudo.some((c) => c.tipo === 'imagem' && c.url.endsWith('b.jpg')) ? RUIM : BOA) })
    const r = await descreverFotos({ paths: [`${UID}/negocio/a.jpg`, `${OUTRO}/negocio/x.jpg`, `${UID}/produtos/b.jpg`] }, m.deps)
    expect(r.status).toBe(200)
    expect(r.corpo).toEqual({ descritas: 2, fotos: [
      { path: `${UID}/negocio/a.jpg`, serve: true, motivo: null },
      { path: `${UID}/produtos/b.jpg`, serve: false, motivo: 'Escura demais.' },
    ] })
    expect(m.urls.every(([b, p]) => b === 'marcas' && p.startsWith(`${UID}/`))).toBe(true)
    expect(m.gravadas).toContainEqual({ path: `${UID}/negocio/a.jpg`, cliente_id: UID, origem: 'cliente', ramo: 'beleza',
      descricao: 'Fachada da loja.', serve: true, motivo: null })
    expect(m.usos).toHaveLength(2)
    expect(m.usos.every((u) => u.clienteId === UID && u.tipo === 'foto')).toBe(true)
  })

  test('fotos já descritas não chamam a IA', async () => {
    const m = montar({ descritas: [`${UID}/negocio/a.jpg`] })
    const r = await descreverFotos({ paths: [`${UID}/negocio/a.jpg`, `${UID}/negocio/b.jpg`] }, m.deps)
    expect(r.corpo).toMatchObject({ descritas: 1 })
    expect(m.pedidos).toHaveLength(1)
    expect(m.urls.map(([, p]) => p)).toEqual([`${UID}/negocio/b.jpg`])
  })

  test('limite do mês estourado: 200 com zero e sem chamar a IA', async () => {
    const m = montar({ usoNoMes: 400 })
    const r = await descreverFotos({ paths: [`${UID}/negocio/a.jpg`, `${UID}/negocio/b.jpg`] }, m.deps)
    expect(r).toEqual({ status: 200, corpo: { descritas: 0, fotos: [] } })
    expect(m.pedidos).toHaveLength(0)
    expect(m.gravadas).toHaveLength(0)
  })

  test('limite estoura no meio: para de chamar', async () => {
    const m = montar({ usoNoMes: 399 })
    const paths = [1, 2, 3, 4, 5].map((i) => `${UID}/negocio/${i}.jpg`)
    const r = await descreverFotos({ paths }, m.deps)
    expect(r.corpo).toMatchObject({ descritas: 1 })
    expect(m.pedidos).toHaveLength(1)
  })

  test('sem chave da Anthropic: 200 com zero', async () => {
    const m = montar({ semChave: true })
    const r = await descreverFotos({ paths: [`${UID}/negocio/a.jpg`] }, m.deps)
    expect(r).toEqual({ status: 200, corpo: { descritas: 0, fotos: [] } })
    expect(m.urls).toHaveLength(0)
  })

  test('arquivo que não existe no Storage é pulado sem chamar a IA', async () => {
    const m = montar({ semArquivo: [`${UID}/negocio/a.jpg`] })
    const r = await descreverFotos({ paths: [`${UID}/negocio/a.jpg`] }, m.deps)
    expect(r.corpo).toEqual({ descritas: 0, fotos: [] })
    expect(m.pedidos).toHaveLength(0)
  })

  test('IA falha: a foto não é gravada (fica para a próxima vez), mas o uso conta', async () => {
    const m = montar({ resposta: () => ({ ok: false, motivo: 'recusa', tokensEntrada: 10, tokensSaida: 0 }) })
    const r = await descreverFotos({ paths: [`${UID}/negocio/a.jpg`] }, m.deps)
    expect(r.corpo).toEqual({ descritas: 0, fotos: [] })
    expect(m.gravadas).toHaveLength(0)
    expect(m.usos).toHaveLength(1)
  })

  test('cliente inativo ou com senha provisória: 403', async () => {
    for (const cliente of [null, { id: UID, situacao: 'pausado', senha_provisoria: false, ramo: 'beleza' },
      { id: UID, situacao: 'ativo', senha_provisoria: true, ramo: 'beleza' }]) {
      const m = montar({ cliente })
      expect((await descreverFotos({ paths: [`${UID}/negocio/a.jpg`] }, m.deps)).status).toBe(403)
      expect(m.pedidos).toHaveLength(0)
    }
  })

  test('cliente não descreve o banco nem manda ramo para virar admin', async () => {
    const m = montar()
    const r = await descreverFotos({ paths: ['beleza/a.jpg'], ramo: 'beleza' }, m.deps)
    expect(r.status).toBe(403)
    expect(m.pedidos).toHaveLength(0)
  })

  test('cópias em {uid}/banco/ (Pexels, Pixabay, banco próprio) não viram fotos do cliente', async () => {
    const m = montar()
    const r = await descreverFotos({ paths: [`${UID}/banco/pexels-123.jpg`] }, m.deps)
    expect(r.status).toBe(403)
    expect(m.pedidos).toHaveLength(0)
  })

  test('caminho com ".." é recusado', async () => {
    const m = montar()
    const r = await descreverFotos({ paths: [`${UID}/../${OUTRO}/a.jpg`] }, m.deps)
    expect(r.status).toBe(403)
    expect(m.pedidos).toHaveLength(0)
  })
})

describe('entrada', () => {
  test.each([
    [null], [{}], [{ paths: 'a.jpg' }], [{ paths: [] }], [{ paths: [1] }],
    [{ paths: Array.from({ length: MAX_FOTOS + 1 }, (_, i) => `${UID}/negocio/${i}.jpg`) }],
  ])('inválida %#: 400', async (entrada) => {
    const m = montar()
    expect((await descreverFotos(entrada, m.deps)).status).toBe(400)
  })

  test('até 30 fotos por vez', () => {
    expect(MAX_FOTOS).toBe(30)
  })

  test('paths repetidos contam uma vez', async () => {
    const m = montar()
    const r = await descreverFotos({ paths: [`${UID}/negocio/a.jpg`, `${UID}/negocio/a.jpg`] }, m.deps)
    expect(r.corpo).toMatchObject({ descritas: 1 })
    expect(m.pedidos).toHaveLength(1)
  })
})

describe('admin', () => {
  test('com ramo: lê do bucket banco e grava origem banco, cliente_id null; uso sem cliente e sem limite', async () => {
    const m = montar({ admin: true, usoNoMes: 10_000, cliente: null })
    const r = await descreverFotos({ paths: ['beleza/a.jpg', 'beleza/b.jpg'], ramo: 'beleza' }, m.deps)
    expect(r.status).toBe(200)
    expect(r.corpo).toMatchObject({ descritas: 2 })
    expect(m.urls).toEqual([['banco', 'beleza/a.jpg'], ['banco', 'beleza/b.jpg']])
    expect(m.gravadas[0]).toEqual({ path: 'beleza/a.jpg', cliente_id: null, origem: 'banco', ramo: 'beleza',
      descricao: 'Fachada da loja.', serve: true, motivo: null })
    expect(m.usos.every((u) => u.clienteId === null && u.tipo === 'foto')).toBe(true)
    // o contexto da foto fala do ramo
    expect(m.pedidos[0].conteudo.some((c) => c.tipo === 'texto' && /beleza/i.test(c.texto))).toBe(true)
  })

  test('ramo inválido: 400', async () => {
    const m = montar({ admin: true })
    expect((await descreverFotos({ paths: ['xyz/a.jpg'], ramo: 'xyz' }, m.deps)).status).toBe(400)
  })

  test('sem ramo: 400', async () => {
    const m = montar({ admin: true })
    expect((await descreverFotos({ paths: ['beleza/a.jpg'] }, m.deps)).status).toBe(400)
  })

  test('só paths fora da pasta do ramo: 403', async () => {
    const m = montar({ admin: true })
    const r = await descreverFotos({ paths: [`${UID}/negocio/a.jpg`, 'turismo/a.jpg'], ramo: 'beleza' }, m.deps)
    expect(r.status).toBe(403)
    expect(m.pedidos).toHaveLength(0)
  })
})
