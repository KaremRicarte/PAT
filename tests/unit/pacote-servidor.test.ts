// Os detalhes do pacote (Turismo) no pedido da IA e nos textos de modelo.
import { escreverPost, type ChamarIA, type EntradaPost } from '../../supabase/functions/_shared/ia/escrever.ts'
import { montarEntradaPost } from '../../supabase/functions/_shared/ia/entrada.ts'
import { gerarMes, type Pacote as PacoteDoMes } from '../../supabase/functions/_shared/modelos/gerar.ts'

const PACOTE = { ativo: true, hotel: 'Serra Azul', ida: '2026-12-12', volta: '2026-12-17', transporte: 'aviao', transfer: true,
  refeicoes: { cafe: true, almoco: false, jantar: false }, preco_por: 'pessoa', parcelas: 10, taxas: true, pix: 5 }

const dados = (pacote: unknown, ramo = 'turismo') => ({
  ramo, estrategia: 'vender' as const, negocio: { nome: 'Malibu', insta: null, tom: 'proximo' as const },
  produtos: [{ id: 'g', nome: 'Gramado', descricao: null, pacote }],
})
const lugar = (extra = {}) => ({
  data: '2026-12-04', rede: 'instagram' as const, tipo: 'feed' as const, formato: 'arte' as const, pilar: 'demo' as const,
  titulo: 'Gramado', legenda: 'Gramado no Natal.', produto_id: 'g', preco_de: 2800, preco_por: 2390, ...extra,
})

test('montarEntradaPost: pacote ativo do Turismo vai como resumo; com preço, com as condições', () => {
  const e = montarEntradaPost(dados(PACOTE), lugar(), null)
  expect(e.produto!.pacote).toContain('Hotel Serra Azul')
  expect(e.produto!.pacote).toContain('em até 10x')
})

test('montarEntradaPost: sem preço (Ocultar preço), o resumo não leva parcelas nem Pix', () => {
  const e = montarEntradaPost(dados(PACOTE), lugar({ preco_de: null, preco_por: null }), null)
  expect(e.produto!.pacote).toContain('Hotel Serra Azul')
  expect(e.produto!.pacote).not.toContain('em até')
  expect(e.produto!.pacote).not.toContain('Pix')
})

test('montarEntradaPost: pacote desmarcado ou outro ramo → sem pacote', () => {
  expect(montarEntradaPost(dados({ ...PACOTE, ativo: false }), lugar(), null).produto!.pacote).toBe(null)
  expect(montarEntradaPost(dados(PACOTE, 'beleza'), lugar(), null).produto!.pacote).toBe(null)
})

const textoDo = (p: Parameters<ChamarIA>[0]) => p.conteudo.map((c) => (c.tipo === 'texto' ? c.texto : '')).join('\n')
const resposta = {
  titulo: 'Oferta: Gramado no Natal com tudo incluso', gancho: 'Natal com cara de filme?', meio: 'Ruas iluminadas e chocolate quente.',
  convite: 'Chama no WhatsApp.', hashtags: ['#gramado'], roteiro: 'Como montar: a foto.', enquete: null,
}

test('escreverPost: o pacote vai para o pedido da IA e o parágrafo de preço leva o resumo', async () => {
  const pedidos: Parameters<ChamarIA>[0][] = []
  const chamar: ChamarIA = async (p) => { pedidos.push(p); return { ok: true, dados: resposta, uso: { entrada: 1, saida: 1 } } as never }
  const e: EntradaPost = montarEntradaPost(dados(PACOTE), lugar(), null)
  const r = await escreverPost(chamar, e)
  expect(textoDo(pedidos[0])).toContain('Detalhes do pacote (use só estes fatos, não invente outros): Hotel Serra Azul')
  expect(r!.post.legenda).toContain('De R$ 2.800 por R$ 2.390. Aproveite enquanto durar! Hotel Serra Azul; ida 12/12/2026')
})

