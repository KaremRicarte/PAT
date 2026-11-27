import {
  situacaoDoPost, corDoDia, resumoDoMes, diaInicial, gradeDoMes, fotoDoPost, pecasDaArte, proximoEstado,
} from '../../app/src/cliente/situacao.js'
import { RAMOS } from '../../supabase/functions/_shared/modelos/ramos/index.ts'

const post = (estado, extra = {}) => ({ estado, postado_em: null, ...extra })
const postado = post('aprovado', { postado_em: '2026-11-10T12:00:00Z' })
const aprovado = post('aprovado')
const pendente = post('gerado')
const reprovado = post('reprovado')

test('situacaoDoPost: postado vence; reprovado é descartado; gerado/editado são pendentes', () => {
  expect(situacaoDoPost(postado)).toBe('postado')
  expect(situacaoDoPost(post('reprovado', { postado_em: '2026-11-10T12:00:00Z' }))).toBe('postado')
  expect(situacaoDoPost(reprovado)).toBe('reprovado')
  expect(situacaoDoPost(aprovado)).toBe('aprovado')
  expect(situacaoDoPost(pendente)).toBe('pendente')
  expect(situacaoDoPost(post('editado'))).toBe('pendente')
})

test('corDoDia: a cor mais urgente do dia', () => {
  expect(corDoDia([postado, postado])).toBe('postado')
  expect(corDoDia([postado, reprovado])).toBe('postado')
  expect(corDoDia([aprovado, pendente, reprovado])).toBe('pendente')
  expect(corDoDia([aprovado, reprovado])).toBe('reprovado')
  expect(corDoDia([reprovado])).toBe('reprovado')
  expect(corDoDia([aprovado])).toBe('aprovado')
  expect(corDoDia([postado, aprovado])).toBe('aprovado')
  expect(corDoDia([postado, pendente])).toBe('pendente')
  expect(corDoDia([postado, reprovado, aprovado])).toBe('reprovado')
  expect(corDoDia([reprovado, reprovado])).toBe('reprovado')
  expect(corDoDia([])).toBeNull()
})

test('resumoDoMes conta por situação', () => {
  expect(resumoDoMes([postado, aprovado, aprovado, pendente, post('editado'), reprovado]))
    .toEqual({ postado: 1, aprovado: 2, pendente: 2, reprovado: 1 })
  expect(resumoDoMes([])).toEqual({ postado: 0, aprovado: 0, pendente: 0, reprovado: 0 })
})

test('diaInicial: hoje se estiver no mês; senão o primeiro dia com post; senão o dia 1', () => {
  const posts = [{ data: '2026-11-20' }, { data: '2026-11-05' }]
  expect(diaInicial('2026-11', '2026-11-11', posts)).toBe('2026-11-11')
  expect(diaInicial('2026-11', '2026-11-11', [])).toBe('2026-11-11')
  expect(diaInicial('2026-12', '2026-11-25', [{ data: '2026-12-03' }, { data: '2026-12-01' }])).toBe('2026-12-01')
  expect(diaInicial('2026-12', '2026-11-25', [])).toBe('2026-12-01')
})

test('gradeDoMes: semana começa no domingo e o tamanho é múltiplo de 7', () => {
  const nov = gradeDoMes('2026-11')
  expect(nov[0]).toBe('2026-11-01')
  expect(nov).toHaveLength(35)
  expect(nov[29]).toBe('2026-11-30')
  expect(nov.slice(30)).toEqual([null, null, null, null, null])
  const dez = gradeDoMes('2026-12')
  expect(dez.slice(0, 3)).toEqual([null, null, '2026-12-01'])
  expect(dez).toHaveLength(35)
  expect(dez.filter(Boolean)).toHaveLength(31)
})

