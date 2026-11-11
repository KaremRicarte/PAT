// Função trocar-post ("Gerar outro"): troca o texto de um post do cliente por outro dos modelos prontos.
// Quem chama é sempre o próprio cliente; o id vem do token validado pelo Auth, nunca do corpo.
import { createClient } from 'npm:@supabase/supabase-js@2'
import type { Resposta } from '../admin-clientes/acoes.ts'
import { trocarPostDoCliente, type DepsTroca, type PostDoMes } from './acoes.ts'

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, content-type, apikey, x-client-info',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

const responder = ({ status, corpo }: Resposta) =>
  new Response(JSON.stringify(corpo), { status, headers: { ...CORS, 'Content-Type': 'application/json' } })

const URL_PROJETO = Deno.env.get('SUPABASE_URL')!
const CHAVE = Deno.env.get('PAT_SECRET_KEY') ?? Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

type LinhaPost = Omit<PostDoMes, 'cliente_id' | 'ano_mes' | 'estrategia'> &
  { meses: { cliente_id: string, ano_mes: string, estrategia: string } }

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })
  if (req.method !== 'POST') return responder({ status: 405, corpo: { erro: 'Método não permitido.' } })

  const db = createClient(URL_PROJETO, CHAVE, { auth: { persistSession: false, autoRefreshToken: false } })
  const jwt = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '')
  const quem = jwt ? (await db.auth.getUser(jwt)).data.user : null
  if (!quem) return responder({ status: 401, corpo: { erro: 'Entre de novo para continuar.' } })

  let corpo: unknown = null
  try { corpo = await req.json() } catch { /* corpo inválido: a validação responde 404 */ }

  const ler = async <T>(consulta: PromiseLike<{ data: T | null, error: unknown }>): Promise<T | null> => {
    const { data, error } = await consulta
    if (error) throw error
    return data
  }

  const deps: DepsTroca = {
    cliente: () => ler(db.from('clientes').select('id, situacao, senha_provisoria, ramo').eq('id', quem.id).maybeSingle()),
    async post(id) {
      const linha = await ler<LinhaPost>(db.from('posts')
        .select('id, mes_id, data, rede, tipo, formato, horario, ordem, trocas, legenda, meses!inner(cliente_id, ano_mes, estrategia)')
        .eq('id', id).maybeSingle())
      if (!linha) return null
      const { meses, ...post } = linha
      return { ...post, ...meses }
    },
    trocasDoMes: async (mesId) => ((await ler(db.from('posts').select('trocas').eq('mes_id', mesId))) ?? [])
      .reduce((soma: number, p: { trocas: number }) => soma + p.trocas, 0),
    negocio: () => ler(db.from('negocios').select('nome, insta, tom, horario').eq('cliente_id', quem.id).maybeSingle()),
    produtos: async () => (await ler(db.from('produtos').select('id, nome, descricao, preco')
      .eq('cliente_id', quem.id).order('ordem'))) ?? [],
    async gravar(id, campos) {
      const { error } = await db.from('posts').update(campos).eq('id', id)
      if (error) throw error
    },
  }

  try {
    return responder(await trocarPostDoCliente(corpo, deps))
  } catch (e) {
    console.error(e)
    return responder({ status: 500, corpo: { erro: 'Erro inesperado.' } })
  }
})
