// Promoção marcada para um mês seguinte: o mês gerado já faz a chamada ("Vem aí"), 2 posts por mês, até 120 dias antes.
import { gerarMes, type Pacote } from '../../supabase/functions/_shared/modelos/gerar.ts'
import { validarPost } from '../../supabase/functions/_shared/modelos/validar.ts'
import { RAMOS } from '../../supabase/functions/_shared/modelos/ramos/index.ts'

const mes = (promo_data: string | null, extra: Partial<Pacote> = {}): Pacote => ({
  ramo: 'turismo', estrategia: 'vender', anoMes: '2026-12', inicio: '2026-12-01',
  negocio: { nome: 'Malibu', insta: null, tom: 'proximo', horario: '19:00' },
  produtos: [
    { id: 'g', nome: 'Gramado', descricao: null, preco: 2199, preco_promo: 1799, promo_data, pacote: { ativo: true } },
    { id: 's', nome: 'Porto Seguro', descricao: null, preco: 1999, preco_promo: null, pacote: { ativo: true } },
  ],
  ...extra,
})
const chamadas = (posts: ReturnType<typeof gerarMes>, data: string) =>
  [...new Set(posts.filter((p) => p.ocasiao?.data === data && p.ocasiao?.fase === 'aquecimento').map((p) => p.data))]

test('promoção no Carnaval (fevereiro): dezembro já tem 2 dias de chamada "Vem aí", com o pacote e o preço da promoção', () => {
  const posts = gerarMes(mes('2027-02-16'))
  const dias = chamadas(posts, '2027-02-16')
  expect(dias.length).toBe(2)
  const feed = posts.filter((p) => dias.includes(p.data) && p.rede === 'instagram' && p.tipo === 'feed')
  for (const p of feed) {
    expect(p.titulo).toMatch(/^Vem aí/)
    expect(p.produto_id).toBe('g')
    expect(p.preco_por).toBe(1799)
  }
  for (const p of posts) expect(validarPost(p, RAMOS.turismo, ['Malibu', 'Gramado', 'Porto Seguro'])).toEqual([])
})

test('promoção a mais de 120 dias, já passada ou sem data: nenhuma chamada antecipada', () => {
  expect(chamadas(gerarMes(mes('2027-06-10')), '2027-06-10')).toEqual([])
  expect(gerarMes(mes('2026-11-27')).some((p) => p.ocasiao?.data === '2026-11-27')).toBe(false)
  expect(gerarMes(mes(null)).some((p) => p.ocasiao?.fase === 'aquecimento')).toBe(false)
})

test('promoção no próprio mês: continua como antes (semana antes e o dia), sem chamadas a mais', () => {
  const posts = gerarMes(mes('2026-12-20'))
  const aquec = chamadas(posts, '2026-12-20')
  expect(aquec.length).toBeLessThanOrEqual(2)
  expect(aquec.every((d) => d >= '2026-12-13')).toBe(true)
})