test('fotoDoPost: sem_foto, foto própria e foto do produto', () => {
  const produtos = [{ id: 'a', foto_path: null }, { id: 'b', foto_path: 'fb.jpg' }, { id: 'c', foto_path: 'fc.jpg' }]
  const loja = RAMOS.beleza
  const texto = RAMOS.advocacia
  expect(fotoDoPost({ sem_foto: true, foto_path: 'x.jpg' }, produtos, texto)).toBeNull()
  expect(fotoDoPost({ sem_foto: true, foto_path: 'x.jpg' }, produtos, loja)).toBe('x.jpg')
  expect(fotoDoPost({ foto_path: 'x.jpg' }, produtos, texto)).toBe('x.jpg')
  expect(fotoDoPost({ foto_path: 'x.jpg', produto_id: 'c' }, produtos, loja)).toBe('x.jpg')
  expect(fotoDoPost({ produto_id: 'c' }, produtos, loja)).toBe('fc.jpg')
  expect(fotoDoPost({}, produtos, texto)).toBeNull()
  expect(fotoDoPost({}, [], loja)).toBeNull()
})

test('fotoDoPost: post de um serviço sem foto nunca pega a foto de outro serviço', () => {
  const produtos = [{ id: 'a', foto_path: null }, { id: 'b', foto_path: 'fb.jpg' }]
  expect(fotoDoPost({ produto_id: 'a', ordem: 0 }, produtos, RAMOS.beleza)).toBeNull()
  expect(fotoDoPost({ produto_id: 'a', ordem: 1 }, produtos, RAMOS.beleza)).toBeNull()
})

test('fotoDoPost: posts gerais revezam as fotos pela ordem do post', () => {
  const produtos = [{ id: 'a', foto_path: 'fa.jpg' }, { id: 'b', foto_path: null }, { id: 'c', foto_path: 'fc.jpg' }, { id: 'd', foto_path: 'fd.jpg' }]
  const fotos = [0, 1, 2, 3, 4].map((ordem) => fotoDoPost({ ordem }, produtos, RAMOS.beleza))
  expect(fotos).toEqual(['fa.jpg', 'fc.jpg', 'fd.jpg', 'fa.jpg', 'fc.jpg'])
  // produto apagado (produto_id sem produto na lista): conta como post geral
  expect(fotoDoPost({ produto_id: 'zz', ordem: 1 }, produtos, RAMOS.beleza)).toBe('fc.jpg')
})

test('fotoDoPost: com uma foto só, os posts gerais alternam foto e só texto', () => {
  const produtos = [{ id: 'a', foto_path: 'fa.jpg' }, { id: 'b', foto_path: null }]
  const fotos = [0, 1, 2, 3].map((ordem) => fotoDoPost({ ordem }, produtos, RAMOS.beleza))
  expect(fotos).toEqual(['fa.jpg', null, 'fa.jpg', null])
})

import { servicosSemFoto } from '../../app/src/cliente/situacao.js'
test('servicosSemFoto: conta os serviços sem foto; nos ramos só de texto a foto é opcional', () => {
  const produtos = [{ foto_path: 'f.jpg' }, { foto_path: null }, {}]
  expect(servicosSemFoto(produtos, RAMOS.beleza)).toBe(2)
  expect(servicosSemFoto(produtos, RAMOS.psicologia)).toBe(0)
  expect(servicosSemFoto([], RAMOS.beleza)).toBe(0)
})

test('pecasDaArte: legenda de 5 parágrafos', () => {
  const p = { titulo: 'T', legenda: 'g\n\nm\n\nx\n\nconv\n\nfim' }
  const n = { nome: 'Loja da Ana', insta: '@ana', assinatura: 'ambos' }
  expect(pecasDaArte(p, n, RAMOS.beleza)).toEqual({
    rotulo: 'LOJA DA ANA', titulo: 'T', gancho: 'g', meio: 'm', convite: 'conv',
    blocos: { gancho: 'g', meios: ['m', 'x', 'conv'], convite: 'fim' },
    ocasiao: null,
    enquete: false,
    preco: null, assinatura: { texto: '@ana', logo: true },
  })
})