test('escreverPost sem pacote: nada muda no pedido', async () => {
  const pedidos: Parameters<ChamarIA>[0][] = []
  const chamar: ChamarIA = async (p) => { pedidos.push(p); return { ok: true, dados: resposta, uso: { entrada: 1, saida: 1 } } as never }
  await escreverPost(chamar, montarEntradaPost(dados(null), lugar(), null))
  expect(textoDo(pedidos[0])).not.toContain('Detalhes do pacote')
})

const mes = (pacote: unknown, extra: Partial<PacoteDoMes['produtos'][number]> = {}): PacoteDoMes => ({
  ramo: 'turismo', estrategia: 'vender', anoMes: '2026-12', inicio: '2026-12-01',
  negocio: { nome: 'Malibu', insta: null, tom: 'proximo', horario: '19:00' },
  produtos: [{ id: 'g', nome: 'Gramado', descricao: null, preco: 2800, preco_promo: 2390, pacote, ...extra }],
})

test('gerarMes Turismo: o post de preço do pacote leva os detalhes', () => {
  const comPreco = gerarMes(mes(PACOTE)).filter((p) => p.preco_por != null && p.tipo === 'feed')
  expect(comPreco.length).toBeGreaterThan(0)
  for (const p of comPreco) expect(p.legenda).toContain('transfer aeroporto–hotel incluso')
})

test('gerarMes Turismo: promoção com data sem preço (Ocultar preço) leva os detalhes sem parcelas', () => {
  const posts = gerarMes(mes(PACOTE, { preco: null, preco_promo: null, promo_data: '2026-12-20' }))
  const daData = posts.filter((p) => p.ocasiao?.fase === 'dia' && p.produto_id === 'g' && p.tipo === 'feed')
  expect(daData.length).toBeGreaterThan(0)
  for (const p of daData) {
    expect(p.legenda).toContain('Hotel Serra Azul')
    expect(p.legenda).not.toContain('em até')
  }
})

test('gerarMes: sem pacote ativo, o texto é o de sempre', () => {
  const a = gerarMes(mes(null)), b = gerarMes(mes({ ...PACOTE, ativo: false }))
  expect(b.map((p) => p.legenda)).toEqual(a.map((p) => p.legenda))
  expect(a.some((p) => p.legenda.includes('Serra Azul'))).toBe(false)
})

test('gerarMes: post de vitrine (sem promoção) com Pix passa na validação (sem palavra de promoção)', async () => {
  const { validarPost } = await import('../../supabase/functions/_shared/modelos/validar.ts')
  const { RAMOS } = await import('../../supabase/functions/_shared/modelos/ramos/index.ts')
  const posts = gerarMes(mes(PACOTE, { preco_promo: null }))
  expect(posts.some((p) => p.legenda.includes('5% a menos no Pix'))).toBe(true)
  expect(posts.flatMap((p) => validarPost(p, RAMOS.turismo, ['Malibu', 'Gramado']))).toEqual([])
})

test('hotel com palavra de promoção ("Pousada Off Road") é texto do cliente: o mês sai e a IA recebe o hotel como texto dele', async () => {
  const { gerarMesDoCliente } = await import('../../supabase/functions/gerar-mes/acoes.ts')
  const pacote = { ...PACOTE, hotel: 'Pousada Off Road' }
  const r = await gerarMesDoCliente({ estrategia: 'vender' }, {
    cliente: async () => ({ id: 'c1', situacao: 'ativo', senha_provisoria: false, ramo: 'turismo' }),
    negocio: async () => ({ nome: 'Malibu', insta: null, tom: 'proximo', horario: '19:00' }),
    produtos: async () => [{ id: 'g', nome: 'Gramado', descricao: null, preco: 2800, preco_promo: null, pacote }],
    mesesGerados: async () => [], hoje: () => '2026-11-16', salvar: async () => ({ id: 'm1' }),
  } as never)
  expect(r.status).toBe(201)
  expect(montarEntradaPost(dados(pacote), lugar(), null).textosDoCliente).toContain('Pousada Off Road')
})
