import { createHash } from 'node:crypto'
import { gerarMes, type Pacote, type PostGerado } from '../../supabase/functions/_shared/modelos/gerar.ts'
import { gerarTroca } from '../../supabase/functions/_shared/modelos/troca.ts'
import { validarPost } from '../../supabase/functions/_shared/modelos/validar.ts'
import { RAMOS } from '../../supabase/functions/_shared/modelos/ramos/index.ts'

const doisProdutos = (extra: Partial<Pacote> = {}): Pacote => ({
  ramo: 'ferramentas', estrategia: 'vender', anoMes: '2026-12', inicio: '2026-12-01',
  negocio: { nome: 'Ferragens Martins', insta: null, tom: 'proximo', horario: '19:00' },
  produtos: [
    { id: 'p1', nome: 'Furadeira de impacto', descricao: 'Com maleta e brocas.', preco: 299.9 },
    { id: 'p2', nome: 'Trena a laser', descricao: null, preco: null },
  ],
  ...extra,
})
const umProduto = (extra: Partial<Pacote> = {}) =>
  doisProdutos({ produtos: [{ id: 'p1', nome: 'Furadeira de impacto', descricao: null, preco: 299.9 }], ...extra })

const primeiro = (posts: PostGerado[], rede: string, tipo: string, formato?: string) =>
  posts.find((p) => p.rede === rede && p.tipo === tipo && (!formato || p.formato === formato))!

test.each([
  ['instagram', 'feed', undefined],
  ['instagram', 'stories', undefined],
  ['tiktok', 'video', 'gravar'],
  ['tiktok', 'video', 'montagem'],
  ['whatsapp', 'status', undefined],
])('mesma data, rede, tipo, formato e horário do post original (%s/%s)', (rede, tipo, formato) => {
  const original = primeiro(gerarMes(doisProdutos()), rede, tipo, formato)
  // o horário do negócio mudou depois: a troca mantém o do post
  const novo = gerarTroca(doisProdutos({ negocio: { nome: 'Ferragens Martins', insta: null, tom: 'proximo', horario: '08:00' } }),
    original, 1)
  expect(novo).toMatchObject({
    data: original.data, rede: original.rede, tipo: original.tipo,
    formato: original.formato, horario: original.horario, ordem: original.ordem,
  })
})

test('formato do feed é sempre o do original, mesmo que a troca venha de outro formato', () => {
  for (const original of gerarMes(doisProdutos()).filter((p) => p.tipo === 'feed')) {
    for (const n of [1, 2, 3]) expect(gerarTroca(doisProdutos(), original, n)?.formato).toBe(original.formato)
  }
})

const PACOTES = { '1 produto': umProduto(), '2 produtos': doisProdutos() }
// Com 1 produto, as 2 montagens e as 2 mensagens da lista do mês têm o mesmo texto: não há outro para oferecer.
const LIMITE_NULOS: Record<string, number> = { '1 produto': 4, '2 produtos': 0 }
const tipoDe = (p: PostGerado) => `${p.rede}/${p.tipo}${p.tipo === 'video' ? '/' + p.formato : ''}`

// Quantas trocas não acham texto novo (null), por pacote. O relatório da tarefa mostra estes números.
const SEM_TEXTO_NOVO: Record<string, Record<string, number>> = {}

describe.each(Object.entries(PACOTES))('%s', (nome, p) => {
  const mes = gerarMes(p)

  test('o mês tem todos os tipos (feed IG e FB, stories, vídeo montagem e gravar, status, lista)', () => {
    expect([...new Set(mes.map(tipoDe))].sort()).toEqual([
      'facebook/feed', 'instagram/feed', 'instagram/stories', 'tiktok/video/gravar', 'tiktok/video/montagem',
      'whatsapp/lista', 'whatsapp/status'])
  })

  test('em todo post, n=1 devolve legenda diferente da atual ou null (e null é raro)', () => {
    const nulos: Record<string, number> = {}
    for (const original of mes) {
      const novo = gerarTroca(p, original, 1)
      if (novo === null) { nulos[tipoDe(original)] = (nulos[tipoDe(original)] ?? 0) + 1; continue }
      expect(novo.legenda).not.toBe(original.legenda)
    }
    SEM_TEXTO_NOVO[nome] = nulos
    const total = Object.values(nulos).reduce((a, b) => a + b, 0)
    expect(total).toBeLessThanOrEqual(LIMITE_NULOS[nome])
  })

  test('3 trocas seguidas nunca repetem um texto já visto', () => {
    for (const original of mes) {
      const vistos = new Set([original.legenda])
      let atual = original
      for (let n = 1; n <= 3; n++) {
        const novo = gerarTroca(p, atual, n)
        if (!novo) break
        expect(vistos.has(novo.legenda), `${tipoDe(original)} ${original.data} n=${n}`).toBe(false)
        vistos.add(novo.legenda)
        atual = { ...original, ...novo }
      }
    }
  })
})

afterAll(() => console.log('trocas sem texto novo (n=1):', JSON.stringify(SEM_TEXTO_NOVO)))

test('sem a legenda atual, a troca n não repete as trocas 1..n-1 nem o original', () => {
  const original = primeiro(gerarMes(doisProdutos()), 'instagram', 'feed')
  const { legenda: _, ...semLegenda } = original
  const legendas = [original.legenda, ...[1, 2, 3].map((n) => gerarTroca(doisProdutos(), semLegenda, n)!.legenda)]
  expect(new Set(legendas).size).toBe(legendas.length)
})

test('advocacia: troca nunca tem preço nem promoção', () => {
  const p = doisProdutos({
    ramo: 'advocacia',
    produtos: [
      { id: 'p1', nome: 'Consulta trabalhista', descricao: null, preco: 200 },
      { id: 'p2', nome: 'Divórcio', descricao: null, preco: 1500 },
    ],
  })
  for (const original of gerarMes(p)) {
    for (let n = 1; n <= 5; n++) {
      const novo = gerarTroca(p, original, n)
      if (novo) expect(validarPost(novo, RAMOS.advocacia)).toEqual([])
    }
  }
})

// Impressão digital da saída de gerarMes antes do `deslocamento` (Etapa 2): o mês gerado não pode mudar.
const ETAPA2: Record<string, string> = {
  vender: '6048fa1b41244189', crescer: '0bf76159969e07f8', credibilidade: '467ed2f5775dd89e', tempo: '9762d13bcc9960b8',
}
const digital = (posts: PostGerado[]) => createHash('sha256').update(JSON.stringify(posts)).digest('hex').slice(0, 16)

test('deslocamento 0 = gerarMes de hoje', () => {
  for (const estrategia of ['vender', 'crescer', 'credibilidade', 'tempo'] as const) {
    expect(gerarMes(doisProdutos({ estrategia, deslocamento: 0 }))).toEqual(gerarMes(doisProdutos({ estrategia })))
    expect(digital(gerarMes(doisProdutos({ estrategia, deslocamento: 0 })))).toBe(ETAPA2[estrategia])
  }
})

test('mês gerado a partir do meio: a troca acha o post mesmo com a agenda do mês inteiro', () => {
  // o mês foi gerado a partir do dia 16; a troca monta o pacote a partir do dia 1
  const original = gerarMes(doisProdutos({ inicio: '2026-12-16' })).filter((p) => p.tipo === 'feed').at(-1)!
  const novo = gerarTroca(doisProdutos(), original, 1)
  expect(novo).toMatchObject({ data: original.data, rede: original.rede, tipo: original.tipo, formato: original.formato })
})
