import { gerarMesDoCliente, type DepsMes } from '../../supabase/functions/gerar-mes/acoes.ts'

const falsos = (extra: Partial<DepsMes> = {}): DepsMes => ({
  cliente: async () => ({ id: 'c1', situacao: 'ativo', senha_provisoria: false, ramo: 'ferramentas' }),
  negocio: async () => ({ nome: 'Ferragens', insta: null, tom: 'proximo', horario: '19:00' }),
  produtos: async () => [{ id: 'p1', nome: 'Furadeira', descricao: null, preco: 99.9 }],
  mesesGerados: async () => [],
  hoje: () => '2026-11-16',
  salvar: vi.fn(async () => ({ id: 'm1' })),
  ...extra,
})

test.each([
  ['sem cliente', { cliente: async () => null }],
  ['bloqueado', { cliente: async () => ({ id: 'c1', situacao: 'bloqueado', senha_provisoria: false, ramo: 'ferramentas' }) }],
  ['senha provisória', { cliente: async () => ({ id: 'c1', situacao: 'ativo', senha_provisoria: true, ramo: 'ferramentas' }) }],
])('%s → 403', async (_, extra) => {
  expect(await gerarMesDoCliente({ estrategia: 'vender' }, falsos(extra as Partial<DepsMes>)))
    .toEqual({ status: 403, corpo: { erro: 'Seu acesso não permite gerar o mês.' } })
})

test.each([null, 'padaria'])('ramo %s → 400', async (ramo) => {
  const deps = falsos({ cliente: async () => ({ id: 'c1', situacao: 'ativo', senha_provisoria: false, ramo }) })
  expect(await gerarMesDoCliente({ estrategia: 'vender' }, deps))
    .toEqual({ status: 400, corpo: { erro: 'Seu ramo ainda não foi definido. Fale com a administração.' } })
})

test.each([undefined, 'ganhar', null])('estratégia %s → 400', async (estrategia) => {
  expect(await gerarMesDoCliente({ estrategia }, falsos()))
    .toEqual({ status: 400, corpo: { erro: 'Escolha uma estratégia.' } })
})

test('entrada que não é objeto → 400', async () => {
  expect((await gerarMesDoCliente(null, falsos())).status).toBe(400)
})

test.each([
  ['sem negócio', { negocio: async () => null }],
  ['sem produtos', { produtos: async () => [] }],
])('%s → 400', async (_, extra) => {
  expect(await gerarMesDoCliente({ estrategia: 'vender' }, falsos(extra as Partial<DepsMes>)))
    .toEqual({ status: 400, corpo: { erro: 'Complete o cadastro do seu negócio antes.' } })
})

test('sem mês para gerar → 409', async () => {
  const deps = falsos({ mesesGerados: async () => ['2026-11'] })
  expect(await gerarMesDoCliente({ estrategia: 'vender' }, deps))
    .toEqual({ status: 409, corpo: { erro: 'O próximo mês fica disponível a partir do dia 21.' } })
})

test('mês repetido ao salvar → 409', async () => {
  const deps = falsos({ salvar: async () => 'repetido' as const })
  expect(await gerarMesDoCliente({ estrategia: 'vender' }, deps))
    .toEqual({ status: 409, corpo: { erro: 'Este mês já foi gerado.' } })
})

test('salva com o mês-alvo e as datas a partir de hoje', async () => {
  const deps = falsos()
  const r = await gerarMesDoCliente({ estrategia: 'tempo' }, deps)
  expect(r.status).toBe(201)
  const [anoMes, estrategia, posts] = (deps.salvar as ReturnType<typeof vi.fn>).mock.calls[0]
  expect([anoMes, estrategia]).toEqual(['2026-11', 'tempo'])
  expect(posts.every((p: { data: string }) => p.data >= '2026-11-16')).toBe(true)
  expect(r.corpo).toEqual({ id: 'm1', anoMes: '2026-11', total: posts.length })
})

test('mês que não passa na validação → 500 e nada é salvo', async () => {
  // um nome com marcador sobrando faz a validação recusar os posts
  const deps = falsos({ negocio: async () => ({ nome: 'Loja {prod}', insta: null, tom: 'proximo', horario: '19:00' }) })
  const erro = vi.spyOn(console, 'error').mockImplementation(() => {})
  expect(await gerarMesDoCliente({ estrategia: 'vender' }, deps))
    .toEqual({ status: 500, corpo: { erro: 'Não foi possível montar o mês.' } })
  expect(deps.salvar).not.toHaveBeenCalled()
  erro.mockRestore()
})
