import { validarPost, validarMes } from '../../supabase/functions/_shared/modelos/validar.ts'
import type { PostGerado } from '../../supabase/functions/_shared/modelos/gerar.ts'
import { RAMOS } from '../../supabase/functions/_shared/modelos/ramos/index.ts'

const post = (extra: Partial<PostGerado> = {}): PostGerado => ({
  data: '2026-12-02', rede: 'instagram', tipo: 'feed', formato: 'arte', pilar: 'demo',
  titulo: 'Título', legenda: 'Legenda', hashtags: ['#a'], horario: '19:00', roteiro: null, produto_id: null, ordem: 0,
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
