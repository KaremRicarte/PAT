import { describe, it, expect } from 'vitest'
import { escolherImagemGeral, fotoDoLugar, temaDaImagem, type DepsImagens } from '../../supabase/functions/_shared/ia/imagens.ts'

const prods = [
  { id: 's1', fotos: ['a.jpg', 'b.jpg', 'c.jpg'] },
  { id: 's2', fotos: [], foto_path: 'velha.jpg' },
]

describe('fotoDoLugar', () => {
  it('foto escolhida pelo cliente vence', () => {
    expect(fotoDoLugar({ post: { produto_id: 's1', foto_path: 'x.jpg', ordem: 1 }, produtos: prods, fotosInfo: {} })).toBe('x.jpg')
  })
  it('revezando as fotos do serviço pela ordem', () => {
    const f = (ordem: number) => fotoDoLugar({ post: { produto_id: 's1', ordem }, produtos: prods, fotosInfo: {} })
    expect([f(0), f(1), f(2), f(3)]).toEqual(['a.jpg', 'b.jpg', 'c.jpg', 'a.jpg'])
  })
  it('pula foto reprovada', () => {
    const fotosInfo = { 'b.jpg': { serve: false } }
    const f = (ordem: number) => fotoDoLugar({ post: { produto_id: 's1', ordem }, produtos: prods, fotosInfo })
    expect([f(0), f(1), f(2)]).toEqual(['a.jpg', 'c.jpg', 'a.jpg'])
  })
  it('só foto reprovada -> null; foto legada funciona; sem produto -> null', () => {
    expect(fotoDoLugar({ post: { produto_id: 's2', ordem: 0 }, produtos: prods, fotosInfo: { 'velha.jpg': { serve: false } } })).toBeNull()
    expect(fotoDoLugar({ post: { produto_id: 's2', ordem: 0 }, produtos: prods, fotosInfo: {} })).toBe('velha.jpg')
    expect(fotoDoLugar({ post: { produto_id: null, ordem: 0 }, produtos: prods, fotosInfo: {} })).toBeNull()
  })
})

function deps(o: Partial<DepsImagens> = {}): DepsImagens {
  return {
    escolher: async (c) => c[0]?.id ?? null,
    bancoDoRamo: async () => [],
    usadasPeloCliente: async () => [],
    buscarPexels: async () => [],
    buscarPixabay: async () => [],
    idsUsados: async () => [],
    palavras: async () => ({ busca_pt: 'mesa posta', busca_en: 'table setting', prompt_imagem: 'a set table' }),
    gerar: null,
    geradasNoMes: async () => 0,
    ...o,
  }
}
const base = { clienteId: 'c1', ramo: 'salao', temaDoPost: 'unhas', fotosDoCliente: [], hoje: '2026-11-17', formato: 'feed' as const }

