import { servico, novoCliente, novoMes, limpar, criados } from './ajuda.js'

afterEach(() => limpar(criados.splice(0)))

const pronto = (extra = {}) => novoCliente({ senha_provisoria: false, ...extra })
const lerPost = async (db, id) => (await db.from('posts').select('*').eq('id', id).single()).data

test('cliente aprova, reprova e marca foto dos próprios posts', async () => {
  const a = await pronto()
  const { posts } = await novoMes(a)
  const id = posts[0].id
  expect((await a.db.from('posts').update({ estado: 'aprovado' }).eq('id', id)).error).toBeNull()
  expect((await lerPost(a.db, id)).estado).toBe('aprovado')
  expect((await a.db.from('posts').update({ estado: 'reprovado' }).eq('id', id)).error).toBeNull()
  expect((await lerPost(a.db, id)).estado).toBe('reprovado')
  const foto = `${a.id}/posts/x.jpg`
  expect((await a.db.from('posts').update({ foto_path: foto, sem_foto: false }).eq('id', id)).error).toBeNull()
  const p = await lerPost(a.db, id)
  expect(p.foto_path).toBe(foto)
  expect(p.sem_foto).toBe(false)
})

test('postado_em é sempre a hora do servidor', async () => {
  const a = await pronto()
  const { posts } = await novoMes(a)
  const id = posts[0].id
  expect((await a.db.from('posts').update({ postado_em: '2000-01-01T00:00:00Z' }).eq('id', id)).error).toBeNull()
  const p = await lerPost(a.db, id)
  expect(new Date(p.postado_em).getFullYear()).toBeGreaterThanOrEqual(2026)
  expect((await a.db.from('posts').update({ postado_em: null }).eq('id', id)).error).toBeNull()
  expect((await lerPost(a.db, id)).postado_em).toBeNull()
})

test('cliente não altera legenda, não grava editado e não usa foto de outra pasta', async () => {
  const a = await pronto()
  const { posts } = await novoMes(a)
  const id = posts[0].id
  expect((await a.db.from('posts').update({ legenda: 'x' }).eq('id', id)).error).not.toBeNull()
  expect((await a.db.from('posts').update({ estado: 'editado' }).eq('id', id)).error).not.toBeNull()
  expect((await a.db.from('posts').update({ foto_path: 'outro-uid/posts/x.jpg' }).eq('id', id)).error).not.toBeNull()
})

test('cliente não altera post de outro e bloqueado não altera nada', async () => {
  const a = await pronto(), b = await pronto()
  const { posts } = await novoMes(a)
  const id = posts[0].id
  const rb = await b.db.from('posts').update({ estado: 'aprovado' }).eq('id', id).select('id')
  expect(rb.data ?? []).toHaveLength(0)
  expect((await servico().from('posts').select('estado').eq('id', id).single()).data.estado).toBe('gerado')
  await servico().from('clientes').update({ situacao: 'bloqueado' }).eq('id', a.id)
  const ra = await a.db.from('posts').update({ estado: 'aprovado' }).eq('id', id).select('id')
  expect(ra.data ?? []).toHaveLength(0)
  expect((await servico().from('posts').select('estado').eq('id', id).single()).data.estado).toBe('gerado')
})

test('push_inscricoes: cada um vê e apaga só as suas', async () => {
  const a = await pronto(), b = await pronto()
  const { error } = await a.db.from('push_inscricoes')
    .insert({ cliente_id: a.id, endpoint: `https://push.example/${a.id}`, p256dh: 'k', auth: 'a' })
  expect(error).toBeNull()
  expect((await b.db.from('push_inscricoes').select('id')).data).toEqual([])
  const rb = await b.db.from('push_inscricoes').delete().eq('cliente_id', a.id).select('id')
  expect(rb.data ?? []).toHaveLength(0)
  const ra = await a.db.from('push_inscricoes').delete().eq('cliente_id', a.id).select('id')
  expect(ra.data).toHaveLength(1)
})
