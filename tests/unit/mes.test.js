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

describe('linha do WhatsApp na legenda (pacote do Turismo)', async () => {
  const { linhaDoWhatsApp } = await import('../../app/src/cliente/mes.js')
  const { RAMOS } = await import('../../supabase/functions/_shared/modelos/ramos/index.ts')
  const negocio = { nome: 'Malibu', whatsapp: '83999990000' }
  const produtos = [{ id: 'g', nome: 'Gramado', pacote: { ativo: true, hotel: 'Serra Azul' } }]
  const ctx = { negocio, produtos, ramo: RAMOS.turismo }
  const post = (rede) => ({ rede, produto_id: 'g', legenda: 'Oi', hashtags: ['#a'] })

  test('Instagram e TikTok: o número escrito', () => {
    expect(linhaDoWhatsApp(post('instagram'), ctx)).toBe('Chame no WhatsApp (83) 99999-0000')
    expect(linhaDoWhatsApp(post('tiktok'), ctx)).toBe('Chame no WhatsApp (83) 99999-0000')
  })
  test('Facebook e WhatsApp: o link com a mensagem pronta', () => {
    expect(linhaDoWhatsApp(post('facebook'), ctx)).toBe(`Chame no WhatsApp: https://wa.me/5583999990000?text=${encodeURIComponent('Olá! Vi o pacote Gramado e quero saber mais.')}`)
    expect(linhaDoWhatsApp(post('whatsapp'), ctx)).toContain('https://wa.me/5583999990000?text=')
  })
  test('sem WhatsApp, sem pacote ativo, post sem item ou outro ramo: nada', () => {
    expect(linhaDoWhatsApp(post('instagram'), { ...ctx, negocio: { nome: 'Malibu', whatsapp: null } })).toBe(null)
    expect(linhaDoWhatsApp(post('instagram'), { ...ctx, produtos: [{ id: 'g', nome: 'Gramado', pacote: { ativo: false } }] })).toBe(null)
    expect(linhaDoWhatsApp({ ...post('instagram'), produto_id: null }, ctx)).toBe(null)
    expect(linhaDoWhatsApp(post('instagram'), { ...ctx, ramo: RAMOS.beleza })).toBe(null)
  })
  test('textoParaCopiar: a linha entra depois da legenda e antes das hashtags; sem contexto, igual a antes', () => {
    expect(textoParaCopiar(post('instagram'), ctx)).toBe('Oi\n\nChame no WhatsApp (83) 99999-0000\n\n#a')
    expect(textoParaCopiar(post('instagram'))).toBe('Oi\n\n#a')
  })
})