test('pecasDaArte: preço do selo', () => {
  const n = { nome: 'Ana', insta: '@ana', assinatura: 'insta' }
  expect(pecasDaArte({ titulo: 'T', preco_de: 2199, preco_por: 1799 }, n, RAMOS.beleza).preco).toEqual({ de: 'R$ 2.199', por: 'R$ 1.799' })
  expect(pecasDaArte({ titulo: 'T', preco_de: null, preco_por: 1999.9 }, n, RAMOS.beleza).preco).toEqual({ de: null, por: 'R$ 1.999,90' })
  expect(pecasDaArte({ titulo: 'T', preco_por: null }, n, RAMOS.beleza).preco).toBeNull()
  expect(pecasDaArte({ titulo: 'T', preco_de: 2199, preco_por: 1799 }, n, RAMOS.psicologia).preco).toBeNull()
  expect(pecasDaArte({ titulo: 'T', preco_por: 1799 }, n, RAMOS.advocacia).preco).toBeNull()
})

test('pecasDaArte: 3 parágrafos usam o último como convite; 2 parágrafos não têm meio', () => {
  const n = { nome: 'Ana', insta: '@ana', assinatura: 'insta' }
  const tres = pecasDaArte({ titulo: 'T', legenda: 'g\n\nm\n\nc' }, n, RAMOS.beleza)
  expect([tres.gancho, tres.meio, tres.convite]).toEqual(['g', 'm', 'c'])
  expect(tres.assinatura).toEqual({ texto: '@ana', logo: false })
  const dois = pecasDaArte({ titulo: 'T', legenda: 'g\n\nc' }, n, RAMOS.beleza)
  expect([dois.gancho, dois.meio, dois.convite]).toEqual(['g', '', 'c'])
})

test('pecasDaArte: assinatura logo e sem insta', () => {
  const p = { titulo: 'T', legenda: 'g\n\nm\n\nc' }
  expect(pecasDaArte(p, { nome: 'a', insta: '@a', assinatura: 'logo' }, RAMOS.beleza).assinatura)
    .toEqual({ texto: null, logo: true })
  expect(pecasDaArte(p, { nome: 'a', insta: '', assinatura: 'ambos' }, RAMOS.beleza).assinatura)
    .toEqual({ texto: null, logo: true })
  expect(pecasDaArte(p, { nome: 'a', insta: null, assinatura: 'insta' }, RAMOS.beleza).assinatura)
    .toEqual({ texto: null, logo: false })
})

test('proximoEstado: as 6 ações', () => {
  expect(proximoEstado({}, 'aprovar')).toEqual({ estado: 'aprovado' })
  expect(proximoEstado({}, 'desaprovar')).toEqual({ estado: 'gerado' })
  expect(proximoEstado({}, 'desfazer')).toEqual({ estado: 'gerado' })
  expect(proximoEstado({}, 'descartar')).toEqual({ estado: 'reprovado' })
  expect(proximoEstado({}, 'despostar')).toEqual({ postado_em: null })
  const r = proximoEstado({}, 'postei')
  expect(r.estado).toBe('aprovado')
  expect(new Date(r.postado_em).toISOString()).toBe(r.postado_em)
})

import { fotoDoPost as fotoDoPostN, fotosDoPost } from '../../app/src/cliente/situacao.js'

