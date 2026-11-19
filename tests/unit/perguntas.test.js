import { estadoDoNegocio, resumoDaPergunta, nomesDasRedes, PERGUNTAS_FIXAS } from '../../app/src/cliente/perguntas.js'
import { RAMOS } from '../../supabase/functions/_shared/modelos/ramos/index.ts'

const ramo = RAMOS.beleza

test('PERGUNTAS_FIXAS não inclui redes', () => {
  expect(PERGUNTAS_FIXAS).toEqual(['nome', 'marca', 'tom', 'horario', 'cores'])
})

test('estadoDoNegocio sem cadastro usa os padrões do ramo', () => {
  const e = estadoDoNegocio(null, [], ramo)
  expect(e).toMatchObject({ nome: '', insta: '', assinatura: 'ambos', tom: 'proximo', horario: '19:00',
    cor1: ramo.cores.cor1, cor2: ramo.cores.cor2, logo_path: null, logoBlob: null, itens: [] })
  expect(e).not.toHaveProperty('redes')
})

test('estadoDoNegocio: itens com fotos e foto_path antigo', () => {
  const e = estadoDoNegocio({ nome: 'Ana', insta: '@ana', tom: 'tecnico', horario: '07:00' }, [
    { id: 'a', nome: 'Corte', descricao: null, preco: 49.9, preco_promo: 39.9, fotos: ['x/1.jpg', 'x/2.jpg'] },
    { id: 'b', nome: 'Barba', preco: null, preco_promo: null, foto_path: 'x/b.jpg' },
    { id: 'c', nome: 'Pé', fotos: [] },
  ], ramo)
  expect(e.nome).toBe('Ana')
  expect(e.itens[0]).toEqual({ id: 'a', nome: 'Corte', descricao: '', precoTexto: '49,9', promoTexto: '39,9', promoData: null,
    fotos: [{ path: 'x/1.jpg' }, { path: 'x/2.jpg' }] })
  expect(e.itens[1].fotos).toEqual([{ path: 'x/b.jpg' }])
  expect(e.itens[2].fotos).toEqual([])
})

test('resumoDaPergunta', () => {
  const e = estadoDoNegocio({ nome: 'Ana', insta: '@ana', tom: 'proximo', horario: '12:00', logo_path: 'u/logo.png' }, [], ramo)
  expect(resumoDaPergunta('nome', e, ramo)).toBe('Ana')
  expect(resumoDaPergunta('marca', e, ramo)).toBe('logo · @ana')
  expect(resumoDaPergunta('marca', { ...e, logo_path: null, insta: '' }, ramo)).toBe('sem logo')
  expect(resumoDaPergunta('marca', { ...e, logo_path: null }, ramo)).toBe('@ana')
  expect(resumoDaPergunta('marca', { ...e, insta: null }, ramo)).toBe('logo')
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
