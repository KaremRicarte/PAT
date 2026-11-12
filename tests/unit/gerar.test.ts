import { gerarMes, type Pacote, type PostGerado } from '../../supabase/functions/_shared/modelos/gerar.ts'
import { validarPost, validarMes } from '../../supabase/functions/_shared/modelos/validar.ts'
import { agendaDoMes } from '../../supabase/functions/_shared/modelos/calendario.ts'
import { RAMOS } from '../../supabase/functions/_shared/modelos/ramos/index.ts'
import type { Estrategia } from '../../supabase/functions/_shared/modelos/tipos.ts'

const ESTRATEGIAS: Estrategia[] = ['vender', 'crescer', 'credibilidade', 'tempo']

const base = (extra: Partial<Pacote> = {}): Pacote => ({
  ramo: 'ferramentas', estrategia: 'vender', anoMes: '2026-12', inicio: '2026-12-01',
  negocio: { nome: 'Ferragens Martins', insta: null, tom: 'proximo', horario: '19:00' },
  produtos: [
    { id: 'p1', nome: 'Furadeira de impacto', descricao: 'Com maleta e brocas.', preco: 299.9 },
    { id: 'p2', nome: 'Trena a laser', descricao: null, preco: null },
  ],
  ...extra,
})

const contar = (posts: PostGerado[]) => {
  const c: Record<string, number> = {}
  for (const p of posts) c[`${p.rede}/${p.tipo}`] = (c[`${p.rede}/${p.tipo}`] ?? 0) + 1
  return c
}
const tudo = (p: PostGerado) => [p.titulo, p.legenda, p.roteiro ?? '', ...p.hashtags].join('\n')

test('mês de dezembro em vender tem 50 posts', () => {
  const posts = gerarMes(base())
  expect(posts).toHaveLength(50)
  expect(contar(posts)).toEqual({
    'instagram/feed': 12, 'instagram/stories': 12, 'facebook/feed': 12,
    'tiktok/video': 4, 'whatsapp/status': 8, 'whatsapp/lista': 2,
  })
  expect(validarMes(posts, agendaDoMes('2026-12', '2026-12-01', 'vender'))).toEqual([])
})

test('posts em ordem de data, com ordem sequencial a partir de 0', () => {
  const posts = gerarMes(base())
  expect(posts.map((p) => p.ordem)).toEqual(posts.map((_, i) => i))
  expect(posts.map((p) => p.data)).toEqual(posts.map((p) => p.data).sort())
  expect(posts.every((p) => p.horario === '19:00')).toBe(true)
})

describe.each(Object.keys(RAMOS))('ramo %s', (ramo) => {
  test.each(ESTRATEGIAS)('todo post passa em validarPost (%s)', (estrategia) => {
    const posts = gerarMes(base({ ramo, estrategia }))
    const problemas = posts.flatMap((p) => validarPost(p, RAMOS[ramo]).map((e) => `${p.data} ${p.rede}/${p.tipo}: ${e}`))
    expect(problemas).toEqual([])
    expect(validarMes(posts, agendaDoMes('2026-12', '2026-12-01', estrategia))).toEqual([])
  })
})

test.each(['psicologia', 'advocacia'])('%s com preço informado nunca mostra preço nem promoção', (ramo) => {
  for (const estrategia of ESTRATEGIAS) {
    const posts = gerarMes(base({
      ramo, estrategia,
      produtos: [{ id: 'p1', nome: 'Atendimento online', descricao: null, preco: 150 }],
    }))
    expect(posts.filter((p) => /R\$|oferta|promo|desconto/i.test(tudo(p)))).toEqual([])
  }
})

test('vender põe "Oferta da semana" e o preço informado na sexta', () => {
  const sextas = gerarMes(base()).filter((p) => ['2026-12-04', '2026-12-11', '2026-12-18', '2026-12-25'].includes(p.data) &&
    p.rede === 'instagram' && p.tipo === 'feed')
  expect(sextas).toHaveLength(4)
  expect(sextas.every((p) => p.titulo.startsWith('Oferta da semana'))).toBe(true)
  // a furadeira tem preço informado; a trena não
  const furadeira = sextas.filter((p) => p.produto_id === 'p1')
  expect(furadeira.length).toBeGreaterThan(0)
  expect(furadeira.every((p) => p.legenda.includes('R$ 299,90'))).toBe(true)
  expect(sextas.filter((p) => p.produto_id === 'p2' && p.legenda.includes('R$'))).toEqual([])
})

test('oferta de item sem preço não cita valor', () => {
  const posts = gerarMes(base({ produtos: [{ id: 'p2', nome: 'Trena a laser', descricao: null, preco: null }] }))
  const ofertas = posts.filter((p) => /^Oferta da semana/.test(p.titulo))
  expect(ofertas.length).toBeGreaterThan(0)
  expect(ofertas.filter((p) => p.legenda.includes('R$'))).toEqual([])
})

