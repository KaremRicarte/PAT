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
    { id: 'p1', nome: 'Furadeira de impacto', descricao: 'Com maleta e brocas.', preco: 299.9, preco_promo: null },
    { id: 'p2', nome: 'Trena a laser', descricao: null, preco: null, preco_promo: null },
  ],
  ...extra,
})

// Os 4 exemplos do arquivo (spec §3): 2 promoções, 1 vitrine e 1 sem preço.
const LISTA_SPEC: Pacote['produtos'] = [
  { id: 'g', nome: 'Gramado', descricao: null, preco: 2199, preco_promo: 1799 },
  { id: 'l', nome: 'Leste Europeu', descricao: null, preco: 10299, preco_promo: 9999 },
  { id: 's', nome: 'Porto Seguro', descricao: null, preco: 1999, preco_promo: 1999 },
  { id: 'p', nome: 'Portugal', descricao: null, preco: null, preco_promo: null },
]
// Turismo: o preço só vale com "Detalhes do pacote" marcado
const turismo = (extra: Partial<Pacote> = {}) => base({ ramo: 'turismo', produtos: LISTA_SPEC.map((p) => ({ ...p, pacote: { ativo: true } })), ...extra })
const feedDePreco = (posts: PostGerado[], rede = 'instagram') =>
  posts.filter((p) => p.rede === rede && p.tipo === 'feed' && p.preco_por !== null)
const PALAVRAS_PROMO = /(?<!\p{L})(promo(ção|ções|cional|cionais|s)?|descontos?|off)(?!\p{L})|black friday/iu

const contar = (posts: PostGerado[]) => {
  const c: Record<string, number> = {}
  for (const p of posts) c[`${p.rede}/${p.tipo}`] = (c[`${p.rede}/${p.tipo}`] ?? 0) + 1
  return c
}
// datas especiais de dezembro (todos os ramos): Natal e Réveillon entram no feed
const DEZ = ['2026-12-25', '2026-12-31']
const tudo = (p: PostGerado) => [p.titulo, p.legenda, p.roteiro ?? '', ...p.hashtags].join('\n')

test('dezembro (segunda a sexta): um conteúdo por dia em todas as redes; lista 1x e vídeo 2x por semana', () => {
  const posts = gerarMes(base())
  expect(contar(posts)).toEqual({
    'instagram/feed': 23, 'instagram/stories': 23, 'facebook/feed': 23, 'whatsapp/status': 23,
    'whatsapp/lista': 5, 'tiktok/video': 10,
  })
  expect(validarMes(posts, agendaDoMes('2026-12', '2026-12-01', 'vender', DEZ))).toEqual([])
  // o mesmo assunto em todas as redes do dia
  for (const ig of posts.filter((p) => p.rede === 'instagram' && p.tipo === 'feed')) {
    const doDia = posts.filter((p) => p.data === ig.data && p.tipo !== 'stories')
    expect(new Set(doDia.map((p) => p.titulo.replace(/^Mensagem para a lista: /, '')))).toEqual(new Set([ig.titulo]))
    expect(new Set(doDia.map((p) => p.produto_id))).toEqual(new Set([ig.produto_id]))
  }
})

test('story do dia é uma enquete sobre o assunto do dia', () => {
  const posts = gerarMes(turismo())
  const stories = posts.filter((p) => p.tipo === 'stories')
  for (const st of stories) {
    expect(st.legenda).toMatch(/\n\nEnquete: [^/]+ \/ [^/]+$/)
    expect(st.titulo.trim().endsWith('?')).toBe(true)
    const ig = posts.find((p) => p.data === st.data && p.rede === 'instagram' && p.tipo === 'feed')!
    expect(st.produto_id).toBe(ig.produto_id)
  }
  const demo = stories.find((p) => p.pilar === 'demo' && p.produto_id === 'g')!
  expect(demo.titulo).toMatch(/Gramado/)
})

test('posts em ordem de data, com ordem sequencial a partir de 0', () => {
  const posts = gerarMes(base())
  expect(posts.map((p) => p.ordem)).toEqual(posts.map((_, i) => i))
  expect(posts.map((p) => p.data)).toEqual(posts.map((p) => p.data).sort())
  expect(posts.every((p) => p.horario === '19:00')).toBe(true)
})

