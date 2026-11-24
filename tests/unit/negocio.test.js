import { vi } from 'vitest'
vi.mock('../../app/src/artes/imagens.js', () => ({ esquecerImagem: vi.fn() }))
import { esquecerImagem } from '../../app/src/artes/imagens.js'
import { medidaReduzida, validarItens, precoDoTexto, normalizarInsta } from '../../app/src/cliente/negocio.js'

test.each([
  [4000, 3000, 1600, { largura: 1600, altura: 1200 }],
  [800, 600, 1600, { largura: 800, altura: 600 }],
  [1000, 3000, 1600, { largura: 533, altura: 1600 }],
  [1600, 1600, 1600, { largura: 1600, altura: 1600 }],
])('medidaReduzida(%i, %i, %i)', (l, a, max, esperado) => {
  expect(medidaReduzida(l, a, max)).toEqual(esperado)
})

const item = (nome, preco = null) => ({ nome, preco })
test('validarItens', () => {
  expect(validarItens([])).toBe('quiz.itens.min')
  expect(validarItens(Array.from({ length: 21 }, (_, i) => item(`Item ${i}`)))).toBe('quiz.itens.max')
  expect(validarItens([item(' a ')])).toBe('quiz.itens.nome')
  expect(validarItens([item('x'.repeat(81))])).toBe('quiz.itens.nome')
  expect(validarItens([item('Furadeira'), item('  Trena  ')])).toBeNull()
  expect(validarItens(Array.from({ length: 20 }, (_, i) => item(`Item ${i}`)))).toBeNull()
})

test.each([
  ['299,90', 299.9], ['R$ 1.299,90', 1299.9], ['50', 50], ['  80,5 ', 80.5], ['1299.90', 1299.9],
  ['2.199', 2199], ['10.299', 10299], ['1.500', 1500], ['1.234.567', 1234567], ['1.5', 1.5], ['1.50', 1.5], ['2.199,90', 2199.9],
  ['', null], ['   ', null], ['abc', null], ['0', null], ['-10', null],
])('precoDoTexto(%j) → %s', (s, esperado) => {
  expect(precoDoTexto(s)).toBe(esperado)
})

test.each([
  ['', null], ['  ', null], ['loja', '@loja'], ['@loja.da_ana', '@loja.da_ana'], [' @Loja ', '@Loja'],
  ['loja da ana', undefined], ['@' + 'a'.repeat(31), undefined],
])('normalizarInsta(%j) → %s', (s, esperado) => {
  expect(normalizarInsta(s)).toBe(esperado)
})

test('em ramo sem promoção, item com preço ou promoção no texto é recusado no quiz', () => {
  expect(validarItens([{ nome: 'Consulta R$ 200', descricao: '' }], { noPromo: true })).toBe('quiz.itens.promo')
  expect(validarItens([{ nome: 'Consulta', descricao: 'com desconto' }], { noPromo: true })).toBe('quiz.itens.promo')
  expect(validarItens([{ nome: 'Psicoterapia 100% online', descricao: 'promover bem-estar' }], { noPromo: true })).toBeNull()
  expect(validarItens([{ nome: 'Corte com desconto', descricao: '' }], { noPromo: false })).toBeNull()
})

test('validarItens: promoção e fotos', () => {
  const ok = { nome: 'Corte', precoTexto: '100', promoTexto: '80', fotos: [] }
  expect(validarItens([ok])).toBeNull()
  expect(validarItens([{ ...ok, precoTexto: '' }])).toBe('quiz.itens.semnormal')
  expect(validarItens([{ ...ok, promoTexto: '120' }])).toBe('quiz.itens.promomaior')
  expect(validarItens([{ ...ok, promoTexto: '100' }])).toBeNull()
  expect(validarItens([{ ...ok, precoTexto: 'abc' }])).toBe('quiz.itens.precoinvalido')
  expect(validarItens([{ ...ok, promoTexto: '8x' }])).toBe('quiz.itens.precoinvalido')
  expect(validarItens([{ ...ok, precoTexto: 'abc' }], { noPromo: true })).toBeNull()
  expect(validarItens([{ ...ok, fotos: Array.from({ length: 13 }, (_, i) => ({ path: `p${i}` })) }])).toBe('quiz.itens.fotos')
  expect(validarItens([{ ...ok, fotos: Array.from({ length: 12 }, (_, i) => ({ path: `p${i}` })) }])).toBeNull()
  expect(validarItens([{ ...ok, precoTexto: '', promoTexto: '80' }], { noPromo: true })).toBeNull()
})

