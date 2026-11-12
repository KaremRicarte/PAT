// Função lembrete-teste: logo depois de ativar os lembretes, o app pede uma notificação de teste.
// Quem chama é sempre o próprio cliente; o id vem do token validado pelo Auth, nunca do corpo.
import { createClient } from 'npm:@supabase/supabase-js@2'
import { hojeEmSaoPaulo } from '../_shared/modelos/calendario.ts'
import { enviarParaTodas, type Inscricao } from '../_shared/push.ts'

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, content-type, apikey, x-client-info',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

const responder = (status: number, corpo: unknown) =>
  new Response(JSON.stringify(corpo), { status, headers: { ...CORS, 'Content-Type': 'application/json' } })

const URL_PROJETO = Deno.env.get('SUPABASE_URL')!
const CHAVE = Deno.env.get('PAT_SECRET_KEY') ?? Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

const CORPO_TESTE = 'Lembretes ativados ✓ Você vai receber um aviso às 8h nos dias com post.'

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })
  if (req.method !== 'POST') return responder(405, { erro: 'Método não permitido.' })

  const db = createClient(URL_PROJETO, CHAVE, { auth: { persistSession: false, autoRefreshToken: false } })
  const jwt = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '')
  const quem = jwt ? (await db.auth.getUser(jwt)).data.user : null
  if (!quem) return responder(401, { erro: 'Entre de novo para continuar.' })

  try {
    const { data: inscricoes, error: e1 } = await db.from('push_inscricoes')
      .select('id, cliente_id, endpoint, p256dh, auth')
      .eq('cliente_id', quem.id)
    if (e1) throw e1

    const payload = { titulo: 'PAT', corpo: CORPO_TESTE, url: `/?dia=${hojeEmSaoPaulo()}` }
    const { enviados, erros, expiradas } = await enviarParaTodas(
      ((inscricoes ?? []) as Inscricao[]).map((inscricao) => ({ inscricao, payload })),
    )
    if (expiradas.length) {
      const { error: e2 } = await db.from('push_inscricoes').delete().in('id', expiradas)
      if (e2) throw e2
    }
    return responder(200, { enviados, expiradas: expiradas.length, erros })
  } catch (e) {
    console.error(e)
    return responder(500, { erro: 'Erro inesperado.' })
  }
})
