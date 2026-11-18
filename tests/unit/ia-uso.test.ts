import { comLimiteEUso, LIMITE_MENSAL, LIMITE_GERADAS, type RegistroUso, type TipoUso } from '../../supabase/functions/_shared/ia/uso.ts'
import { custoImagemGerada } from '../../supabase/functions/_shared/ia/custo.ts'
import type { ChamarIA, PedidoIA, RespostaIA } from '../../supabase/functions/_shared/ia/escrever.ts'

beforeEach(() => { vi.spyOn(console, 'error').mockImplementation(() => {}) })
afterEach(() => { vi.restoreAllMocks() })

const PEDIDO: PedidoIA = { sistema: 's', conteudo: [{ tipo: 'texto', texto: 'oi' }], esquema: {}, maxTokens: 10 }

function montar(respostas: (RespostaIA | Error)[], usoInicial = 0) {
  const registros: RegistroUso[] = []
  let chamadas = 0
  const chamar: ChamarIA = async () => {
    const r = respostas[Math.min(chamadas++, respostas.length - 1)]
    if (r instanceof Error) throw r
    return r
  }
  const contarNoMes = vi.fn(async () => usoInicial + registros.length)
  const registrar = vi.fn(async (r: RegistroUso) => { registros.push(r) })
  return { chamar, registros, contarNoMes, registrar, chamadas: () => chamadas }
}

test('o limite é 400 chamadas por mês', () => {
  expect(LIMITE_MENSAL).toBe(400)
})

test('registra cada chamada com tokens e custo', async () => {
  const m = montar([{ ok: true, dados: { a: 1 }, tokensEntrada: 1000, tokensSaida: 100 }])
  const chamar = comLimiteEUso(m.chamar, { clienteId: 'c1', tipo: 'foto', registrar: m.registrar, contarNoMes: m.contarNoMes })
  const r = await chamar(PEDIDO)
  expect(r).toEqual({ ok: true, dados: { a: 1 }, tokensEntrada: 1000, tokensSaida: 100 })
  expect(m.registros).toEqual([{ clienteId: 'c1', tipo: 'foto', tokensEntrada: 1000, tokensSaida: 100, custoUsd: (1000 * 4 + 100 * 20) / 1e6 }])
})

test('falha da IA também conta (com os tokens que vierem, ou zero)', async () => {
  const m = montar([
    { ok: false, motivo: 'recusa', tokensEntrada: 50, tokensSaida: 5 },
    { ok: false, motivo: 'tempo' },
  ])
  const chamar = comLimiteEUso(m.chamar, { clienteId: 'c1', tipo: 'post', registrar: m.registrar, contarNoMes: m.contarNoMes })
  expect(await chamar(PEDIDO)).toMatchObject({ ok: false, motivo: 'recusa' })
  expect(await chamar(PEDIDO)).toMatchObject({ ok: false, motivo: 'tempo' })
  expect(m.registros.map((r) => [r.tokensEntrada, r.tokensSaida])).toEqual([[50, 5], [0, 0]])
})

test('chamada que lança erro vira { ok:false, motivo:"erro" } e é registrada', async () => {
  const m = montar([new Error('rede')])
  const chamar = comLimiteEUso(m.chamar, { clienteId: 'c1', tipo: 'troca', registrar: m.registrar, contarNoMes: m.contarNoMes })
  expect(await chamar(PEDIDO)).toEqual({ ok: false, motivo: 'erro' })
  expect(m.registros).toHaveLength(1)
})

test('limite atingido: recusa sem chamar a IA e sem registrar', async () => {
  const m = montar([{ ok: true, dados: {}, tokensEntrada: 1, tokensSaida: 1 }], 400)
  const chamar = comLimiteEUso(m.chamar, { clienteId: 'c1', tipo: 'post', registrar: m.registrar, contarNoMes: m.contarNoMes })
  expect(await chamar(PEDIDO)).toEqual({ ok: false, motivo: 'limite' })
  expect(m.chamadas()).toBe(0)
  expect(m.registros).toHaveLength(0)
})

test('a 400ª chamada passa, a 401ª não (novas tentativas contam)', async () => {
  const m = montar([{ ok: true, dados: {}, tokensEntrada: 1, tokensSaida: 1 }], 399)
  const chamar = comLimiteEUso(m.chamar, { clienteId: 'c1', tipo: 'post', registrar: m.registrar, contarNoMes: m.contarNoMes })
  expect((await chamar(PEDIDO)).ok).toBe(true)
  expect(await chamar(PEDIDO)).toEqual({ ok: false, motivo: 'limite' })
  expect(m.chamadas()).toBe(1)
})

test('chamadas em paralelo não passam do limite juntas', async () => {
  const m = montar([{ ok: true, dados: {}, tokensEntrada: 1, tokensSaida: 1 }], 398)
  const chamar = comLimiteEUso(m.chamar, { clienteId: 'c1', tipo: 'foto', registrar: m.registrar, contarNoMes: m.contarNoMes })
  const rs = await Promise.all([1, 2, 3, 4].map(() => chamar(PEDIDO)))
  expect(rs.filter((r) => r.ok)).toHaveLength(2)
  expect(rs.filter((r) => !r.ok && r.motivo === 'limite')).toHaveLength(2)
  expect(m.chamadas()).toBe(2)
})

test('sem cliente (banco da administradora): não há limite, mas registra com cliente null', async () => {
  const m = montar([{ ok: true, dados: {}, tokensEntrada: 2, tokensSaida: 3 }], 10_000)
  const chamar = comLimiteEUso(m.chamar, { clienteId: null, tipo: 'foto', registrar: m.registrar, contarNoMes: m.contarNoMes })
  expect((await chamar(PEDIDO)).ok).toBe(true)
  expect(m.contarNoMes).not.toHaveBeenCalled()
  expect(m.registros[0]).toMatchObject({ clienteId: null, tipo: 'foto' })
})

test('erro ao contar o uso: por segurança não chama a IA', async () => {
  const m = montar([{ ok: true, dados: {}, tokensEntrada: 1, tokensSaida: 1 }])
  const chamar = comLimiteEUso(m.chamar, {
    clienteId: 'c1', tipo: 'post', registrar: m.registrar, contarNoMes: async () => { throw new Error('banco fora') },
  })
  expect(await chamar(PEDIDO)).toEqual({ ok: false, motivo: 'erro' })
  expect(m.chamadas()).toBe(0)
})

test('erro ao registrar não derruba a resposta da IA', async () => {
  const m = montar([{ ok: true, dados: { x: 1 }, tokensEntrada: 1, tokensSaida: 1 }])
  const chamar = comLimiteEUso(m.chamar, {
    clienteId: 'c1', tipo: 'post', contarNoMes: m.contarNoMes, registrar: async () => { throw new Error('insert falhou') },
  })
  expect(await chamar(PEDIDO)).toMatchObject({ ok: true, dados: { x: 1 } })
  expect(console.error).toHaveBeenCalled()
})

describe('imagem gerada: custo e limite', () => {
  it('cobra US$ 0,003 por megapixel arredondado para cima', () => {
    expect(custoImagemGerada(864, 1080)).toBe(0.003)
    expect(custoImagemGerada(1024, 1024)).toBe(0.006)
    expect(custoImagemGerada(576, 1024)).toBe(0.003)
  })

  it('limita 20 imagens geradas por mês e aceita o tipo gerada', () => {
    const tipo: TipoUso = 'gerada'
    expect(tipo).toBe('gerada')
    expect(LIMITE_GERADAS).toBe(20)
  })
})
