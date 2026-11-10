import { RAMOS, ramoValido, listaRamos, itemDoProduto } from '../../supabase/functions/_shared/modelos/ramos/index.ts'
import type { Ramo } from '../../supabase/functions/_shared/modelos/tipos.ts'

const PROIBIDAS = /R\$|\d+\s?%|promo|desconto|oferta|black friday/i

// Todas as strings de conteúdo de um ramo (para conferir as palavras proibidas).
function textos(r: Ramo): string[] {
  const out: string[] = []
  const juntar = (v: unknown) => {
    if (typeof v === 'string') out.push(v)
    else if (Array.isArray(v)) v.forEach(juntar)
    else if (v && typeof v === 'object') Object.values(v).forEach(juntar)
  }
  juntar(r.lib); juntar(r.aprox); juntar(r.convite); juntar(r.gen('x', 'x'))
  return out
}

// Contrato: vale para todo ramo registrado, inclusive os que forem incluídos depois.
describe.each(Object.values(RAMOS))('ramo $id', (r) => {
  test('id no formato do banco e igual à chave', () => {
    expect(r.id).toMatch(/^[a-z][a-z0-9_]{1,29}$/)
    expect(RAMOS[r.id]).toBe(r)
  })
  test('tem pelo menos 8 itens e 8 aproximações, e os 3 convites', () => {
    expect(r.lib.length).toBeGreaterThanOrEqual(8)
    expect(r.aprox.length).toBeGreaterThanOrEqual(8)
    expect(Object.keys(r.convite).sort()).toEqual(['promo', 'proximo', 'tecnico'])
  })
  test('tem ao menos 2 aproximações Stories e 1 Reels', () => {
    expect(r.aprox.filter((a) => a.fmt === 'Stories').length).toBeGreaterThanOrEqual(2)
    expect(r.aprox.filter((a) => a.fmt === 'Reels').length).toBeGreaterThanOrEqual(1)
  })
  test('cores em hex', () => {
    expect(r.cores.cor1).toMatch(/^#[0-9A-Fa-f]{6}$/)
    expect(r.cores.cor2).toMatch(/^#[0-9A-Fa-f]{6}$/)
  })
  test('se noPromo, nenhum texto tem palavra de promoção', () => {
    if (!r.noPromo) return
    expect(textos(r).filter((s) => PROIBIDAS.test(s))).toEqual([])
  })
})

test('os 5 ramos atuais estão registrados', () => {
  expect(Object.keys(RAMOS).sort()).toEqual(['advocacia', 'beleza', 'ferramentas', 'psicologia', 'turismo'])
})

test('psicologia e advocacia têm noPromo e textOnly; os outros não', () => {
  for (const r of Object.values(RAMOS)) {
    const especial = r.id === 'psicologia' || r.id === 'advocacia'
    expect([r.id, r.noPromo, r.textOnly]).toEqual([r.id, especial, especial])
  }
})

test("ramoValido aceita 'beleza' e recusa 'padaria', '' e null", () => {
  expect(ramoValido('beleza')).toBe(true)
  expect(ramoValido('padaria')).toBe(false)
  expect(ramoValido('')).toBe(false)
  expect(ramoValido(null)).toBe(false)
  expect(ramoValido('toString')).toBe(false)
})

test('listaRamos em ordem alfabética de nome', () => {
  const nomes = listaRamos().map((r) => r.nome)
  expect(nomes).toEqual([...nomes].sort((a, b) => a.localeCompare(b, 'pt')))
  expect(listaRamos()[0]).toEqual({ id: 'advocacia', nome: 'Advocacia', desc: 'Escritórios e advogados autônomos' })
})

test('itemDoProduto acha "Furadeira Bosch" no lib de ferramentas', () => {
  expect(itemDoProduto(RAMOS.ferramentas, 'Furadeira Bosch').k).toBe('furadeira')
})

test('itemDoProduto usa gen para item desconhecido', () => {
  const it = itemDoProduto(RAMOS.ferramentas, 'Bolo de pote')
  expect(it.k).toBe('gen')
  expect(it.nome).toBe('Bolo de pote')
  expect(it.gancho).toContain('bolo de pote')
})
