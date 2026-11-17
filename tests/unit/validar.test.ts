import { validarPost, validarMes } from '../../supabase/functions/_shared/modelos/validar.ts'
import type { PostGerado } from '../../supabase/functions/_shared/modelos/gerar.ts'
import { RAMOS } from '../../supabase/functions/_shared/modelos/ramos/index.ts'

const post = (extra: Partial<PostGerado> = {}): PostGerado => ({
  data: '2026-12-02', rede: 'instagram', tipo: 'feed', formato: 'arte', pilar: 'demo',
  titulo: 'Título', legenda: 'Legenda', hashtags: ['#a'], horario: '19:00', roteiro: null, produto_id: null, ordem: 0,
  preco_de: null, preco_por: null,
  ...extra,
})

test('post correto não tem problemas', () => {
  expect(validarPost(post(), RAMOS.beleza)).toEqual([])
})
test('acusa hashtag no WhatsApp', () => {
  expect(validarPost(post({ rede: 'whatsapp', tipo: 'status', formato: 'texto' }), RAMOS.beleza)).not.toEqual([])
})
test('acusa 6 hashtags no Instagram e 4 no Facebook', () => {
  expect(validarPost(post({ hashtags: ['#a', '#b', '#c', '#d', '#e', '#f'] }), RAMOS.beleza)).not.toEqual([])
  expect(validarPost(post({ rede: 'facebook', hashtags: ['#a', '#b', '#c', '#d'] }), RAMOS.beleza)).not.toEqual([])
})
test('acusa legenda vazia e legenda com 2201 caracteres', () => {
  expect(validarPost(post({ legenda: '  ' }), RAMOS.beleza)).not.toEqual([])
  expect(validarPost(post({ legenda: 'x'.repeat(2201) }), RAMOS.beleza)).not.toEqual([])
  expect(validarPost(post({ legenda: 'x'.repeat(2200) }), RAMOS.beleza)).toEqual([])
})
test('acusa título vazio ou com mais de 90 caracteres', () => {
  expect(validarPost(post({ titulo: '' }), RAMOS.beleza)).not.toEqual([])
  expect(validarPost(post({ titulo: 'x'.repeat(91) }), RAMOS.beleza)).not.toEqual([])
})
test('acusa "desconto" em advocacia, mas não em beleza', () => {
  const p = post({ legenda: 'Desconto especial hoje' })
  expect(validarPost(p, RAMOS.advocacia)).not.toEqual([])
  expect(validarPost(p, RAMOS.beleza)).toEqual([])
})
test('acusa preço no roteiro em psicologia', () => {
  expect(validarPost(post({ roteiro: 'Mostrar o valor: R$ 150' }), RAMOS.psicologia)).not.toEqual([])
})
test('acusa marcador que sobrou no texto', () => {
  expect(validarPost(post({ legenda: 'Conheça {prod}' }), RAMOS.beleza)).not.toEqual([])
  expect(validarPost(post({ titulo: 'undefined' }), RAMOS.beleza)).not.toEqual([])
})
test('validarMes acusa falta de stories', () => {
  const agenda = { feed: ['2026-12-02'], videos: [], status: [], lista: [] }
  const ok = [post(), post({ tipo: 'stories', hashtags: [] }), post({ rede: 'facebook' })]
  expect(validarMes(ok, agenda)).toEqual([])
  expect(validarMes([post(), post({ rede: 'facebook' })], agenda)).not.toEqual([])
})

import { temPromocao } from '../../supabase/functions/_shared/modelos/validar.ts'
test.each([
  ['Psicoterapia 100% online', false], ['Sessões para promover autoconhecimento', false], ['Ofertamos acolhimento', false],
  ['Promoção de inverno', true], ['promoções', true], ['50% off', true], ['Consulta R$ 200', true],
  ['com desconto', true], ['Oferta da semana', true], ['Black Friday', true], ['preço promocional', true],
])('temPromocao(%j) → %s', (s, esperado) => expect(temPromocao(s)).toBe(esperado))
test('"100% online" e "promover" passam em psicologia', () => {
  expect(validarPost(post({ titulo: 'Psicoterapia 100% online', legenda: 'Para promover autoconhecimento.' }), RAMOS.psicologia)).toEqual([])
})

test('validarMes com redes: espera zero posts das redes não escolhidas', () => {
  const agenda = { feed: ['2026-12-02'], videos: ['2026-12-03'], status: [], lista: [] }
  const insta = [post(), post({ tipo: 'stories', hashtags: [] })]
  expect(validarMes(insta, agenda, ['instagram'])).toEqual([])
  expect(validarMes(insta, agenda)).not.toEqual([])
  expect(validarMes([...insta, post({ rede: 'facebook' })], agenda, ['instagram']))
    .toEqual(['facebook/feed: esperado 0, veio 1'])
  expect(validarMes([post()], agenda, ['instagram'])).toEqual(['instagram/stories: esperado 1, veio 0'])
})

describe('preço por tratamento (fora dos ramos noPromo)', () => {
  const promo = { preco_de: 2199, preco_por: 1799 }, vitrine = { preco_de: null, preco_por: 1999 }
  test('promoção pode tudo', () => {
    expect(validarPost(post({ ...promo, titulo: 'Oferta: Gramado', legenda: 'De R$ 2.199,00 por R$ 1.799,00. Promoção!' }), RAMOS.turismo)).toEqual([])
  })
  test('vitrine com R$ passa; com "promoção", "desconto", "off" ou "black friday" não', () => {
    expect(validarPost(post({ ...vitrine, legenda: 'Por R$ 1.999,00.' }), RAMOS.turismo)).toEqual([])
    for (const legenda of ['Por R$ 1.999,00. Promoção!', 'Com desconto', '10% off', 'Black Friday']) {
      expect(validarPost(post({ ...vitrine, legenda }), RAMOS.turismo)).not.toEqual([])
    }
    expect(validarPost(post({ ...vitrine, titulo: 'Promoções de verão' }), RAMOS.turismo)).not.toEqual([])
  })
  test('vitrine pode dizer "oferta" e "promover"', () => {
    expect(validarPost(post({ ...vitrine, legenda: 'Uma oferta da casa para promover o destino. Por R$ 1.999,00.' }), RAMOS.turismo))
      .toEqual([])
  })
  test('post sem preço com R$ → erro', () => {
    expect(validarPost(post({ legenda: 'A partir de R$ 99' }), RAMOS.ferramentas)).not.toEqual([])
    expect(validarPost(post({ roteiro: 'Mostrar R$ 99' }), RAMOS.ferramentas)).not.toEqual([])
  })
  test('post sem preço com "ofertas" → ok', () => {
    expect(validarPost(post({ legenda: 'As respostas viram as próximas ofertas.' }), RAMOS.turismo)).toEqual([])
  })
  test('noPromo recusa até post de preço', () => {
    expect(validarPost(post({ ...vitrine, legenda: 'Por R$ 150,00.' }), RAMOS.psicologia)).not.toEqual([])
  })
})
