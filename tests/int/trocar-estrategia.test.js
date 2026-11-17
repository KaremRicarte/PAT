import { servico, novoCliente, novoMes, limpar, criados } from './ajuda.js'

const URL = process.env.VITE_SUPABASE_URL
const ANON = process.env.VITE_SUPABASE_ANON_KEY

afterEach(() => limpar(criados.splice(0)))

async function trocar(db, corpo) {
  const { data: { session } } = await db.auth.getSession()
  const r = await fetch(`${URL}/functions/v1/trocar-estrategia`, {
    method: 'POST',
    headers: { apikey: ANON, Authorization: `Bearer ${session.access_token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(corpo),
  })
  return { status: r.status, corpo: await r.json() }
}

const pronto = () => novoCliente({ senha_provisoria: false })
const todosOsPosts = async (mesId) =>
  (await servico().from('posts').select('*').eq('mes_id', mesId).order('ordem')).data

test('troca para crescer: mês atualizado, postado intacto, sem (data, rede, tipo) repetido; passados intactos', async () => {
  const a = await pronto()
  const { mesId } = await novoMes(a)
  const s = servico()
  const hoje = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(new Date())
  const antes = await todosOsPosts(mesId)
  const postado = antes[antes.length - 1]
  await s.from('posts').update({ estado: 'aprovado', postado_em: new Date().toISOString() }).eq('id', postado.id)
  // um post de dia passado, criado à mão, deve ficar como está
  const { data: [passado] } = await s.from('posts').insert({
    mes_id: mesId, data: `${hoje.slice(0, 7)}-01`, rede: 'instagram', tipo: 'feed', formato: 'arte',
    titulo: 'Passado', legenda: 'x', horario: '08:00', ordem: 9999, estado: 'aprovado', postado_em: new Date().toISOString(),
  }).select('*')
  const antesPostado = (await todosOsPosts(mesId)).find((p) => p.id === postado.id)

  const r = await trocar(a.db, { mes_id: mesId, estrategia: 'crescer' })
  expect(r.status).toBe(200)
  expect(r.corpo.refeitos).toBeGreaterThan(0)

  const { data: mes } = await s.from('meses').select('estrategia').eq('id', mesId).single()
  expect(mes.estrategia).toBe('crescer')
  const depois = await todosOsPosts(mesId)
  expect(depois.find((p) => p.id === postado.id)).toEqual(antesPostado)
  expect(depois.find((p) => p.id === passado.id)).toEqual(passado)
  const chaves = depois.filter((p) => p.data >= hoje).map((p) => `${p.data}|${p.rede}|${p.tipo}`)
  expect(new Set(chaves).size).toBe(chaves.length)
})

test('outro cliente recebe 404', async () => {
  const a = await pronto(), b = await pronto()
  const { mesId } = await novoMes(a)
  const r = await trocar(b.db, { mes_id: mesId, estrategia: 'crescer' })
  expect(r.status).toBe(404)
})
