import { pascoa, datasDoMes, datasParaPromocao, diaMes } from '../../supabase/functions/_shared/modelos/datas.ts'
import { gerarMes, agendaDoPacote, textoDoPreco, type Pacote, type PostGerado } from '../../supabase/functions/_shared/modelos/gerar.ts'
import { validarPost, validarMes } from '../../supabase/functions/_shared/modelos/validar.ts'
import { RAMOS } from '../../supabase/functions/_shared/modelos/ramos/index.ts'

const turismo = RAMOS.turismo, psicologia = RAMOS.psicologia
const nomes = (l: { nome: string }[]) => l.map((d) => d.nome)

describe('datas especiais', () => {
  test('datas móveis: Páscoa, Carnaval, Dia das Mães, Dia dos Pais e Black Friday', () => {
    expect(pascoa(2026)).toBe('2026-04-05')
    expect(pascoa(2027)).toBe('2027-03-28')
    expect(datasDoMes('2026-02', turismo).find((d) => d.nome === 'Carnaval')?.data).toBe('2026-02-17')
    expect(datasDoMes('2026-05', turismo).find((d) => d.nome === 'Dia das Mães')?.data).toBe('2026-05-10')
    expect(datasDoMes('2026-08', turismo).find((d) => d.nome === 'Dia dos Pais')?.data).toBe('2026-08-09')
    expect(datasDoMes('2026-11', turismo)).toEqual([{ data: '2026-11-27', nome: 'Black Friday', promo: true, soPromo: true }])
  })
  test('cada ramo vê as suas datas; ramos com conselho não veem datas só de promoção nem sugestão de promoção', () => {
    expect(nomes(datasDoMes('2026-11', psicologia))).toEqual([])
    const set = datasDoMes('2026-09', psicologia)
    expect(nomes(set)).toEqual(['Setembro Amarelo', 'Dia do Cliente'])
    expect(set.every((d) => !d.promo)).toBe(true)
    expect(nomes(datasDoMes('2026-09', turismo))).toEqual(['Dia do Cliente', 'Dia Mundial do Turismo'])
  })
  test('datas para a promoção do item: as próximas boas para promoção; nenhuma em psicologia', () => {
    const l = datasParaPromocao('2026-11-19', turismo)
    expect(nomes(l).slice(0, 4)).toEqual(['Black Friday', 'Natal', 'Réveillon', 'Ano Novo'])
    expect(l.every((d) => d.promo && d.data >= '2026-11-19')).toBe(true)
    expect(datasParaPromocao('2026-11-19', psicologia)).toEqual([])
    expect(diaMes('2026-12-25')).toBe('25/12')
  })
})

const LISTA: Pacote['produtos'] = [
  { id: 'g', nome: 'Gramado', descricao: null, preco: 2199, preco_promo: 1799 },
  { id: 's', nome: 'Porto Seguro', descricao: null, preco: 1999, preco_promo: null },
  { id: 'c', nome: 'Cruzeiro', descricao: null, preco: null, preco_promo: null },
]
const pacote = (extra: Partial<Pacote> = {}): Pacote => ({
  ramo: 'turismo', estrategia: 'vender', anoMes: '2026-12', inicio: '2026-12-01',
  negocio: { nome: 'Malibu', insta: null, tom: 'proximo', horario: '19:00' }, produtos: LISTA, ...extra,
})
const comData = (data: string) => LISTA.map((p) => (p.id === 'g' ? { ...p, promo_data: data } : p))
const feedIG = (posts: PostGerado[]) => posts.filter((p) => p.rede === 'instagram' && p.tipo === 'feed')
const valido = (p: Pacote, posts: PostGerado[]) => {
  const doCliente = ['Malibu', ...p.produtos.map((x) => x.nome)]
  expect(posts.flatMap((x) => validarPost(x, RAMOS[p.ramo], doCliente).map((e) => `${x.data} ${x.rede}: ${e}`))).toEqual([])
  expect(validarMes(posts, agendaDoPacote(p))).toEqual([])
}