test('toda chave que validarItens devolve existe em textos', async () => {
  const { t } = await import('../../app/src/textos.js')
  const ok = { nome: 'Corte', precoTexto: '100', promoTexto: '80', fotos: [] }
  const casos = [
    [[]], [Array.from({ length: 21 }, () => ok)], [[{ ...ok, nome: 'a' }]],
    [[{ ...ok, nome: 'Corte R$ 10' }], { noPromo: true }],
    [[{ ...ok, precoTexto: '' }]], [[{ ...ok, promoTexto: '200' }]], [[{ ...ok, precoTexto: 'abc' }]],
    [[{ ...ok, fotos: Array(13).fill({ path: 'x' }) }]],
  ]
  for (const [itens, ramo] of casos) {
    const k = validarItens(itens, ramo)
    expect(k).not.toBeNull()
    expect(() => t(k, { max: 20 })).not.toThrow()
  }
})

test('salvarNegocio: se o 2º envio falha, remove o 1º já enviado e repassa o erro', async () => {
  const { salvarNegocio } = await import('../../app/src/cliente/negocio.js')
  const enviados = [], removidos = []
  let n = 0
  const consulta = (data) => {
    const q = { select: () => q, eq: () => q, not: () => q, update: () => ({ eq: () => ({ select: async () => ({ data: [{ cliente_id: 'u1' }], error: null }) }) }),
      then: (ok) => ok({ data, error: null }) }
    return q
  }
  const supabase = {
    from: () => consulta([]),
    storage: { from: () => ({
      upload: async (c) => { if (++n === 2) return { error: new Error('falhou') }; enviados.push(c); return { error: null } },
      remove: async (l) => { removidos.push(...l); return { error: null } },
    }) },
  }
  const dados = { nome: 'X', insta: null, assinatura: 'ambos', tom: 'proximo', horario: '12:00', cor1: '#000000', cor2: '#ffffff', logo_path: null }
  const itens = [{ id: 'i1', nome: 'Item', descricao: '', preco: 10, preco_promo: null,
    fotos: [{ arquivo: 'a' }, { arquivo: 'b' }] }]
  await expect(salvarNegocio(supabase, 'u1', dados, itens, undefined, { reduzir: async (b) => b })).rejects.toThrow('falhou')
  expect(enviados).toHaveLength(1)
  expect(removidos).toEqual(enviados)
})

test('salvarNegocio: se a leitura dos posts falha, não limpa o Storage e salva mesmo assim', async () => {
  const { salvarNegocio } = await import('../../app/src/cliente/negocio.js')
  const removidos = []
  const consulta = (tabela) => {
    const q = { select: () => q, eq: () => q, not: () => q, delete: () => q, in: () => q,
      upsert: async () => ({ error: null }),
      update: () => ({ eq: () => ({ select: async () => ({ data: [{ cliente_id: 'u1' }], error: null }) }) }),
      then: (ok) => ok(tabela === 'posts' ? { data: null, error: new Error('posts falhou') }
        : tabela === 'produtos' ? { data: [{ id: 'i1', foto_path: 'u1/produtos/i1/a.jpg', fotos: ['u1/produtos/i1/a.jpg'] },
          { id: 'i2', foto_path: null, fotos: [] }], error: null }
        : { data: [], error: null }) }
    return q
  }
  const supabase = {
    from: consulta,
    storage: { from: () => ({ upload: async () => ({ error: null }), remove: async (l) => { removidos.push(...l); return { error: null } } }) },
  }
  const dados = { nome: 'X', insta: null, assinatura: 'ambos', tom: 'proximo', horario: '12:00', cor1: '#000000', cor2: '#ffffff', logo_path: null }
  const itens = [{ id: 'i1', nome: 'Item', descricao: '', preco: 10, preco_promo: null, fotos: [] }]
  const log = vi.spyOn(console, 'error').mockImplementation(() => {})
  await expect(salvarNegocio(supabase, 'u1', dados, itens)).resolves.toBeUndefined()
  expect(removidos).toEqual([])
  expect(log).toHaveBeenCalled()
  log.mockRestore()
})

