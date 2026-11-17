import { servico, novoCliente, novoMes, limpar, criados } from './ajuda.js'

const URL = process.env.VITE_SUPABASE_URL
const ANON = process.env.VITE_SUPABASE_ANON_KEY

afterEach(() => limpar(criados.splice(0)))

async function refazer(db, modo) {
  const { data: { session } } = await db.auth.getSession()
  const r = await fetch(`${URL}/functions/v1/refazer-posts`, {
    method: 'POST',
    headers: { apikey: ANON, Authorization: `Bearer ${session.access_token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ modo }),
  })
  return { status: r.status, corpo: await r.json() }
}

const pronto = (extra = {}) => novoCliente({ senha_provisoria: false, ...extra })
const todosOsPosts = async (mesId) =>
  (await servico().from('posts').select('*').eq('mes_id', mesId).order('ordem')).data

test('refaz com o item novo; não mexe em postado, aprovado (no modo não aprovados) nem em outro cliente', async () => {
  const a = await pronto(), b = await pronto()
  const { mesId } = await novoMes(a)
  const mesB = await novoMes(b)
  const antesB = await todosOsPosts(mesB.mesId)
  // o mês é gerado a partir de hoje: todos os posts são de hoje em diante
  const [postado, aprovado, descartado] = await todosOsPosts(mesId)
  const s = servico()
  await s.from('posts').update({ estado: 'aprovado', postado_em: new Date().toISOString() }).eq('id', postado.id)
  await s.from('posts').update({ estado: 'aprovado' }).eq('id', aprovado.id)
  await s.from('posts').update({ estado: 'reprovado', foto_path: `${a.id}/posts/x.jpg` }).eq('id', descartado.id)
  // troca os itens: sai tudo, entra um item só
  await s.from('produtos').delete().eq('cliente_id', a.id)
  const { data: [novo] } = await s.from('produtos').insert({ cliente_id: a.id, nome: 'Serra circular', ordem: 0 }).select('id')

  const antes = await todosOsPosts(mesId)
  const r = await refazer(a.db, 'nao_aprovados')
  expect(r.status).toBe(200)
  expect(r.corpo.refeitos).toBeGreaterThan(0)
  const depois = await todosOsPosts(mesId)
  const porId = (lista, id) => lista.find((p) => p.id === id)

  expect(porId(depois, postado.id)).toEqual(porId(antes, postado.id))
  expect(porId(depois, aprovado.id)).toEqual(porId(antes, aprovado.id))
  expect(porId(depois, descartado.id)).toMatchObject({ estado: 'gerado', foto_path: null, data: descartado.data, rede: descartado.rede })
  // todo post refeito que cita item cita o item novo
  const refeitos = depois.filter((p) => p.produto_id !== null && p.id !== postado.id && p.id !== aprovado.id)
  expect(refeitos.length).toBeGreaterThan(0)
  for (const p of refeitos) expect(p.produto_id).toBe(novo.id)
  // o outro cliente não foi tocado
  expect(await todosOsPosts(mesB.mesId)).toEqual(antesB)

  const r2 = await refazer(a.db, 'todos')
  expect(r2.status).toBe(200)
  expect(porId(await todosOsPosts(mesId), aprovado.id)).toMatchObject({ estado: 'gerado' })
  expect(porId(await todosOsPosts(mesId), postado.id)).toEqual(porId(antes, postado.id))
})

test('modo inválido → 400; bloqueado → 403', async () => {
  const a = await pronto()
  await novoMes(a)
  expect(await refazer(a.db, 'tudo')).toEqual({ status: 400, corpo: { erro: 'Escolha o que refazer.' } })
  await servico().from('clientes').update({ situacao: 'bloqueado' }).eq('id', a.id)
  expect((await refazer(a.db, 'todos')).status).toBe(403)
})
