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
// a fila da IA (melhorar-posts) roda em segundo plano e pode mexer nestas colunas a qualquer momento
const semFila = ({ ia_estado: _e, ia_em: _m, origem: _o, ...resto }) => resto
// e, se ela já escreveu o post, também o texto e a foto que ela grava
const semTextoDaFila = ({ titulo: _t, legenda: _l, hashtags: _h, roteiro: _r, foto_path: _f, ...resto }) => semFila(resto)

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
    ordem: antes.ordem, estado: 'gerado', sem_foto: false, trocas: antes.trocas + 1,
  })
  // a foto escolhida antes não fica (sem_foto estava ligado); com a IA, o post pode levar a foto do serviço
  expect(depois.foto_path).not.toBe(`${a.id}/posts/x.jpg`)
  if (depois.origem !== 'ia') expect(depois.foto_path).toBeNull()
  expect(r.corpo.post).toMatchObject({ id, legenda: depois.legenda, trocas: depois.trocas })
})

test('post de outro cliente → 404', async () => {
  // b com ramo, para o pedido chegar à checagem do dono (sem ramo a resposta seria 400 antes)
  const a = await pronto(), b = await pronto({ ramo: 'ferramentas' })
  const { posts } = await novoMes(a)
  const antes = await lerPost(posts[0].id)
  expect(await trocar(b.db, posts[0].id)).toEqual({ status: 404, corpo: { erro: 'Post não encontrado.' } })
  // a fila pode reescrever o post de A em segundo plano: aqui só importa que a troca de B não mudou nada
  const depois = await lerPost(posts[0].id)
  if (depois.origem === 'ia') expect(semTextoDaFila(depois)).toEqual(semTextoDaFila(antes))
  else expect(semFila(depois)).toEqual(semFila(antes))
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
