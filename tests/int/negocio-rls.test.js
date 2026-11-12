import { servico, novoCliente, novaAdmin, novoNegocio, limpar, criados } from './ajuda.js'

afterEach(() => limpar(criados.splice(0)))

const negocio = (id) => ({ cliente_id: id, nome: 'Loja da Ana', cor1: '#112233', cor2: '#FFFFFF' })

test('cliente grava e lê o próprio negócio e produtos', async () => {
  const a = await novoCliente({ senha_provisoria: false })
  expect((await a.db.from('negocios').insert(negocio(a.id))).error).toBeNull()
  expect((await a.db.from('produtos').insert({ cliente_id: a.id, nome: 'Furadeira' })).error).toBeNull()
  const { data: n } = await a.db.from('negocios').select('nome,tom,horario,assinatura')
  expect(n).toEqual([{ nome: 'Loja da Ana', tom: 'proximo', horario: '19:00', assinatura: 'ambos' }])
  const { data: p } = await a.db.from('produtos').select('nome')
  expect(p).toEqual([{ nome: 'Furadeira' }])
})

test('cliente não lê negócio nem posts de outro', async () => {
  const a = await novoCliente(), b = await novoCliente()
  await novoNegocio(b)
  const s = servico()
  await s.rpc('criar_mes', {
    p_cliente: b.id, p_ano_mes: '2026-12', p_estrategia: 'tempo', p_origem: 'modelo', p_posts: [postBase()],
  })
  expect((await a.db.from('negocios').select('*')).data).toEqual([])
  expect((await a.db.from('produtos').select('*')).data).toEqual([])
  expect((await a.db.from('meses').select('*')).data).toEqual([])
  expect((await a.db.from('posts').select('*')).data).toEqual([])
})

test('cliente bloqueado não grava negócio', async () => {
  const a = await novoCliente({ situacao: 'bloqueado' })
  const { error } = await a.db.from('negocios').insert(negocio(a.id))
  expect(error?.code).toBe('42501')
})

test('cliente não altera o próprio ramo', async () => {
  const a = await novoCliente({ ramo: 'beleza' })
  await a.db.from('clientes').update({ ramo: 'advocacia' }).eq('id', a.id)
  const { data } = await servico().from('clientes').select('ramo').eq('id', a.id).single()
  expect(data.ramo).toBe('beleza')
})

test('admin define o ramo de um cliente', async () => {
  const a = await novoCliente(), adm = await novaAdmin()
  const { error } = await adm.db.from('clientes').update({ ramo: 'turismo' }).eq('id', a.id)
  expect(error).toBeNull()
  const { data } = await servico().from('clientes').select('ramo').eq('id', a.id).single()
  expect(data.ramo).toBe('turismo')
})

test('cliente não insere em meses nem posts', async () => {
  const a = await novoCliente()
  const m = await a.db.from('meses').insert({ cliente_id: a.id, ano_mes: '2026-12', estrategia: 'tempo', origem: 'modelo' })
  expect(m.error?.code).toBe('42501')
  const p = await a.db.from('posts').insert({ ...postBase(), mes_id: '00000000-0000-0000-0000-000000000000' })
  expect(p.error?.code).toBe('42501')
})

test('cliente não executa criar_mes', async () => {
  const a = await novoCliente()
  const { error } = await a.db.rpc('criar_mes', {
    p_cliente: a.id, p_ano_mes: '2026-12', p_estrategia: 'tempo', p_origem: 'modelo', p_posts: [],
  })
  expect(error).not.toBeNull()
})

test('admin lê negócios de todos', async () => {
  const a = await novoCliente(), adm = await novaAdmin()
  await novoNegocio(a)
  const { data } = await adm.db.from('negocios').select('cliente_id').eq('cliente_id', a.id)
  expect(data).toEqual([{ cliente_id: a.id }])
})

test('cliente envia arquivo só na própria pasta do bucket marcas', async () => {
  const a = await novoCliente({ senha_provisoria: false }), b = await novoCliente()
  const png = new Blob([new Uint8Array([137, 80, 78, 71])], { type: 'image/png' })
  const ok = await a.db.storage.from('marcas').upload(`${a.id}/x.png`, png, { upsert: true })
  expect(ok.error).toBeNull()
  const nao = await a.db.storage.from('marcas').upload(`${b.id}/x.png`, png, { upsert: true })
  expect(nao.error).not.toBeNull()
  await servico().storage.from('marcas').remove([`${a.id}/x.png`])
})

test('cliente bloqueado não registra evento', async () => {
  const a = await novoCliente({ situacao: 'bloqueado' })
  const { error } = await a.db.from('eventos').insert({ cliente_id: a.id, tipo: 'acesso' })
  expect(error).not.toBeNull()
})