describe('promoção com data (vale só perto da data)', () => {
  test('Natal: post forte no dia e 2 de aquecimento antes; fora da semana, Gramado sem preço promocional', () => {
    const p = pacote({ produtos: comData('2026-12-25') })
    const posts = gerarMes(p)
    const dia = feedIG(posts).find((x) => x.data === '2026-12-25')!
    expect(dia).toMatchObject({ produto_id: 'g', preco_de: 2199, preco_por: 1799, ocasiao: { nome: 'Natal', data: '2026-12-25', fase: 'dia' } })
    expect(dia.titulo.startsWith('Oferta de Natal: ')).toBe(true)
    expect(dia.legenda).toContain('Oferta de Natal, só hoje (25/12): de R$ 2.199 por R$ 1.799.')
    const aquec = feedIG(posts).filter((x) => x.ocasiao?.fase === 'aquecimento')
    expect(aquec.map((x) => x.data)).toEqual(['2026-12-21', '2026-12-23'])
    for (const a of aquec) {
      expect(a.titulo.startsWith('Vem aí a oferta de Natal: ')).toBe(true)
      expect(a.legenda).toContain('Oferta de Natal, só no dia 25/12: de R$ 2.199 por R$ 1.799.')
    }
    // promoção (de/por) do Gramado só de 18 a 25/12
    const promoGramado = posts.filter((x) => x.produto_id === 'g' && x.preco_de != null)
    expect(promoGramado.every((x) => x.data >= '2026-12-18' && x.data <= '2026-12-25')).toBe(true)
    valido(p, posts)
  })
  test('outro dia (sem data comemorativa): o dia entra no feed e o título diz o dia', () => {
    const p = pacote({ produtos: comData('2026-12-12') }) // sábado: fora da agenda normal
    const posts = gerarMes(p)
    const dia = feedIG(posts).find((x) => x.data === '2026-12-12')!
    expect(dia.ocasiao).toEqual({ nome: null, data: '2026-12-12', fase: 'dia' })
    expect(dia.titulo.startsWith('Oferta do dia 12/12: ')).toBe(true)
    expect(dia.legenda).toContain('Oferta só hoje (12/12): de R$ 2.199 por R$ 1.799.')
    valido(p, posts)
  })
  test('Black Friday só ganha post com promoção marcada', () => {
    const nov = { anoMes: '2026-11', inicio: '2026-11-01' }
    const sem = gerarMes(pacote(nov))
    expect(sem.some((x) => x.ocasiao)).toBe(false)
    const p = pacote({ ...nov, produtos: comData('2026-11-27') })
    const bf = feedIG(gerarMes(p)).find((x) => x.data === '2026-11-27')!
    expect(bf.titulo.startsWith('Oferta de Black Friday: ')).toBe(true)
    valido(p, gerarMes(p))
  })
  test('promoção marcada para outro mês: o item fica com o preço normal o mês todo', () => {
    const posts = gerarMes(pacote({ produtos: comData('2027-01-10') }))
    expect(posts.filter((x) => x.produto_id === 'g' && x.preco_de != null)).toEqual([])
    expect(posts.some((x) => x.produto_id === 'g' && x.preco_por === 2199)).toBe(true)
  })
  test('data sem promoção vira post de tema (Natal), também em psicologia', () => {
    for (const ramo of ['turismo', 'psicologia']) {
      const p = pacote({ ramo })
      const posts = gerarMes(p)
      const natal = posts.filter((x) => x.data === '2026-12-25' && x.tipo === 'feed')
      expect(natal.map((x) => x.ocasiao)).toEqual([
        { nome: 'Natal', data: '2026-12-25', fase: 'tema' }, { nome: 'Natal', data: '2026-12-25', fase: 'tema' }])
      expect(natal.every((x) => x.preco_por == null)).toBe(true)
      valido(p, posts)
    }
  })
  test('texto de preço da promoção com data diz o prazo', () => {
    expect(textoDoPreco(100, 80, { nome: 'Dia das Mães', data: '2027-05-09', fase: 'aquecimento' }))
      .toBe('Oferta do Dia das Mães, só no dia 09/05: de R$ 100 por R$ 80.')
    expect(textoDoPreco(100, 80)).toBe('De R$ 100 por R$ 80. Aproveite enquanto durar!')
    expect(textoDoPreco(null, 80, { nome: 'Natal', data: '2026-12-25', fase: 'dia' })).toBe('Por R$ 80.')
  })
})
