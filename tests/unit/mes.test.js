import { rotuloEstrategia, agruparPorDia, sugestaoEstrategia, textoParaCopiar } from '../../app/src/cliente/mes.js'
import { RAMOS } from '../../supabase/functions/_shared/modelos/ramos/index.ts'

test('rótulo da estratégia respeita as regras do ramo', () => {
  expect(rotuloEstrategia('vender', RAMOS.advocacia)).toBe('Atrair contatos')
  expect(rotuloEstrategia('vender', RAMOS.psicologia)).toBe('Atrair contatos')
  expect(rotuloEstrategia('vender', RAMOS.beleza)).toBe('Vender mais')
  expect(rotuloEstrategia('tempo', RAMOS.advocacia)).toBe('Economizar tempo')
})

test('agruparPorDia ordena dias e redes e escreve o dia por extenso curto', () => {
  const p = (data, rede, ordem) => ({ data, rede, ordem, titulo: `${rede}-${ordem}` })
  const dias = agruparPorDia([
    p('2026-12-02', 'whatsapp', 9), p('2026-12-01', 'whatsapp', 3), p('2026-12-01', 'tiktok', 2),
    p('2026-12-01', 'instagram', 1), p('2026-12-01', 'facebook', 0), p('2026-12-01', 'instagram', 0),
  ])
  expect(dias.map((d) => d.titulo)).toEqual(['Ter, 1 de dez', 'Qua, 2 de dez'])
  expect(dias[0].posts.map((x) => x.titulo)).toEqual(['instagram-0', 'instagram-1', 'facebook-0', 'tiktok-2', 'whatsapp-3'])
})

test('sugestão: repete a estratégia do mês anterior; no primeiro mês, economizar tempo', () => {
  expect(sugestaoEstrategia(null)).toBe('tempo')
  expect(sugestaoEstrategia({ estrategia: 'crescer' })).toBe('crescer')
})

test('texto para copiar junta legenda e hashtags', () => {
  expect(textoParaCopiar({ legenda: 'Oi', hashtags: ['#a', '#b'] })).toBe('Oi\n\n#a #b')
  expect(textoParaCopiar({ legenda: 'Oi', hashtags: [] })).toBe('Oi')
})
