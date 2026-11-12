// Migração 20261112000003: RPC inscrever_push e os ajustes do gatilho dos posts.
import { randomUUID } from 'node:crypto'
import { servico, novoCliente, novoMes, limpar, criados } from './ajuda.js'

afterEach(() => limpar(criados.splice(0)))

const pronto = (extra = {}) => novoCliente({ senha_provisoria: false, ...extra })
const novoEndpoint = () => `https://push.example/${randomUUID()}`
const inscrever = (db, endpoint, p256dh = 'chave', auth = 'segredo') =>
  db.rpc('inscrever_push', { p_endpoint: endpoint, p_p256dh: p256dh, p_auth: auth })
const donoDo = async (endpoint) =>
  (await servico().from('push_inscricoes').select('cliente_id, p256dh, auth').eq('endpoint', endpoint).maybeSingle()).data

// ---------- inscrever_push ----------
test('inscrever_push grava a inscrição do cliente e reinscrever atualiza as chaves', async () => {
  const a = await pronto()
  const endpoint = novoEndpoint()
  expect((await inscrever(a.db, endpoint)).error).toBeNull()
  expect(await donoDo(endpoint)).toEqual({ cliente_id: a.id, p256dh: 'chave', auth: 'segredo' })
  expect((await inscrever(a.db, endpoint, 'chave2', 'segredo2')).error).toBeNull()
  expect(await donoDo(endpoint)).toEqual({ cliente_id: a.id, p256dh: 'chave2', auth: 'segredo2' })
})

test('o mesmo endpoint inscrito por outro cliente passa a ser dele', async () => {
  const a = await pronto(), b = await pronto()
  const endpoint = novoEndpoint()
  expect((await inscrever(a.db, endpoint)).error).toBeNull()
  expect((await inscrever(b.db, endpoint)).error).toBeNull()
  expect((await donoDo(endpoint)).cliente_id).toBe(b.id)
  expect((await a.db.from('push_inscricoes').select('id')).data).toEqual([])
})

test('cliente bloqueado não inscreve; endpoint inválido é recusado', async () => {
  const a = await pronto()
  await servico().from('clientes').update({ situacao: 'bloqueado' }).eq('id', a.id)
  const endpoint = novoEndpoint()
  expect((await inscrever(a.db, endpoint)).error).not.toBeNull()
  expect(await donoDo(endpoint)).toBeNull()

  const b = await pronto()
  expect((await inscrever(b.db, 'http://sem-https.example/x')).error).not.toBeNull()
  expect((await inscrever(b.db, novoEndpoint(), '', 'segredo')).error).not.toBeNull()
})

// ---------- gatilho dos posts ----------
const lerPost = async (id) => (await servico().from('posts').select('*').eq('id', id).single()).data

test('sem_foto = true é recusado em ramo com foto e aceito em ramo só de texto', async () => {
  const a = await pronto()
  const { posts } = await novoMes(a) // ramo ferramentas
  const id = posts[0].id
  expect((await a.db.from('posts').update({ sem_foto: true }).eq('id', id)).error).not.toBeNull()
  expect((await lerPost(id)).sem_foto).toBe(false)

  await servico().from('clientes').update({ ramo: 'psicologia' }).eq('id', a.id)
  expect((await a.db.from('posts').update({ sem_foto: true }).eq('id', id)).error).toBeNull()
  expect((await lerPost(id)).sem_foto).toBe(true)
})

test('trocar outra coluna sem mexer em foto_path funciona mesmo com uma foto fora da pasta', async () => {
  const a = await pronto()
  const { posts } = await novoMes(a)
  const id = posts[0].id
  await servico().from('posts').update({ foto_path: 'outro-uid/posts/x.jpg' }).eq('id', id)
  expect((await a.db.from('posts').update({ estado: 'aprovado' }).eq('id', id)).error).toBeNull()
  const p = await lerPost(id)
  expect(p.estado).toBe('aprovado')
  expect(p.foto_path).toBe('outro-uid/posts/x.jpg')
  // mudar para outra foto fora da pasta continua proibido
  expect((await a.db.from('posts').update({ foto_path: 'outro-uid/posts/y.jpg' }).eq('id', id)).error).not.toBeNull()
})