function fakeSimples(tabelas, achou = true) {
  const q = (tabela) => {
    const o = { select: () => o, eq: () => o, not: () => o, delete: () => o, in: () => o,
      upsert: async (v) => { tabelas.push([tabela, v]); return { error: null } },
      update: (v) => { tabelas.push([tabela, v]); return { eq: () => ({ select: async () => ({ data: achou ? [{ cliente_id: 'u1' }] : [], error: null }) }) } },
      then: (ok) => ok({ data: [], error: null }) }
    return o
  }
  return { from: (tabela) => { tabelas.push([tabela]); return q(tabela) },
    storage: { from: () => ({ upload: async () => ({ error: null }), remove: async () => ({ error: null }) }) } }
}

test('salvarDadosNegocio grava só as escolhas do cliente: sem nome, Instagram, logo nem redes', async () => {
  const { salvarDadosNegocio } = await import('../../app/src/cliente/negocio.js')
  const chamadas = []
  const dados = { nome: 'Outra Empresa', insta: '@outra', assinatura: 'ambos', tom: 'proximo', horario: '12:00', cor1: '#000000', cor2: '#ffffff', logo_path: 'u1/x.png', logoBlob: 'b' }
  await salvarDadosNegocio(fakeSimples(chamadas), 'u1', dados)
  expect(chamadas.filter(([t]) => t === 'produtos')).toEqual([])
  const gravado = chamadas.find(([t, v]) => t === 'negocios' && v)[1]
  expect(gravado).toMatchObject({ assinatura: 'ambos', tom: 'proximo', horario: '12:00', cor1: '#000000', cor2: '#ffffff', pronto: true })
  for (const c of ['nome', 'insta', 'logo_path', 'redes', 'cliente_id']) expect(gravado).not.toHaveProperty(c)
})

test('salvarDadosNegocio falha se o negócio ainda não foi criado pela administração', async () => {
  const { salvarDadosNegocio } = await import('../../app/src/cliente/negocio.js')
  const dados = { assinatura: 'ambos', tom: 'proximo', horario: '12:00', cor1: '#000000', cor2: '#ffffff' }
  await expect(salvarDadosNegocio(fakeSimples([], false), 'u1', dados)).rejects.toThrow()
})

test('salvarItens não toca em negocios', async () => {
  const { salvarItens } = await import('../../app/src/cliente/negocio.js')
  const chamadas = []
  await salvarItens(fakeSimples(chamadas), 'u1', [{ id: 'i1', nome: 'Item', descricao: '', preco: 10, preco_promo: null, fotos: [] }])
  expect(chamadas.filter(([t]) => t === 'negocios')).toEqual([])
  expect(chamadas.find(([t, v]) => t === 'produtos' && v)[1][0]).toMatchObject({ id: 'i1', nome: 'Item', ordem: 0 })
})

import { itensParaSalvar } from '../../app/src/cliente/negocio.js'
test('itensParaSalvar: converte preços do texto; promo só com preço; ramos noPromo sem preço', () => {
  const itens = [{ id: 'a', nome: 'Corte', descricao: 'd', precoTexto: '50', promoTexto: '40', fotos: [] },
    { id: 'b', nome: 'X', descricao: '', precoTexto: '', promoTexto: '30', fotos: [] }]
  const [a, b] = itensParaSalvar(itens, { noPromo: false })
  expect(a).toEqual({ id: 'a', nome: 'Corte', descricao: 'd', preco: 50, preco_promo: 40, promo_data: null, fotos: [] })
  expect(b.preco).toBeNull()
  expect(b.preco_promo).toBeNull()
  const [c] = itensParaSalvar(itens, { noPromo: true })
  expect(c.preco).toBeNull()
  expect(c.preco_promo).toBeNull()
})

function fakeFotos({ antigas = [], posts = [], falhaUpdate = false } = {}) {
  const reg = { enviados: [], removidos: [], gravado: null, iaApagada: [], invocado: null }
  const q = (tabela) => {
    const o = { select: () => o, eq: () => o, not: () => o, delete: () => o, in: (_c, l) => { if (tabela === 'fotos_ia') reg.iaApagada.push(...l); return o },
      maybeSingle: async () => ({ data: { fotos: antigas }, error: null }),
      update: (v) => { reg.gravado = v; return { eq: async () => ({ error: falhaUpdate ? new Error('x') : null }) } },
      then: (ok) => ok({ data: tabela === 'posts' ? posts.map((foto_path) => ({ foto_path })) : [], error: null }) }
    return o
  }
  return { reg, from: q,
    storage: { from: () => ({ upload: async (c) => { reg.enviados.push(c); return { error: null } }, remove: async (l) => { reg.removidos.push(...l); return { error: null } } }) },
    functions: { invoke: async (_n, o) => { reg.invocado = o.body.paths } } }
}

