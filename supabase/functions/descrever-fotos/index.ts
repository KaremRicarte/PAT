// Função descrever-fotos: a IA descreve as fotos novas (do cliente ou do banco de imagens) e diz se servem para post.
// Quem chama vem do token validado pelo Auth, nunca do corpo. Sem chave da Anthropic ou com o limite do mês estourado,
// responde 200 com nada descrito (o app segue igual).
import { createClient } from 'npm:@supabase/supabase-js@2'
import type { Resposta } from '../admin-clientes/acoes.ts'
import { contarUsoNoMes, criarChamarIA, registrarUso, TEMPO_FILA_MS, urlAssinada } from '../_shared/ia/adaptadores.ts'
import { descreverFotos, type DepsDescrever } from './acoes.ts'

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, content-type, apikey, x-client-info',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

const responder = ({ status, corpo }: Resposta) =>
  new Response(JSON.stringify(corpo), { status, headers: { ...CORS, 'Content-Type': 'application/json' } })

const URL_PROJETO = Deno.env.get('SUPABASE_URL')!
const CHAVE = Deno.env.get('PAT_SECRET_KEY') ?? Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const CHAVE_IA = Deno.env.get('ANTHROPIC_API_KEY')

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })
  if (req.method !== 'POST') return responder({ status: 405, corpo: { erro: 'Método não permitido.' } })

  const db = createClient(URL_PROJETO, CHAVE, { auth: { persistSession: false, autoRefreshToken: false } })
  const jwt = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '')
  const quem = jwt ? (await db.auth.getUser(jwt)).data.user : null
  if (!quem) return responder({ status: 401, corpo: { erro: 'Entre de novo para continuar.' } })

  let corpo: unknown = null
  try { corpo = await req.json() } catch { /* corpo inválido: a validação responde 400 */ }

  const deps: DepsDescrever = {
    // mesma regra de public.is_admin(): papel em app_metadata, que só a chave de serviço grava
    quem: { id: quem.id, admin: quem.app_metadata?.role === 'admin' },
    async cliente() {
      const { data, error } = await db.from('clientes').select('id, situacao, senha_provisoria, ramo').eq('id', quem.id).maybeSingle()
      if (error) throw error
      return data
    },
    async jaDescritas(paths) {
      const { data, error } = await db.from('fotos_ia').select('path').in('path', paths)
      if (error) throw error
      return (data ?? []).map((l) => l.path as string)
    },
    urlAssinada: (bucket, path) => urlAssinada(db, bucket, path),
    chamar: CHAVE_IA ? criarChamarIA(CHAVE_IA, { timeoutMs: TEMPO_FILA_MS }) : null,
    contarNoMes: contarUsoNoMes(db),
    registrarUso: registrarUso(db),
    async gravarFoto(linha) {
      const { error } = await db.from('fotos_ia').upsert(linha, { onConflict: 'path' })
      if (error) throw error
    },
  }

  try {
    return responder(await descreverFotos(corpo, deps))
  } catch (e) {
    console.error(e)
    return responder({ status: 500, corpo: { erro: 'Erro inesperado.' } })
  }
})
