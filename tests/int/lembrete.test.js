import { createECDH, randomBytes } from 'node:crypto'
import { servico, novoCliente, novoMes, limpar, criados } from './ajuda.js'
import { hojeEmSaoPaulo } from '../../supabase/functions/_shared/modelos/calendario.ts'

const URL = process.env.VITE_SUPABASE_URL
const ANON = process.env.VITE_SUPABASE_ANON_KEY
const SEGREDO = process.env.LEMBRETE_SECRET
const ENDPOINT_FALSO = 'https://fcm.googleapis.com/fcm/send/teste-invalido'

afterEach(() => limpar(criados.splice(0)))

async function lembrete(turno, segredo) {
  const headers = { apikey: ANON, 'Content-Type': 'application/json' }
  if (segredo) headers['x-lembrete-secret'] = segredo
  const r = await fetch(`${URL}/functions/v1/lembrete`, { method: 'POST', headers, body: JSON.stringify({ turno }) })
  return { status: r.status, corpo: await r.json() }
}

// Chaves de exemplo no formato certo (P-256 + 16 bytes), para o web-push conseguir cifrar o envio.
function chavesDeExemplo() {
  const ecdh = createECDH('prime256v1')
  ecdh.generateKeys()
  return { p256dh: ecdh.getPublicKey().toString('base64url'), auth: randomBytes(16).toString('base64url') }
}

test('sem segredo → 401', async () => {
  expect((await lembrete('manha')).status).toBe(401)
  expect((await lembrete('manha', 'segredo-errado')).status).toBe(401)
})

test('com segredo → 200 e apaga inscrição falsa', async () => {
  const s = servico()
  const a = await novoCliente({ senha_provisoria: false })
  const { posts } = await novoMes(a)
  const r1 = await s.from('posts').update({ data: hojeEmSaoPaulo(), estado: 'gerado', postado_em: null }).eq('id', posts[0].id)
  if (r1.error) throw r1.error

  await s.from('push_inscricoes').delete().eq('endpoint', ENDPOINT_FALSO)
  const { data: inscricao, error } = await s.from('push_inscricoes')
    .insert({ cliente_id: a.id, endpoint: ENDPOINT_FALSO, ...chavesDeExemplo() }).select('id').single()
  if (error) throw error

  const r = await lembrete('manha', SEGREDO)
  expect(r.status).toBe(200)
  const { data: restou } = await s.from('push_inscricoes').select('id').eq('id', inscricao.id).maybeSingle()
  expect(restou === null || r.corpo.expiradas >= 1 || r.corpo.erros >= 1).toBe(true)
})