test('crescer usa o convite de engajamento e cita o @', () => {
  const posts = gerarMes(base({ estrategia: 'crescer', negocio: { ...base().negocio, insta: 'loja' } }))
  const feed = posts.filter((p) => p.rede === 'instagram' && p.tipo === 'feed')
  expect(feed.some((p) => p.legenda.includes('Siga @loja'))).toBe(true)
  expect(feed.some((p) => p.legenda.includes('Salva este post'))).toBe(true)
})

test('credibilidade tem mais aproximação que demonstração no feed', () => {
  const feed = gerarMes(base({ estrategia: 'credibilidade' })).filter((p) => p.rede === 'instagram' && p.tipo === 'feed')
  const n = (pilar: string) => feed.filter((p) => p.pilar === pilar).length
  expect(n('aprox')).toBeGreaterThan(n('demo'))
})

test.each([
  ['vender', 2, 2], ['tempo', 3, 1], ['crescer', 2, 4], ['credibilidade', 2, 2],
] as const)('%s tem %i montagens e %i roteiros para gravar', (estrategia, montagem, gravar) => {
  const videos = gerarMes(base({ estrategia })).filter((p) => p.tipo === 'video')
  expect(videos.filter((p) => p.formato === 'montagem')).toHaveLength(montagem)
  expect(videos.filter((p) => p.formato === 'gravar')).toHaveLength(gravar)
  expect(videos.every((p) => p.roteiro && p.roteiro.startsWith('1. '))).toBe(true)
})

test('vídeos para gravar não repetem roteiro em psicologia', () => {
  const gravar = gerarMes(base({ ramo: 'psicologia', estrategia: 'crescer' })).filter((p) => p.formato === 'gravar')
  expect(new Set(gravar.map((p) => p.titulo)).size).toBe(gravar.length)
})

test('item desconhecido e único não deixa sobras', () => {
  const posts = gerarMes(base({ produtos: [{ id: 'p9', nome: 'Bolo de pote "da vó" 🍰', descricao: null, preco: null }] }))
  expect(posts.filter((p) => /undefined|\{prod\}|\{loja\}|null/.test(tudo(p)))).toEqual([])
  const feed = posts.filter((p) => p.rede === 'instagram' && p.tipo === 'feed')
  for (let i = 1; i < feed.length; i++) expect(feed[i].titulo).not.toBe(feed[i - 1].titulo)
})

test('nome muito longo não estoura o título', () => {
  const nome = 'Ferragens e Materiais de Construção Martins & Filhos do Bairro Jardim'
  const posts = gerarMes(base({ negocio: { ...base().negocio, nome } }))
  expect(posts.filter((p) => p.titulo.length > 90)).toEqual([])
})

test('Facebook tem menos hashtags e legenda mais longa que o Instagram', () => {
  const posts = gerarMes(base())
  const ig = posts.find((p) => p.rede === 'instagram' && p.tipo === 'feed')!
  const fb = posts.find((p) => p.rede === 'facebook' && p.data === ig.data)!
  expect(fb.titulo).toBe(ig.titulo)
  expect(fb.hashtags.length).toBeLessThan(ig.hashtags.length)
  expect(fb.legenda.length).toBeGreaterThan(ig.legenda.length)
  expect(ig.hashtags).toContain('#ferragensmartins')
})

test('WhatsApp sem hashtags; lista começa com a saudação', () => {
  const posts = gerarMes(base())
  expect(posts.filter((p) => p.rede === 'whatsapp' && p.hashtags.length)).toEqual([])
  const lista = posts.filter((p) => p.tipo === 'lista')
  expect(lista.every((p) => p.legenda.startsWith('Oi! Aqui é Ferragens Martins.'))).toBe(true)
})

test('é determinística', () => {
  expect(gerarMes(base({ estrategia: 'crescer' }))).toEqual(gerarMes(base({ estrategia: 'crescer' })))
})

test('mês começando no meio tem menos posts, todos a partir do início', () => {
  const posts = gerarMes(base({ anoMes: '2026-11', inicio: '2026-11-16' }))
  expect(posts.every((p) => p.data >= '2026-11-16')).toBe(true)
  expect(contar(posts)['instagram/feed']).toBe(7)
})

test('com redes escolhidas, só vêm posts delas, iguais (texto e ordem) aos do mês completo', () => {
  const completo = gerarMes(base())
  const escolhido = gerarMes(base({ redes: ['instagram', 'whatsapp'] }))
  expect(new Set(escolhido.map((p) => p.rede))).toEqual(new Set(['instagram', 'whatsapp']))
  expect(escolhido).toEqual(completo.filter((p) => p.rede === 'instagram' || p.rede === 'whatsapp'))
  expect(validarMes(escolhido, agendaDoMes('2026-12', '2026-12-01', 'vender'), ['instagram', 'whatsapp'])).toEqual([])
})

test('sem redes = as 4 redes, igual a antes', () => {
  expect(gerarMes(base())).toEqual(gerarMes(base({ redes: ['instagram', 'facebook', 'tiktok', 'whatsapp'] })))
  expect(new Set(gerarMes(base()).map((p) => p.rede)).size).toBe(4)
})
