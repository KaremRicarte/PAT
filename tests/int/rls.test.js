import { servico, novoCliente, novaAdmin, limpar, criados } from './ajuda.js'

afterEach(() => limpar(criados.splice(0)))

test('cliente lê só a própria linha', async () => {
  const a = await novoCliente(), b = await novoCliente()
  const { data } = await a.db.from('clientes').select('id')
  expect(data.map(r => r.id)).toEqual([a.id])
})
test('cliente não consegue se desbloquear nem limpar a senha provisória', async () => {
  const a = await novoCliente({ situacao: 'bloqueado' })
  await a.db.from('clientes').update({ situacao: 'ativo', senha_provisoria: false }).eq('id', a.id)
  const { data } = await servico().from('clientes').select('situacao,senha_provisoria').eq('id', a.id).single()
  expect(data).toEqual({ situacao: 'bloqueado', senha_provisoria: true })
})
test('marcar_senha_trocada afeta só quem chama', async () => {
  const a = await novoCliente(), b = await novoCliente()
  await a.db.rpc('marcar_senha_trocada')
  const { data } = await servico().from('clientes').select('id,senha_provisoria').in('id', [a.id, b.id])
  expect(Object.fromEntries(data.map(r => [r.id, r.senha_provisoria]))).toEqual({ [a.id]: false, [b.id]: true })
})
test('evento só com o próprio id; só a admin lê eventos', async () => {
  const a = await novoCliente(), b = await novoCliente(), adm = await novaAdmin()
  expect((await a.db.from('eventos').insert({ cliente_id: a.id, tipo: 'acesso' })).error).toBeNull()
  expect((await a.db.from('eventos').insert({ cliente_id: b.id, tipo: 'acesso' })).error).not.toBeNull()
  expect((await a.db.from('eventos').select('id')).data).toEqual([])
  expect((await adm.db.from('eventos').select('id').eq('cliente_id', a.id)).data).toHaveLength(1)
})
test('admin lê todos e bloqueia', async () => {
  const a = await novoCliente(), adm = await novaAdmin()
  await adm.db.from('clientes').update({ situacao: 'bloqueado' }).eq('id', a.id)
  const { data } = await servico().from('clientes').select('situacao').eq('id', a.id).single()
  expect(data.situacao).toBe('bloqueado')
})
