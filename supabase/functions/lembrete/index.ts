// Função lembrete: chamada pelo pg_cron às 8h e às 20h (horário de São Paulo) com { turno }.
// Não tem usuário: só aceita quem traz o cabeçalho x-lembrete-secret igual ao segredo LEMBRETE_SECRET.
import { createClient } from 'npm:@supabase/supabase-js@2'
import { hojeEmSaoPaulo } from '../_shared/modelos/calendario.ts'
import { quemAvisar, textoDoLembrete, turnoValido, type LinhaLembrete } from '../_shared/lembrete.ts'
import { enviarParaTodas, type Inscricao } from '../_shared/push.ts'

const responder = (status: number, corpo: unknown) =>
  new Response(JSON.stringify(corpo), { status, headers: { 'Content-Type': 'application/json' } })

const URL_PROJETO = Deno.env.get('SUPABASE_URL')!
const CHAVE = Deno.env.get('PAT_SECRET_KEY') ?? Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const SEGREDO = Deno.env.get('LEMBRETE_SECRET') ?? ''

type LinhaPost = {
  rede: string, estado: string, postado_em: string | null,
  meses: { cliente_id: string, clientes: { situacao: string } },
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') return responder(405, { erro: 'Método não permitido.' })
  if (!SEGREDO || req.headers.get('x-lembrete-secret') !== SEGREDO) return responder(401, { erro: 'Não autorizado.' })

  let corpo: { turno?: unknown } = {}
  try { corpo = await req.json() } catch { /* corpo inválido: responde 400 abaixo */ }
  const turno = corpo?.turno
  if (!turnoValido(turno)) return responder(400, { erro: 'Turno inválido.' })

  try {
    const db = createClient(URL_PROJETO, CHAVE, { auth: { persistSession: false, autoRefreshToken: false } })
    const hoje = hojeEmSaoPaulo()

    const { data: posts, error: e1 } = await db.from('posts')
      .select('rede, estado, postado_em, meses!inner(cliente_id, clientes!inner(situacao))')
      .eq('data', hoje)
    if (e1) throw e1
    const linhas: LinhaLembrete[] = ((posts ?? []) as unknown as LinhaPost[]).map((p) => ({
      cliente_id: p.meses.cliente_id, situacao: p.meses.clientes.situacao,
      rede: p.rede, estado: p.estado, postado_em: p.postado_em,
    }))
    const avisos = quemAvisar(turno, linhas)
    if (avisos.size === 0) return responder(200, { enviados: 0, expiradas: 0, erros: 0 })

    const { data: inscricoes, error: e2 } = await db.from('push_inscricoes')
      .select('id, cliente_id, endpoint, p256dh, auth')
      .in('cliente_id', [...avisos.keys()])
    if (e2) throw e2

    const url = `/?dia=${hoje}`
    const envios = ((inscricoes ?? []) as Inscricao[]).map((inscricao) => ({
      inscricao, payload: { ...textoDoLembrete(turno, avisos.get(inscricao.cliente_id)!), url },
    }))
    const { enviados, erros, expiradas } = await enviarParaTodas(envios)

    if (expiradas.length) {
      const { error: e3 } = await db.from('push_inscricoes').delete().in('id', expiradas)
      if (e3) throw e3
    }
    return responder(200, { enviados, expiradas: expiradas.length, erros })
  } catch (e) {
    console.error(e)
    return responder(500, { erro: 'Erro inesperado.' })
  }
})