describe('escolherImagemGeral', () => {
  it('foto do cliente vem primeiro, escolhida pela descrição; reprovada nunca', async () => {
    let vistas: string[] = []
    const r = await escolherImagemGeral(deps({
      escolher: async (c) => { vistas = c.map((x) => x.id); return 'f2.jpg' },
      bancoDoRamo: async () => [{ path: 'banco.jpg', descricao: 'd' }],
    }), { ...base, fotosDoCliente: [
      { path: 'f1.jpg', descricao: 'um', serve: false }, { path: 'f2.jpg', descricao: 'dois', serve: true },
    ] })
    expect(vistas).toEqual(['f2.jpg'])
    expect(r).toMatchObject({ path: 'f2.jpg', origem: 'cliente', descricao: 'dois' })
  })
  it('IA não escolhe nenhuma do cliente -> banco próprio', async () => {
    const r = await escolherImagemGeral(deps({
      escolher: async (c) => (c[0].id === 'f.jpg' ? null : c[0].id),
      bancoDoRamo: async () => [{ path: 'banco.jpg', descricao: 'd' }],
    }), { ...base, fotosDoCliente: [{ path: 'f.jpg', descricao: 'x', serve: true }] })
    expect(r).toMatchObject({ path: 'banco.jpg', origem: 'banco' })
  })
  it('banco: pula as usadas pelo cliente nos últimos 90 dias e as reprovadas', async () => {
    let desde = ''
    const r = await escolherImagemGeral(deps({
      bancoDoRamo: async () => [
        { path: 'b1.jpg', descricao: '1' }, { path: 'b2.jpg', descricao: '2', serve: false }, { path: 'b3.jpg', descricao: '3' },
      ],
      usadasPeloCliente: async (_c, d) => { desde = d; return ['b1.jpg'] },
    }), base)
    expect(desde).toBe('2026-08-19')
    expect(r).toMatchObject({ path: 'b3.jpg', origem: 'banco' })
  })
  it('banco pode repetir entre clientes', async () => {
    const d = deps({
      bancoDoRamo: async () => [{ path: 'b1.jpg', descricao: '1' }],
      usadasPeloCliente: async (c) => (c === 'c1' ? ['b1.jpg'] : []),
    })
    expect(await escolherImagemGeral(d, { ...base, clienteId: 'c2' })).toMatchObject({ path: 'b1.jpg' })
    expect((await escolherImagemGeral(d, base))?.origem).not.toBe('banco')
  })
  it('Pexels pula ids já usados; depois Pixabay', async () => {
    const d = deps({
      buscarPexels: async () => [{ id: 'p1', url: 'u1', autor: 'A' }, { id: 'p2', url: 'u2', autor: 'B' }],
      idsUsados: async (f) => (f === 'pexels' ? ['p1'] : []),
    })
    expect(await escolherImagemGeral(d, base)).toMatchObject({ origem: 'pexels', externo: { id: 'p2', autor: 'B', url: 'u2' } })
    const d2 = deps({
      buscarPexels: async () => [{ id: 'p1', url: 'u1', autor: 'A' }],
      buscarPixabay: async () => [{ id: 'x1', url: 'v1', autor: 'C' }, { id: 'x2', url: 'v2', autor: 'D' }],
      idsUsados: async (f) => (f === 'pexels' ? ['p1'] : ['x1']),
    })
    expect(await escolherImagemGeral(d2, base)).toMatchObject({ origem: 'pixabay', externo: { id: 'x2' } })
  })
  it('tudo vazio -> null', async () => {
    expect(await escolherImagemGeral(deps(), base)).toBeNull()
  })
})