describe.each(Object.keys(RAMOS))('ramo %s', (ramo) => {
  test.each(ESTRATEGIAS)('todo post passa em validarPost (%s)', (estrategia) => {
    // promoção, vitrine e sem preço juntos
    const posts = gerarMes(base({ ramo, estrategia, produtos: [...base().produtos, ...LISTA_SPEC] }))
    const problemas = posts.flatMap((p) => validarPost(p, RAMOS[ramo]).map((e) => `${p.data} ${p.rede}/${p.tipo}: ${e}`))
    expect(problemas).toEqual([])
    expect(validarMes(posts, agendaDoMes('2026-12', '2026-12-01', estrategia, DEZ))).toEqual([])
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

test('vender: 1 post de preço por item com preço, promoções primeiro, em sextas e sábados', () => {
  const todos = gerarMes(turismo())
  const ig = feedDePreco(todos)
  expect(ig.map((p) => [p.data, p.produto_id, p.preco_de, p.preco_por])).toEqual([
    ['2026-12-04', 'g', 2199, 1799],
    ['2026-12-11', 'l', 10299, 9999],
    ['2026-12-18', 's', null, 1999],
  ])
  for (const p of ig) {
    const fb = todos.find((x) => x.rede === 'facebook' && x.tipo === 'feed' && x.data === p.data)!
    expect(fb).toMatchObject({ produto_id: p.produto_id, preco_de: p.preco_de, preco_por: p.preco_por, pilar: 'demo' })
    expect(fb.legenda).toContain(p.preco_de ? 'Aproveite enquanto durar!' : 'Por R$')
    expect(p.pilar).toBe('demo')
  }
  const [gramado, leste, porto] = ig
  expect(gramado.titulo.startsWith('Oferta: ')).toBe(true)
  expect(gramado.legenda).toContain('De R$ 2.199 por R$ 1.799. Aproveite enquanto durar!')
  expect(leste.legenda).toContain('De R$ 10.299 por R$ 9.999. Aproveite enquanto durar!')
  expect(porto.titulo.startsWith('Oferta')).toBe(false)
  expect(porto.legenda).toContain('Por R$ 1.999.')
  expect(PALAVRAS_PROMO.test(tudo(porto))).toBe(false)
  // sem preço: nenhum post fala de valor
  expect(todos.filter((p) => p.preco_por === null && tudo(p).includes('R$'))).toEqual([])
  expect(todos.filter((p) => /Portugal/i.test(tudo(p)) && tudo(p).includes('R$'))).toEqual([])
  // nada do texto antigo
  expect(todos.filter((p) => /Condição especial esta semana:|Oferta da semana/.test(tudo(p)))).toEqual([])
})

test('vender: o preço do dia vale para todos os posts do dia (lista, status e story também)', () => {
  const posts = gerarMes(turismo())
  const dias = new Set(feedDePreco(posts).map((p) => p.data))
  expect(dias.size).toBeGreaterThan(0)
  for (const d of dias) {
    const doDia = posts.filter((p) => p.data === d)
    expect(new Set(doDia.map((p) => `${p.preco_de}/${p.preco_por}`)).size).toBe(1)
  }
  const promo = posts.find((p) => p.tipo === 'status' && p.preco_de === 2199)!
  expect(promo.legenda).toContain('De R$ 2.199 por R$ 1.799. Aproveite enquanto durar!')
})

test.each(['crescer', 'tempo', 'credibilidade'] as const)('%s: no máximo 2 posts de preço, promoções primeiro, lista sem preço', (estrategia) => {
  const posts = gerarMes(turismo({ estrategia }))
  expect(feedDePreco(posts).map((p) => [p.data, p.produto_id])).toEqual([['2026-12-04', 'g'], ['2026-12-11', 'l']])
  expect(feedDePreco(posts, 'facebook')).toHaveLength(2)
  const lista = posts.filter((p) => p.tipo === 'lista')
  expect(lista.filter((p) => p.preco_por !== null || p.legenda.includes('R$'))).toEqual([])
})

test('noPromo: nenhum preço', () => {
  for (const estrategia of ESTRATEGIAS) {
    const posts = gerarMes(base({
      ramo: 'psicologia', estrategia,
      produtos: [{ id: 'p1', nome: 'Atendimento online', descricao: null, preco: 150, preco_promo: 120 },
        { id: 'p2', nome: 'Terapia de casal', descricao: null, preco: 200, preco_promo: null }],
    }))
    expect(posts.filter((p) => tudo(p).includes('R$'))).toEqual([])
    expect(posts.filter((p) => p.preco_de !== null || p.preco_por !== null)).toEqual([])
  }
})

test('mais itens com preço que vagas: corta pelo teto de demo', () => {
  const produtos = Array.from({ length: 20 }, (_, i) =>
    ({ id: `p${i}`, nome: `Item ${i}`, descricao: null, preco: 100 + i, preco_promo: i % 2 ? 90 : null }))
  const posts = gerarMes(base({ produtos }))
  const ig = feedDePreco(posts)
  // vender: metade dos 23 dias de feed é demo (o dia do Natal fica para o post da data)
  expect(ig).toHaveLength(11)
  // promoções (ímpares) primeiro, na ordem da lista; sextas antes (a sexta 25 é do Natal)
  expect(ig.filter((p) => ['2026-12-04', '2026-12-11', '2026-12-18'].includes(p.data))
    .map((p) => p.produto_id)).toEqual(['p1', 'p3', 'p5'])
  expect(ig.some((p) => p.data === '2026-12-25')).toBe(false)
  expect(validarMes(posts, agendaDoMes('2026-12', '2026-12-01', 'vender', DEZ))).toEqual([])
})

test.each(ESTRATEGIAS)('contagem por rede não muda com posts de preço (%s)', (estrategia) => {
  const posts = gerarMes(turismo({ estrategia }))
  expect(validarMes(posts, agendaDoMes('2026-12', '2026-12-01', estrategia, DEZ))).toEqual([])
  expect(posts).toHaveLength(gerarMes(turismo({ estrategia, produtos: [LISTA_SPEC[3]] })).length)
})

test('todo post leva preco_de e preco_por (null quando não é de preço)', () => {
  const posts = gerarMes(turismo())
  expect(posts.filter((p) => !('preco_de' in p) || !('preco_por' in p))).toEqual([])
  // dia sem preço: nenhum post do dia tem preço
  const semPreco = posts.filter((p) => p.rede === 'instagram' && p.tipo === 'feed' && p.preco_por == null).map((p) => p.data)
  expect(posts.filter((p) => semPreco.includes(p.data) && (p.preco_de !== null || p.preco_por !== null))).toEqual([])
})

test('produto antigo (preco_promo ausente) com preço vira vitrine', () => {
  const posts = gerarMes(base({ produtos: [{ id: 'p1', nome: 'Furadeira', descricao: null, preco: 99.9 } as Pacote['produtos'][0]] }))
  expect(feedDePreco(posts).map((p) => [p.preco_de, p.preco_por])).toEqual([[null, 99.9]])
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

test.each(ESTRATEGIAS)('%s: vídeo 2x por semana, com o assunto do dia (montagem com item, roteiro para gravar sem)', (estrategia) => {
  const posts = gerarMes(base({ estrategia }))
  const videos = posts.filter((p) => p.tipo === 'video')
  expect(videos).toHaveLength(10)
  for (const v of videos) {
    const ig = posts.find((p) => p.data === v.data && p.rede === 'instagram' && p.tipo === 'feed')!
    expect(v.titulo).toBe(ig.titulo)
    expect(v.formato).toBe(v.produto_id ? 'montagem' : 'gravar')
    expect(v.roteiro?.startsWith('1. ')).toBe(true)
  }
})

test('psicologia: vídeo para gravar tem roteiro sem sobras', () => {
  const gravar = gerarMes(base({ ramo: 'psicologia', estrategia: 'crescer' })).filter((p) => p.formato === 'gravar')
  expect(gravar.length).toBeGreaterThan(0)
  expect(gravar.filter((p) => /undefined|null/.test(p.roteiro ?? ''))).toEqual([])
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
  expect(contar(posts)['instagram/feed']).toBe(11)
})

test('com redes escolhidas, só vêm posts delas, iguais (texto e ordem) aos do mês completo', () => {
  const completo = gerarMes(base())
  const escolhido = gerarMes(base({ redes: ['instagram', 'whatsapp'] }))
  expect(new Set(escolhido.map((p) => p.rede))).toEqual(new Set(['instagram', 'whatsapp']))
  expect(escolhido).toEqual(completo.filter((p) => p.rede === 'instagram' || p.rede === 'whatsapp'))
  expect(validarMes(escolhido, agendaDoMes('2026-12', '2026-12-01', 'vender', DEZ), ['instagram', 'whatsapp'])).toEqual([])
})

test('sem redes = as 4 redes, igual a antes', () => {
  expect(gerarMes(base())).toEqual(gerarMes(base({ redes: ['instagram', 'facebook', 'tiktok', 'whatsapp'] })))
  expect(new Set(gerarMes(base()).map((p) => p.rede)).size).toBe(4)
})

describe('formato do feed: carrossel', () => {
  const pacote = (ramo: string, produtos = [{ id: 'p1', nome: 'Serviço um', descricao: null, preco: 120, preco_promo: 99 }, { id: 'p2', nome: 'Serviço dois', descricao: null, preco: null, preco_promo: null }]) =>
    ({ ramo, estrategia: 'vender', anoMes: '2026-12', inicio: '2026-12-01', negocio: { nome: 'Negócio Teste', insta: null, tom: 'proximo', horario: '19:00' }, produtos }) as Parameters<typeof gerarMes>[0]
  test('aproximação e necessidade sempre em carrossel', () => {
    for (const ramo of ['ferramentas', 'psicologia']) {
      const feed = gerarMes(pacote(ramo)).filter((p) => p.tipo === 'feed' && p.pilar !== 'demo')
      expect(feed.length).toBeGreaterThan(0)
      expect(feed.every((p) => p.formato === 'carrossel')).toBe(true)
    }
  })
  test('demonstração do serviço e oferta com preço ficam em arte única, menos nos ramos só de texto', () => {
    const demo = gerarMes(pacote('ferramentas')).filter((p) => p.tipo === 'feed' && p.pilar === 'demo')
    expect(demo.length).toBeGreaterThan(0)
    expect(demo.every((p) => p.formato === 'arte')).toBe(true)
    const demoPsi = gerarMes(pacote('psicologia')).filter((p) => p.tipo === 'feed' && p.pilar === 'demo')
    expect(demoPsi.every((p) => p.formato === (p.preco_por == null ? 'carrossel' : 'arte'))).toBe(true)
  })
})