test('salvarFotosDoNegocio: envia novas, grava caminhos, remove as tiradas (menos as usadas por posts)', async () => {
  const { salvarFotosDoNegocio } = await import('../../app/src/cliente/negocio.js')
  const sb = fakeFotos({ antigas: ['u1/negocio/a.jpg', 'u1/negocio/b.jpg', 'u1/negocio/c.jpg'], posts: ['u1/negocio/c.jpg'] })
  const prog = []
  await salvarFotosDoNegocio(sb, 'u1', [{ path: 'u1/negocio/a.jpg' }, { arquivo: 'f', nome: 'f.jpg' }], (a, b) => prog.push([a, b]), { reduzir: async () => 'blob' })
  expect(sb.reg.enviados).toHaveLength(1)
  expect(sb.reg.enviados[0]).toMatch(/^u1\/negocio\/.+\.jpg$/)
  expect(sb.reg.gravado.fotos).toEqual(['u1/negocio/a.jpg', sb.reg.enviados[0]])
  expect(sb.reg.removidos).toEqual(['u1/negocio/b.jpg'])
  expect(sb.reg.iaApagada).toEqual(['u1/negocio/b.jpg'])
  expect(sb.reg.invocado).toEqual(sb.reg.gravado.fotos)
  expect(prog).toEqual([[1, 1]])
})

test('salvarFotosDoNegocio: desfaz os envios se a gravação falha', async () => {
  const { salvarFotosDoNegocio } = await import('../../app/src/cliente/negocio.js')
  const sb = fakeFotos({ falhaUpdate: true })
  await expect(salvarFotosDoNegocio(sb, 'u1', [{ arquivo: 'f' }], null, { reduzir: async () => 'b' })).rejects.toThrow()
  expect(sb.reg.removidos).toEqual(sb.reg.enviados)
  expect(sb.reg.enviados).toHaveLength(1)
})

test('salvarFotosDoNegocio: limite de 30', async () => {
  const { salvarFotosDoNegocio, MAX_FOTOS_NEGOCIO } = await import('../../app/src/cliente/negocio.js')
  expect(MAX_FOTOS_NEGOCIO).toBe(30)
  const sb = fakeFotos()
  const muitas = Array.from({ length: 31 }, (_, i) => ({ path: `p${i}` }))
  await expect(salvarFotosDoNegocio(sb, 'u1', muitas)).rejects.toThrow()
  expect(sb.reg.gravado).toBeNull()
})

test('validarItens recusa nomes iguais depois de normalizar', () => {
  const ok = { precoTexto: '100', promoTexto: '', fotos: [] }
  expect(validarItens([{ ...ok, nome: 'October Fest' }, { ...ok, nome: 'october-fest' }])).toBe('quiz.itens.repetido')
  expect(validarItens([{ ...ok, nome: 'Gramado' }, { ...ok, nome: 'Gramado no Natal' }])).toBeNull()
  // o nome curto demais é avisado antes da repetição
  expect(validarItens([{ ...ok, nome: 'a' }, { ...ok, nome: 'a' }])).toBe('quiz.itens.nome')
})

test('quiz.itens.repetido existe em textos', async () => {
  const { t } = await import('../../app/src/textos.js')
  expect(t('quiz.itens.repetido')).toBe('Há dois itens com o mesmo nome. Apague um deles ou junte as fotos num só.')
})

test('salvarItens guarda a foto com hash no caminho do hash', async () => {
  const { salvarItens } = await import('../../app/src/cliente/negocio.js')
  const caminhos = []
  const sb = fakeSimples([])
  sb.storage = { from: () => ({ upload: async (c) => { caminhos.push(c); return { error: null } }, remove: async () => ({ error: null }) }) }
  const arquivo = new Blob(['x'])
  await salvarItens(sb, 'u1', [{ id: 'i1', nome: 'Item', descricao: '', preco: 10, preco_promo: null,
    fotos: [{ arquivo, nome: 'item_1.jpg', hash: 'abc' }, { arquivo, nome: 'item_2.jpg' }] }], null, { reduzir: async (a) => a, descrever: false })
  expect(caminhos[0]).toBe('u1/produtos/i1/abc.jpg')
  expect(caminhos[1]).toMatch(/^u1\/produtos\/i1\/[0-9a-f-]{36}\.jpg$/)
})
