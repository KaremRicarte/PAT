// listarBanco: só as fotos do banco da administradora (cliente_id null), não as cópias dos clientes.
const chamadas = []
const consulta = new Proxy({}, {
  get: (_, nome) => (nome === 'then'
    ? (ok) => ok({ data: [], error: null })
    : (...args) => { chamadas.push([nome, ...args]); return consulta }),
})
vi.mock('../../app/src/supabase.js', () => ({ default: { from: (tabela) => { chamadas.push(['from', tabela]); return consulta } } }))

test('listarBanco filtra origem banco, o ramo e cliente_id nulo', async () => {
  const { listarBanco } = await import('../../app/src/admin/dados.js')
  expect(await listarBanco('beleza')).toEqual([])
  expect(chamadas).toContainEqual(['from', 'fotos_ia'])
  expect(chamadas).toContainEqual(['eq', 'origem', 'banco'])
  expect(chamadas).toContainEqual(['eq', 'ramo', 'beleza'])
  expect(chamadas).toContainEqual(['is', 'cliente_id', null])
})
