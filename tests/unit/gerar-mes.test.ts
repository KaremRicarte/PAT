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

test('ramo sem promoção com preço escrito pelo cliente → 400 dizendo o que revisar', async () => {
  const deps = falsos({
    cliente: async () => ({ id: 'c1', situacao: 'ativo', senha_provisoria: false, ramo: 'advocacia' }),
    produtos: async () => [{ id: 'p1', nome: 'Consulta R$ 200', descricao: null, preco: null }],
  })
  expect(await gerarMesDoCliente({ estrategia: 'vender' }, deps)).toEqual({ status: 400, corpo: {
    erro: 'Revise "Consulta R$ 200": em Advocacia os textos não podem falar de preço nem de promoção.' } })
  expect(deps.salvar).not.toHaveBeenCalled()
})

test('psicologia com "100% online" e "promover" gera normalmente', async () => {
  const deps = falsos({
    cliente: async () => ({ id: 'c1', situacao: 'ativo', senha_provisoria: false, ramo: 'psicologia' }),
    produtos: async () => [{ id: 'p1', nome: 'Psicoterapia 100% online', descricao: 'Sessões para promover autoconhecimento', preco: null }],
  })
  expect((await gerarMesDoCliente({ estrategia: 'vender' }, deps)).status).toBe(201)
})

const TODAS = ['instagram', 'facebook', 'tiktok', 'whatsapp']
const chamada = (deps: DepsMes) => (deps.salvar as ReturnType<typeof vi.fn>).mock.calls[0]

test.each([
  ['vazio', []], ['valor desconhecido', ['instagram', 'orkut']], ['não-array', 'instagram'], ['null', null],
  ['número na lista', [1]],
])('redes %s → 400', async (_, redes) => {
  const deps = falsos()
  expect(await gerarMesDoCliente({ estrategia: 'vender', redes }, deps))
    .toEqual({ status: 400, corpo: { erro: 'Escolha pelo menos uma rede.' } })
  expect(deps.salvar).not.toHaveBeenCalled()
})

test('sem redes no corpo → todas (app antigo)', async () => {
  const deps = falsos()
  expect((await gerarMesDoCliente({ estrategia: 'vender' }, deps)).status).toBe(201)
  const [, , posts, redes] = chamada(deps)
  expect(redes).toEqual(TODAS)
  expect(new Set(posts.map((p: { rede: string }) => p.rede))).toEqual(new Set(TODAS))
})

test('redes repetidas são removidas e salvar recebe só as escolhidas', async () => {
  const deps = falsos()
  const r = await gerarMesDoCliente({ estrategia: 'vender', redes: ['whatsapp', 'tiktok', 'whatsapp'] }, deps)
  expect(r.status).toBe(201)
  const [, , posts, redes] = chamada(deps)
  expect(redes).toEqual(['whatsapp', 'tiktok'])
  expect(new Set(posts.map((p: { rede: string }) => p.rede))).toEqual(new Set(['whatsapp', 'tiktok']))
  expect(r.corpo).toEqual({ id: 'm1', anoMes: '2026-11', total: posts.length })
})