describe('escolherImagemGeral: palavras-chave, aproximação e geração', () => {
  const nova = { id: 'x1', url: 'u', autor: 'A' }
  it('Pixabay recebe as palavras-chave, não o tema', async () => {
    const termos: string[] = []
    await escolherImagemGeral(deps({ buscarPixabay: async (t) => { termos.push(t); return [] } }), base)
    expect(termos[0]).toBe('mesa posta')
  })
  it('busca em inglês quando o português não traz nada novo', async () => {
    const termos: string[] = []
    const r = await escolherImagemGeral(deps({
      buscarPixabay: async (t) => { termos.push(t); return t === 'table setting' ? [nova] : [] },
    }), base)
    expect(r?.origem).toBe('pixabay')
    expect(termos).toEqual(['mesa posta', 'table setting'])
  })
  it('passa o idioma de cada termo: pt para busca_pt, en para busca_en, pt para o tema', async () => {
    const pex: unknown[][] = [], pix: unknown[][] = []
    await escolherImagemGeral(deps({
      buscarPexels: async (...a) => { pex.push(a); return [] },
      buscarPixabay: async (...a) => { pix.push(a); return [] },
    }), base)
    expect(pex).toEqual([['mesa posta', 'pt'], ['table setting', 'en']])
    expect(pix).toEqual([['mesa posta', 'pt'], ['table setting', 'en']])
    const tema: unknown[][] = []
    await escolherImagemGeral(deps({ palavras: async () => null, buscarPixabay: async (...a) => { tema.push(a); return [] } }), base)
    expect(tema).toEqual([['unhas', 'pt']])
  })
  it('palavras null: busca com o tema e não gera', async () => {
    const termos: string[] = []
    let gerou = false
    const r = await escolherImagemGeral(deps({
      palavras: async () => null,
      buscarPixabay: async (t) => { termos.push(t); return [] },
      gerar: async () => { gerou = true; return { id: 'g', url: 'u' } },
    }), base)
    expect(termos).toEqual(['unhas'])
    expect(gerou).toBe(false)
    expect(r).toBeNull()
  })
  it('gera quando nada serve', async () => {
    const chamadas: unknown[][] = []
    const r = await escolherImagemGeral(deps({
      gerar: async (...a) => { chamadas.push(a); return { id: 'g1', url: 'https://v3b.fal.media/x.jpg' } },
    }), base)
    expect(r).toMatchObject({ origem: 'gerada', path: 'https://v3b.fal.media/x.jpg', descricao: 'a set table', externo: { id: 'g1' } })
    expect(chamadas).toEqual([['a set table', 'feed']])
  })
  it('limite de geradas: não gera', async () => {
    let gerou = false
    const r = await escolherImagemGeral(deps({
      geradasNoMes: async () => 20, gerar: async () => { gerou = true; return { id: 'g', url: 'u' } },
    }), base)
    expect(gerou).toBe(false)
    expect(r).toBeNull()
  })
  it('erro ao contar as geradas: não gera', async () => {
    let gerou = false
    const r = await escolherImagemGeral(deps({
      geradasNoMes: async () => { throw new Error('rpc') }, gerar: async () => { gerou = true; return { id: 'g', url: 'u' } },
    }), base)
    expect(gerou).toBe(false)
    expect(r).toBeNull()
  })
  it('palavras não é chamada quando a foto do cliente serve', async () => {
    let chamou = false
    const r = await escolherImagemGeral(deps({ palavras: async () => { chamou = true; return null } }),
      { ...base, fotosDoCliente: [{ path: 'f.jpg', descricao: 'x', serve: true }] })
    expect(r?.origem).toBe('cliente')
    expect(chamou).toBe(false)
  })
  it('aproximação: Minhas fotos primeiro, descrição prefixada, tema com sufixo, uma só chamada', async () => {
    const chamadas: { ids: string[], descs: (string | undefined)[], tema: string }[] = []
    await escolherImagemGeral(deps({
      escolher: async (c, tema) => { chamadas.push({ ids: c.map((x) => x.id), descs: c.map((x) => x.descricao), tema }); return null },
    }), { ...base, aproximacao: true, fotosDoCliente: [
      { path: 'p.jpg', descricao: 'produto', serve: true, doNegocio: false },
      { path: 'n.jpg', descricao: 'fachada', serve: true, doNegocio: true },
    ] })
    expect(chamadas).toHaveLength(1)
    expect(chamadas[0].ids).toEqual(['n.jpg', 'p.jpg'])
    expect(chamadas[0].descs[0]!.startsWith('Foto do próprio negócio: ')).toBe(true)
    expect(chamadas[0].tema.endsWith('(post de aproximação: prefira uma foto do próprio negócio)')).toBe(true)
  })
})

describe('temaDaImagem', () => {
  it('tema curto do título', () => {
    expect(temaDaImagem({ titulo: '✨ Unhas de gel: 3 cuidados para durar mais, de verdade!', pilar: 'dica' }))
      .toBe('Unhas de gel 3 cuidados para durar')
  })
  it('sem título usa o pilar', () => {
    expect(temaDaImagem({ titulo: '', pilar: 'bastidores' })).toBe('bastidores')
  })
})
