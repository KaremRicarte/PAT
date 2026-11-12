// Função gerar-mes: monta o mês do cliente que está chamando e grava tudo de uma vez (RPC criar_mes).
// Quem chama é sempre o próprio cliente; o id vem do token validado pelo Auth, nunca do corpo.
import { createClient } from 'npm:@supabase/supabase-js@2'
import type { Resposta } from '../admin-clientes/acoes.ts'
import { hojeEmSaoPaulo } from '../_shared/modelos/calendario.ts'
import { gerarMesDoCliente, type DepsMes } from './acoes.ts'

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

  const deps: DepsMes = {
    cliente: () => ler(db.from('clientes').select('id, situacao, senha_provisoria, ramo').eq('id', quem.id).maybeSingle()),
    negocio: () => ler(db.from('negocios').select('nome, insta, tom, horario').eq('cliente_id', quem.id).maybeSingle()),
    produtos: async () => (await ler(db.from('produtos').select('id, nome, descricao, preco')
      .eq('cliente_id', quem.id).order('ordem'))) ?? [],
    mesesGerados: async () => ((await ler(db.from('meses').select('ano_mes').eq('cliente_id', quem.id))) ?? [])
      .map((m: { ano_mes: string }) => m.ano_mes),
    hoje: () => hojeEmSaoPaulo(),
    async salvar(anoMes, estrategia, posts, redes) {
      const { data, error } = await db.rpc('criar_mes', {
        p_cliente: quem.id, p_ano_mes: anoMes, p_estrategia: estrategia, p_origem: 'modelo', p_posts: posts, p_redes: redes,
      })
      if (error?.code === '23505') return 'repetido'
      if (error) throw error
      return { id: data as string }
    },
  }

  try {
    return responder(await gerarMesDoCliente(corpo, deps))
  } catch (e) {
    console.error(e)
    return responder({ status: 500, corpo: { erro: 'Erro inesperado.' } })
  }
})
