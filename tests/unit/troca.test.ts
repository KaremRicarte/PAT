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
    for (const n of [1, 2, 3]) expect(gerarTroca(doisProdutos(), original, n).formato).toBe(original.formato)
  }
})

test('n=1 muda a legenda', () => {
  const original = primeiro(gerarMes(doisProdutos()), 'instagram', 'feed')
  expect(gerarTroca(doisProdutos(), original, 1).legenda).not.toBe(original.legenda)
})

test('com 1 produto, n=1 ainda muda a legenda', () => {
  for (const [rede, tipo] of [['instagram', 'stories'], ['tiktok', 'video']]) {
    const original = gerarMes(umProduto()).filter((p) => p.rede === rede && p.tipo === tipo).at(-1)!
    expect(gerarTroca(umProduto(), original, 1).legenda).not.toBe(original.legenda)
  }
})

test('n=1 e n=2 diferentes entre si', () => {
  // como na função: a 2ª troca parte do post já trocado uma vez
  const original = primeiro(gerarMes(doisProdutos()), 'instagram', 'feed')
  const um = gerarTroca(doisProdutos(), original, 1)
  expect(gerarTroca(doisProdutos(), um, 2).legenda).not.toBe(um.legenda)
  // sem a legenda atual, compara com o deslocamento anterior
  const { legenda: _, ...semLegenda } = original
  expect(gerarTroca(doisProdutos(), semLegenda, 2).legenda).not.toBe(gerarTroca(doisProdutos(), semLegenda, 1).legenda)
})

test('com a legenda atual informada, a troca nunca devolve a mesma', () => {
  const posts = gerarMes(doisProdutos())
  for (const original of posts.filter((p) => p.tipo !== 'lista')) {
    expect(gerarTroca(doisProdutos(), original, 1).legenda).not.toBe(original.legenda)
  }
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
    for (let n = 1; n <= 5; n++) expect(validarPost(gerarTroca(p, original, n), RAMOS.advocacia)).toEqual([])
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
