import { estadoDoNegocio, resumoDaPergunta, nomesDasRedes, PERGUNTAS_FIXAS, identidadeDoNegocio } from '../../app/src/cliente/perguntas.js'
import { RAMOS } from '../../supabase/functions/_shared/modelos/ramos/index.ts'

const ramo = RAMOS.beleza

test('PERGUNTAS_FIXAS não inclui redes nem o nome (o nome é da administração)', () => {
  expect(PERGUNTAS_FIXAS).toEqual(['marca', 'tom', 'horario', 'cores'])
})

test('estadoDoNegocio sem cadastro usa os padrões do ramo', () => {
  const e = estadoDoNegocio(null, [], ramo)
  expect(e).toMatchObject({ nome: '', insta: '', assinatura: 'ambos', tom: 'proximo', horario: '19:00',
    cor1: ramo.cores.cor1, cor2: ramo.cores.cor2, logo_path: null, itens: [] })
  expect(e).not.toHaveProperty('redes')
})

test('estadoDoNegocio: itens com fotos e foto_path antigo', () => {
  const e = estadoDoNegocio({ nome: 'Ana', insta: '@ana', tom: 'tecnico', horario: '07:00' }, [
    { id: 'a', nome: 'Corte', descricao: null, preco: 49.9, preco_promo: 39.9, fotos: ['x/1.jpg', 'x/2.jpg'] },
    { id: 'b', nome: 'Barba', preco: null, preco_promo: null, foto_path: 'x/b.jpg' },
    { id: 'c', nome: 'Pé', fotos: [] },
  ], ramo)
  expect(e.nome).toBe('Ana')
  expect(e.itens[0]).toEqual({ id: 'a', nome: 'Corte', descricao: '', precoTexto: '49,9', promoTexto: '39,9', promoData: null, ocultarPreco: false, pacote: null,
    fotos: [{ path: 'x/1.jpg' }, { path: 'x/2.jpg' }] })
  expect(e.itens[1].fotos).toEqual([{ path: 'x/b.jpg' }])
  expect(e.itens[2].fotos).toEqual([])
})

test('resumoDaPergunta', () => {
  const e = estadoDoNegocio({ nome: 'Ana', insta: '@ana', tom: 'proximo', horario: '12:00', logo_path: 'u/logo.png' }, [], ramo)
  expect(resumoDaPergunta('marca', e, ramo)).toBe('Logo e @')
  expect(resumoDaPergunta('marca', { ...e, assinatura: 'insta' }, ramo)).toBe('Só o @')
  expect(identidadeDoNegocio(e)).toBe('Ana · @ana · logo')
  expect(identidadeDoNegocio({ ...e, logo_path: null, insta: '' })).toBe('Ana · sem logo')
  expect(resumoDaPergunta('tom', e, ramo)).toBe(ramo.tons.find(([v]) => v === 'proximo')[1])
  expect(resumoDaPergunta('horario', e, ramo)).toBe('Na hora do almoço')
  expect(resumoDaPergunta('cores', e, ramo)).toBe('')
})

test('nomesDasRedes na ordem de REDES', () => {
  expect(nomesDasRedes(['whatsapp', 'instagram'])).toBe('Instagram, WhatsApp')
  expect(nomesDasRedes(['instagram', 'facebook', 'tiktok', 'whatsapp'])).toBe('Instagram, Facebook, TikTok / Reels, WhatsApp')
  expect(nomesDasRedes([])).toBe('')
  expect(nomesDasRedes(undefined)).toBe('')
})

test('estadoDoNegocio lê a caixinha Ocultar preço', () => {
  const e = estadoDoNegocio(null, [{ id: 'a', nome: 'Corte', preco: 50, preco_promo: null, ocultar_preco: true, fotos: [] }], ramo)
  expect(e.itens[0].ocultarPreco).toBe(true)
})

test('estadoDoNegocio lê os detalhes do pacote', () => {
  const pacote = { ativo: true, hotel: 'Serra Azul', transporte: 'onibus' }
  const e = estadoDoNegocio(null, [{ id: 'a', nome: 'Gramado', preco: 50, pacote, fotos: [] }], RAMOS.turismo)
  expect(e.itens[0].pacote).toMatchObject({ ativo: true, hotel: 'Serra Azul', transporte: 'onibus', transfer: false })
  expect(estadoDoNegocio(null, [{ id: 'b', nome: 'Corte', fotos: [] }], ramo).itens[0].pacote).toBe(null)
})

test('estadoDoNegocio e o resumo da marca levam o WhatsApp', () => {
  const e = estadoDoNegocio({ nome: 'Ana', whatsapp: '83999990000' }, [], ramo)
  expect(e.whatsapp).toBe('(83) 99999-0000')
  expect(resumoDaPergunta('marca', e, ramo)).toBe('Logo e @ · (83) 99999-0000')
  expect(estadoDoNegocio(null, [], ramo).whatsapp).toBe('')
})

test('datasDaCaixa: gerando um mês, as datas de promoção daquele mês em diante; sem mês, de hoje em diante', async () => {
  const { datasDaCaixa, faixaDaCaixa } = await import('../../app/src/cliente/perguntas.js')
  const dez = datasDaCaixa(RAMOS.turismo, '2026-11-27', { anoMes: '2026-12', inicio: '2026-12-01' })
  expect(dez.length).toBeGreaterThan(0)
  expect(dez.every((d) => d.data >= '2026-12-01')).toBe(true)
  expect(dez.some((d) => d.data >= '2027-01-01')).toBe(true) // promoções anunciadas com antecedência
  expect(datasDaCaixa(RAMOS.turismo, '2026-11-27').some((d) => d.data === '2026-11-27')).toBe(true)
  expect(datasDaCaixa(RAMOS.psicologia, '2026-11-27', { anoMes: '2026-12', inicio: '2026-12-01' })).toEqual([])
  expect(faixaDaCaixa('2026-11-27', { anoMes: '2026-12', inicio: '2026-12-01' })).toMatchObject({ min: '2026-12-01', max: null, soDaqui: true })
  expect(faixaDaCaixa('2026-11-27')).toEqual({ min: '2026-11-27', max: null })
})