describe('fotos do item', () => {
  const prods = [
    { id: 'x', fotos: ['a', 'b', 'c'], foto_path: 'a' },
    { id: 'y', fotos: ['d'], foto_path: 'd' },
  ]
  const semFotos = { id: 'z', fotos: [], foto_path: null }
  test('post de item reveza as fotos dele', () => {
    const r = [0, 1, 2, 3].map((ordem) => fotoDoPostN({ produto_id: 'x', ordem }, prods, RAMOS.beleza))
    expect(r).toEqual(['a', 'b', 'c', 'a'])
    expect(fotoDoPostN({ produto_id: 'z', ordem: 0 }, [semFotos], RAMOS.beleza)).toBeNull()
  })
  test('post geral reveza todas as fotos', () => {
    const r = [0, 1, 2, 3, 4].map((ordem) => fotoDoPostN({ produto_id: null, ordem }, prods, RAMOS.beleza))
    expect(r).toEqual(['a', 'b', 'c', 'd', 'a'])
  })
  test('fotosDoPost devolve até 4 fotos do item começando pela da vez', () => {
    const p = [{ id: 'x', fotos: ['a', 'b', 'c', 'd', 'e'] }]
    expect(fotosDoPost({ produto_id: 'x', ordem: 2 }, p, RAMOS.beleza)).toEqual(['c', 'd', 'e', 'a'])
    expect(fotosDoPost({ produto_id: null, ordem: 1 }, prods, RAMOS.beleza)).toEqual(['b'])
    expect(fotosDoPost({ produto_id: 'z', ordem: 0 }, [semFotos], RAMOS.beleza)).toEqual([])
  })
  test('servicosSemFoto usa fotos', () => {
    expect(servicosSemFoto([...prods, semFotos], RAMOS.beleza)).toBe(1)
  })
})

describe('fotos reprovadas pela análise', () => {
  const info = new Map([['x.jpg', { serve: false, motivo: 'escura' }]])
  const ramo = { textOnly: false }
  test('servicosSemFoto: item só com foto reprovada conta como sem foto', async () => {
    const { servicosSemFoto } = await import('../../app/src/cliente/situacao.js')
    const produtos = [{ id: 1, fotos: ['x.jpg'] }, { id: 2, fotos: ['y.jpg'] }]
    expect(servicosSemFoto(produtos, ramo)).toBe(0)
    expect(servicosSemFoto(produtos, ramo, info)).toBe(1)
  })
  test('fotoDoPost ignora foto reprovada, menos a escolhida pelo cliente', () => {
    const produtos = [{ id: 1, fotos: ['x.jpg', 'y.jpg'] }]
    const post = { produto_id: 1, ordem: 0 }
    expect(fotoDoPost(post, produtos, { textOnly: false })).toBe('x.jpg')
    expect(fotoDoPost(post, produtos, { textOnly: false }, info)).toBe('y.jpg')
    // a foto que o cliente escolheu para o post vale mesmo reprovada (o aviso aparece em Meu negócio)
    expect(fotoDoPost({ foto_path: 'x.jpg' }, produtos, { textOnly: false }, info)).toBe('x.jpg')
    expect(fotoDoPost({ foto_path: 'x.jpg', produto_id: 1, ordem: 0 }, produtos, { textOnly: false }, info)).toBe('x.jpg')
  })
})

test('pecasDaArte: story em enquete mostra a pergunta e chama para o adesivo', () => {
  const post = { tipo: 'stories', titulo: 'Você já conhece Gramado no Natal?', legenda: 'Você já conhece Gramado no Natal?\n\nEnquete: Já conheço / Quero conhecer' }
  const p = pecasDaArte(post, { nome: 'Malibu' }, { noPromo: false })
  expect(p).toMatchObject({ titulo: 'Você já conhece Gramado no Natal?', gancho: 'Vote na enquete aqui embaixo', enquete: true })
})

