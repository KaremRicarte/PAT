import { servico, novoCliente, novoNegocio, limpar, criados } from './ajuda.js'
import { mesAlvo, hojeEmSaoPaulo } from '../../supabase/functions/_shared/modelos/calendario.ts'

const URL = process.env.VITE_SUPABASE_URL
const ANON = process.env.VITE_SUPABASE_ANON_KEY

afterEach(() => limpar(criados.splice(0)))

async function gerar(db, body = { estrategia: 'vender' }) {
  const { data: { session } } = await db.auth.getSession()
  const r = await fetch(`${URL}/functions/v1/gerar-mes`, {
    method: 'POST',
    headers: { apikey: ANON, Authorization: `Bearer ${session.access_token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  return { status: r.status, corpo: await r.json() }
}

// Clientes de teste já com a senha trocada (como quem passou pelo primeiro acesso).
const pronto = (extra = {}) => novoCliente({ senha_provisoria: false, ...extra })

test('cliente com negócio gera o mês', async () => {
  const a = await pronto()
  await novoNegocio(a)
  const r = await gerar(a.db)
  expect(r.status).toBe(201)
  expect(r.corpo.anoMes).toBe(mesAlvo(hojeEmSaoPaulo(), []).anoMes)
  expect(r.corpo.total).toBeGreaterThan(0)
  const { data: posts } = await a.db.from('posts').select('id').eq('mes_id', r.corpo.id)
  expect(posts).toHaveLength(r.corpo.total)
})

test("segunda chamada → 409 'Este mês já foi gerado.' ou mês seguinte bloqueado, e continua um mês só", async () => {
  const a = await pronto()
  await novoNegocio(a)
  expect((await gerar(a.db)).status).toBe(201)
  const [r2, r3] = await Promise.all([gerar(a.db), gerar(a.db)])
  expect(r2.status).toBe(409)
  expect(r3.status).toBe(409)
  const { data: meses } = await servico().from('meses').select('ano_mes').eq('cliente_id', a.id)
  expect(meses).toHaveLength(1)
})

test('duas chamadas ao mesmo tempo gravam um mês só', async () => {
  const a = await pronto()
  await novoNegocio(a)
  const respostas = await Promise.all([gerar(a.db), gerar(a.db)])
  expect(respostas.map((r) => r.status).sort()).toEqual([201, 409])
  const { data: meses } = await servico().from('meses').select('id').eq('cliente_id', a.id)
  expect(meses).toHaveLength(1)
})

test('outro cliente não vê os posts', async () => {
  const a = await pronto(), b = await pronto()
  await novoNegocio(a)
  const r = await gerar(a.db)
  const { data } = await b.db.from('posts').select('id').eq('mes_id', r.corpo.id)
  expect(data).toEqual([])
})

test('cliente bloqueado → 403', async () => {
  const a = await pronto({ situacao: 'bloqueado' })
  await novoNegocio(a)
  expect(await gerar(a.db)).toEqual({ status: 403, corpo: { erro: 'Seu acesso não permite gerar o mês.' } })
})

test('sem negócio → 400', async () => {
  const a = await pronto({ ramo: 'beleza' })
  expect(await gerar(a.db)).toEqual({ status: 400, corpo: { erro: 'Complete o cadastro do seu negócio antes.' } })
})

test('cliente sem ramo → 400', async () => {
  const a = await pronto()
  await novoNegocio(a)
  await servico().from('clientes').update({ ramo: null }).eq('id', a.id)
  expect(await gerar(a.db))
    .toEqual({ status: 400, corpo: { erro: 'Seu ramo ainda não foi definido. Fale com a administração.' } })
})

test('gerar só com o TikTok grava só posts do TikTok e as redes do mês', async () => {
  const a = await pronto()
  await novoNegocio(a)
  const r = await gerar(a.db, { estrategia: 'vender', redes: ['tiktok'] })
  expect(r.status).toBe(201)
  const { data: posts } = await a.db.from('posts').select('rede').eq('mes_id', r.corpo.id)
  expect(posts.length).toBe(r.corpo.total)
  expect(posts.length).toBeGreaterThan(0)
  expect(new Set(posts.map((p) => p.rede))).toEqual(new Set(['tiktok']))
  const { data: mes } = await a.db.from('meses').select('redes').eq('id', r.corpo.id).single()
  expect(mes.redes).toEqual(['tiktok'])
})

test('redes vazias → 400 e nada é gravado', async () => {
  const a = await pronto()
  await novoNegocio(a)
  expect(await gerar(a.db, { estrategia: 'vender', redes: [] }))
    .toEqual({ status: 400, corpo: { erro: 'Escolha pelo menos uma rede.' } })
  const { data: meses } = await servico().from('meses').select('id').eq('cliente_id', a.id)
  expect(meses).toEqual([])
})
