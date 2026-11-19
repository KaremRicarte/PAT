// Função trocar-estrategia: troca a estratégia de um mês e refaz os posts que faltam (RPC trocar_estrategia_mes).
// Quem chama é sempre o próprio cliente; o id vem do token validado pelo Auth, nunca do corpo.
import { createClient } from 'npm:@supabase/supabase-js@2'
import type { Resposta } from '../admin-clientes/acoes.ts'
import { hojeEmSaoPaulo } from '../_shared/modelos/calendario.ts'
import { cutucarMelhorarPosts } from '../_shared/cutucar.ts'
import { trocarEstrategiaDoMes, type DepsTrocaEstrategia } from './acoes.ts'

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, content-type, apikey, x-client-info',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

const responder = ({ status, corpo }: Resposta) =>
  new Response(JSON.stringify(corpo), { status, headers: { ...CORS, 'Content-Type': 'application/json' } })

const URL_PROJETO = Deno.env.get('SUPABASE_URL')!
const CHAVE = Deno.env.get('PAT_SECRET_KEY') ?? Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })
  if (req.method !== 'POST') return responder({ status: 405, corpo: { erro: 'Método não permitido.' } })

  const db = createClient(URL_PROJETO, CHAVE, { auth: { persistSession: false, autoRefreshToken: false } })
  const jwt = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '')
  const quem = jwt ? (await db.auth.getUser(jwt)).data.user : null
  if (!quem) return responder({ status: 401, corpo: { erro: 'Entre de novo para continuar.' } })

  let corpo: unknown = null
  try { corpo = await req.json() } catch { /* corpo inválido: a validação responde 400 */ }

  const ler = async <T>(consulta: PromiseLike<{ data: T | null, error: unknown }>): Promise<T | null> => {
    const { data, error } = await consulta
    if (error) throw error
    return data
  }

  const deps: DepsTrocaEstrategia = {
    cliente: () => ler(db.from('clientes').select('id, situacao, senha_provisoria, ramo').eq('id', quem.id).maybeSingle()),
    mes: (id) => ler(db.from('meses').select('id, cliente_id, ano_mes, estrategia, redes').eq('id', id).maybeSingle()),
    negocio: () => ler(db.from('negocios').select('nome, insta, tom, horario').eq('cliente_id', quem.id).maybeSingle()),
    produtos: async () => (await ler(db.from('produtos').select('id, nome, descricao, preco, preco_promo, promo_data')
      .eq('cliente_id', quem.id).order('ordem'))) ?? [],
    hoje: () => hojeEmSaoPaulo(),
    async gravar(mesId, estrategia, desde, posts) {
      const { data, error } = await db.rpc('trocar_estrategia_mes', {
        p_mes: mesId, p_estrategia: estrategia, p_desde: desde, p_posts: posts,
      })
      if (error) throw error
      return data as number
    },
  }

  try {
    const resposta = await trocarEstrategiaDoMes(corpo, deps)
    // posts novos da estratégia nascem na fila da IA
    if (resposta.status === 200) cutucarMelhorarPosts(URL_PROJETO)
    return responder(resposta)
  } catch (e) {
    console.error(e)
    return responder({ status: 500, corpo: { erro: 'Erro inesperado.' } })
  }
})