test('criar_mes pela chave de serviço grava mês e posts, e repetir dá 23505', async () => {
  const a = await novoCliente()
  const s = servico()
  const args = { p_cliente: a.id, p_ano_mes: '2026-12', p_estrategia: 'vender', p_origem: 'modelo', p_posts: [postBase(), { ...postBase(), ordem: 1, rede: 'facebook' }] }
  const r1 = await s.rpc('criar_mes', args)
  expect(r1.error).toBeNull()
  const { data: posts } = await a.db.from('posts').select('rede,estado,trocas').eq('mes_id', r1.data).order('ordem')
  expect(posts).toEqual([
    { rede: 'instagram', estado: 'gerado', trocas: 0 },
    { rede: 'facebook', estado: 'gerado', trocas: 0 },
  ])
  const r2 = await s.rpc('criar_mes', args)
  expect(r2.error?.code).toBe('23505')
})

test('criar_mes grava as redes do mês; sem p_redes, as 4; rede desconhecida é recusada', async () => {
  const a = await novoCliente(), b = await novoCliente(), c = await novoCliente()
  const s = servico()
  const args = (cliente) => ({ p_cliente: cliente.id, p_ano_mes: '2026-12', p_estrategia: 'vender', p_origem: 'modelo', p_posts: [] })
  const r1 = await s.rpc('criar_mes', { ...args(a), p_redes: ['tiktok', 'whatsapp'] })
  expect(r1.error).toBeNull()
  const r2 = await s.rpc('criar_mes', args(b))
  expect(r2.error).toBeNull()
  const { data } = await s.from('meses').select('id, redes').in('id', [r1.data, r2.data])
  expect(data.find((m) => m.id === r1.data).redes).toEqual(['tiktok', 'whatsapp'])
  expect(data.find((m) => m.id === r2.data).redes).toEqual(['instagram', 'facebook', 'tiktok', 'whatsapp'])
  expect((await s.rpc('criar_mes', { ...args(c), p_redes: ['orkut'] })).error).not.toBeNull()
  expect((await s.rpc('criar_mes', { ...args(c), p_redes: [] })).error).not.toBeNull()
})

function postBase() {
  return {
    data: '2026-12-02', rede: 'instagram', tipo: 'feed', formato: 'arte', pilar: 'demo',
    titulo: 'Título', legenda: 'Legenda', hashtags: ['#a'], horario: '19:00', roteiro: null, produto_id: null, ordem: 0,
  }
}

test('cliente com senha provisória não grava negócio, produto nem arquivo', async () => {
  const a = await novoCliente({ senha_provisoria: true })
  expect((await a.db.from('negocios').insert(negocio(a.id))).error?.code).toBe('42501')
  await novoNegocio(a)
  expect((await a.db.from('produtos').insert({ cliente_id: a.id, nome: 'Trena' })).error?.code).toBe('42501')
  const png = new Blob([new Uint8Array([137, 80, 78, 71])], { type: 'image/png' })
  expect((await a.db.storage.from('marcas').upload(`${a.id}/x.png`, png)).error).not.toBeNull()
})

test('cliente bloqueado não grava produto nem arquivo', async () => {
  const a = await novoCliente({ situacao: 'bloqueado' })
  await novoNegocio(a)
  expect((await a.db.from('produtos').insert({ cliente_id: a.id, nome: 'Trena' })).error?.code).toBe('42501')
  const png = new Blob([new Uint8Array([137, 80, 78, 71])], { type: 'image/png' })
  expect((await a.db.storage.from('marcas').upload(`${a.id}/x.png`, png)).error).not.toBeNull()
})

test('cliente não lê, não baixa e não lista arquivos de outro', async () => {
  const a = await novoCliente({ senha_provisoria: false }), b = await novoCliente({ senha_provisoria: false })
  const png = new Blob([new Uint8Array([137, 80, 78, 71])], { type: 'image/png' })
  expect((await b.db.storage.from('marcas').upload(`${b.id}/logo.png`, png, { upsert: true })).error).toBeNull()
  expect((await a.db.storage.from('marcas').download(`${b.id}/logo.png`)).error).not.toBeNull()
  expect((await a.db.storage.from('marcas').list(b.id)).data ?? []).toEqual([])
  expect((await a.db.storage.from('marcas').createSignedUrl(`${b.id}/logo.png`, 60)).error).not.toBeNull()
  await servico().storage.from('marcas').remove([`${b.id}/logo.png`])
})

test('cliente não grava nem altera produto de outro', async () => {
  const a = await novoCliente({ senha_provisoria: false }), b = await novoCliente({ senha_provisoria: false })
  const { produtos } = await novoNegocio(b)
  expect((await a.db.from('produtos').insert({ cliente_id: b.id, nome: 'Invasão' })).error?.code).toBe('42501')
  await a.db.from('produtos').update({ nome: 'Trocado' }).eq('id', produtos[0].id)
  await a.db.from('produtos').upsert({ id: produtos[0].id, cliente_id: a.id, nome: 'Roubado' })
  const { data } = await servico().from('produtos').select('nome, cliente_id').eq('id', produtos[0].id).single()
  expect(data).toEqual({ nome: produtos[0].nome, cliente_id: b.id })
})
