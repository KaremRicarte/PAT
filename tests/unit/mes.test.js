import { rotuloEstrategia, sugestaoEstrategia, textoParaCopiar } from '../../app/src/cliente/mes.js'
import { RAMOS } from '../../supabase/functions/_shared/modelos/ramos/index.ts'

test('rótulo da estratégia respeita as regras do ramo', () => {
  expect(rotuloEstrategia('vender', RAMOS.advocacia)).toBe('Atrair contatos')
  expect(rotuloEstrategia('vender', RAMOS.psicologia)).toBe('Atrair contatos')
  expect(rotuloEstrategia('vender', RAMOS.beleza)).toBe('Vender mais')
  expect(rotuloEstrategia('tempo', RAMOS.advocacia)).toBe('Economizar tempo')
})

test('sugestão: repete a estratégia do mês anterior; no primeiro mês, economizar tempo', () => {
  expect(sugestaoEstrategia(null)).toBe('tempo')
  expect(sugestaoEstrategia({ estrategia: 'crescer' })).toBe('crescer')
})

test('texto para copiar junta legenda e hashtags', () => {
  expect(textoParaCopiar({ legenda: 'Oi', hashtags: ['#a', '#b'] })).toBe('Oi\n\n#a #b')
  expect(textoParaCopiar({ legenda: 'Oi', hashtags: [] })).toBe('Oi')
})

import { escolherMes } from '../../app/src/cliente/mes.js'
test('escolherMes: o recém-gerado tem preferência; senão o de hoje; senão o mais recente', () => {
  const meses = [{ ano_mes: '2026-12' }, { ano_mes: '2026-11' }]
  expect(escolherMes(meses, '2026-11-25', null).ano_mes).toBe('2026-11')
  expect(escolherMes(meses, '2026-11-25', '2026-12').ano_mes).toBe('2026-12')
  expect(escolherMes(meses, '2026-11-25', '2025-01').ano_mes).toBe('2026-11')
  expect(escolherMes([{ ano_mes: '2026-12' }], '2026-11-25', null).ano_mes).toBe('2026-12')
})

import { REDES, sugestaoRedes, alternarTodas } from '../../app/src/cliente/mes.js'
import { t } from '../../app/src/textos.js'
test('redes do quiz: as do mês anterior; no primeiro mês, todas', () => {
  expect(REDES).toEqual(['instagram', 'facebook', 'tiktok', 'whatsapp'])
  expect(sugestaoRedes(null)).toEqual(REDES)
  expect(sugestaoRedes({ redes: null })).toEqual(REDES)
  expect(sugestaoRedes({ redes: ['whatsapp', 'tiktok'] })).toEqual(['tiktok', 'whatsapp'])
})
test('"Todas" marca as 4; se as 4 já estão marcadas, desmarca todas', () => {
  expect(alternarTodas(['tiktok'])).toEqual(REDES)
  expect(alternarTodas([])).toEqual(REDES)
  expect(alternarTodas(REDES)).toEqual([])
})
test('textos da pergunta das redes', () => {
  expect(t('mesq.redes.titulo')).toBe('Onde você vai postar?')
  expect(REDES.map((r) => t(`mesq.redes.${r}`)))
    .toEqual(['Instagram (feed e Stories)', 'Facebook', 'TikTok / Reels', 'WhatsApp (Status e lista)'])
  expect(t('mesq.redes.todas')).toBe('Todas')
  expect(t('mesq.redes.erro')).toBe('Marque pelo menos uma rede.')
})