test('fotoDoPost: mesmo item, mesma ordem, meses diferentes -> fotos diferentes', () => {
  const produtos = [{ id: 's1', fotos: ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'] }]
  const loja = RAMOS.loja ?? Object.values(RAMOS).find((r) => !r.textOnly)
  const nov = fotoDoPostN({ produto_id: 's1', ordem: 2, data: '2026-11-20' }, produtos, loja)
  const dez = fotoDoPostN({ produto_id: 's1', ordem: 2, data: '2026-12-20' }, produtos, loja)
  expect(nov).not.toBe(dez)
})

describe('pecasDaArte: arte do pacote no estilo agência (Turismo)', () => {
  const PACOTE = { ativo: true, hotel: 'Serra Azul', ida: '2026-12-12', volta: '2026-12-17', transporte: 'aviao', transfer: true,
    refeicoes: { cafe: true, almoco: false, jantar: false }, preco_por: 'pessoa', parcelas: 10, taxas: true, pix: 5 }
  const n = { nome: 'Malibu', insta: '@malibu', assinatura: 'insta', whatsapp: '83999990000' }
  const produtos = [{ id: 'g', nome: 'Gramado', pacote: PACOTE, ocultar_preco: false }]
  const comPreco = { titulo: 'T', produto_id: 'g', pilar: 'demo', preco_de: 2800, preco_por: 2390 }

  test('com preço: nome, dias, ícones, linha, total, quadro de parcelas, Pix e WhatsApp', () => {
    const p = pecasDaArte(comPreco, n, RAMOS.turismo, produtos).pacote
    expect(p).toEqual({
      nome: 'Gramado', chamada: 'PACOTE EXCLUSIVO', dias: '6 dias', icones: ['aviao', 'hotel', 'transfer', 'refeicao'],
      linha: 'Serra Azul · 12/12 a 17/12 · Café da manhã',
      de: 'R$ 2.800', total: 'Total por pessoa: R$ 2.390 · taxas inclusas',
      caixa: { topo: 'A PARTIR DE', meio: '10X', valor: 'R$ 239' },
      pix: '5% OFF À VISTA NO PIX', contato: null, whatsapp: '(83) 99999-0000',
    })
  })
  test('sem parcelas: o quadro mostra o valor; sem unidade: "Por"', () => {
    const p = pecasDaArte({ ...comPreco, preco_de: null }, n, RAMOS.turismo, [{ ...produtos[0], pacote: { ...PACOTE, parcelas: null, preco_por: null, taxas: false } }]).pacote
    expect(p.caixa).toEqual({ topo: 'A PARTIR DE', meio: null, valor: 'R$ 2.390' })
    expect(p.total).toBe('Por R$ 2.390')
    expect(p.de).toBe(null)
  })
  test('pacote só com o preço (sem detalhes): sem dias, sem ícones, sem linha', () => {
    const p = pecasDaArte(comPreco, n, RAMOS.turismo, [{ ...produtos[0], pacote: { ativo: true } }]).pacote
    expect([p.dias, p.icones, p.linha]).toEqual([null, [], null])
    expect(p.nome).toBe('Gramado')
  })
  test('bate-volta', () => {
    const p = pecasDaArte(comPreco, n, RAMOS.turismo, [{ ...produtos[0], pacote: { ...PACOTE, volta: '2026-12-12' } }]).pacote
    expect(p.dias).toBe('Bate-volta')
  })
  test('"Entrar em contato": sem total, quadro nem Pix; com a frase de contato (posts que mostram o pacote)', () => {
    const p = pecasDaArte({ ...comPreco, preco_de: null, preco_por: null }, n, RAMOS.turismo, [{ ...produtos[0], ocultar_preco: true }]).pacote
    expect([p.total, p.caixa, p.pix, p.de]).toEqual([null, null, null, null])
    expect(p.contato).toBe('Condições especiais: fale com a loja')
    expect(pecasDaArte({ ...comPreco, pilar: 'need', preco_por: null }, n, RAMOS.turismo, [{ ...produtos[0], ocultar_preco: true }])).not.toHaveProperty('pacote')
  })
  test('outro ramo, pacote desmarcado ou post sem preço (mostrar o preço): sem arte de pacote', () => {
    expect(pecasDaArte(comPreco, n, RAMOS.beleza, produtos)).not.toHaveProperty('pacote')
    expect(pecasDaArte(comPreco, n, RAMOS.turismo, [{ ...produtos[0], pacote: { ...PACOTE, ativo: false } }])).not.toHaveProperty('pacote')
    expect(pecasDaArte({ ...comPreco, preco_de: null, preco_por: null }, n, RAMOS.turismo, produtos)).not.toHaveProperty('pacote')
  })
  test('sem WhatsApp: sem o botão', () => {
    expect(pecasDaArte(comPreco, { ...n, whatsapp: null }, RAMOS.turismo, produtos).pacote.whatsapp).toBe(null)
  })
})


