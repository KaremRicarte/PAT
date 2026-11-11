import { servico, novoCliente, novoMes, limpar, criados } from './ajuda.js'

const URL = process.env.VITE_SUPABASE_URL
const ANON = process.env.VITE_SUPABASE_ANON_KEY

afterEach(() => limpar(criados.splice(0)))

async function trocar(db, post_id) {
  const { data: { session } } = await db.auth.getSession()
  const r = await fetch(`${URL}/functions/v1/trocar-post`, {
    method: 'POST',
    headers: { apikey: ANON, Authorization: `Bearer ${session.access_token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ post_id }),
  })
  return { status: r.status, corpo: await r.json() }
}

const pronto = (extra = {}) => novoCliente({ senha_provisoria: false, ...extra })
const lerPost = async (id) => (await servico().from('posts').select('*').eq('id', id).single()).data

test('troca muda o texto, mantém a data e soma 1', async () => {
  const a = await pronto()
  const { posts } = await novoMes(a)
  const id = posts[0].id
  // o post foi reprovado e tinha foto: a troca volta tudo ao começo
  await servico().from('posts').update({ estado: 'reprovado', foto_path: `${a.id}/posts/x.jpg`, sem_foto: true }).eq('id', id)
  const antes = await lerPost(id)

  const r = await trocar(a.db, id)
  expect(r.status).toBe(200)
  const depois = await lerPost(id)
  expect(depois.legenda).not.toBe(antes.legenda)
  expect(depois).toMatchObject({
    data: antes.data, rede: antes.rede, tipo: antes.tipo, formato: antes.formato, horario: antes.horario,
    ordem: antes.ordem, estado: 'gerado', foto_path: null, sem_foto: false, trocas: antes.trocas + 1,
  })
  expect(r.corpo.post).toMatchObject({ id, legenda: depois.legenda, trocas: depois.trocas })
})

test('post de outro cliente → 404', async () => {
  const a = await pronto(), b = await pronto()
  const { posts } = await novoMes(a)
  const antes = await lerPost(posts[0].id)
  expect(await trocar(b.db, posts[0].id)).toEqual({ status: 404, corpo: { erro: 'Post não encontrado.' } })
  expect(await lerPost(posts[0].id)).toEqual(antes)
})

test('bloqueado → 403', async () => {
  const a = await pronto()
  const { posts } = await novoMes(a)
  await servico().from('clientes').update({ situacao: 'bloqueado' }).eq('id', a.id)
  expect(await trocar(a.db, posts[0].id))
    .toEqual({ status: 403, corpo: { erro: 'Seu acesso não permite trocar posts.' } })
})

test('11ª troca → 429', async () => {
  const a = await pronto()
  const { posts } = await novoMes(a)
  await servico().from('posts').update({ trocas: 10 }).eq('id', posts[0].id)
  expect(await trocar(a.db, posts[1].id))
    .toEqual({ status: 429, corpo: { erro: 'Você já usou as 10 trocas deste mês.' } })
})
