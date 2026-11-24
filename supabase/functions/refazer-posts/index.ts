// Função refazer-posts: depois de editar os itens, refaz os posts que faltam com os modelos prontos.
// Quem chama é sempre o próprio cliente; o id vem do token validado pelo Auth, nunca do corpo.
import { createClient } from 'npm:@supabase/supabase-js@2'
import { precosVisiveis } from '../_shared/modelos/precos.ts'
import type { Resposta } from '../admin-clientes/acoes.ts'
import { hojeEmSaoPaulo } from '../_shared/modelos/calendario.ts'
import { cutucarMelhorarPosts } from '../_shared/cutucar.ts'
import { refazerPostsDoCliente, type DepsRefazer, type PostQueFalta } from './acoes.ts'

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, content-type, apikey, x-client-info',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

const responder = ({ status, corpo }: Resposta) =>
  new Response(JSON.stringify(corpo), { status, headers: { ...CORS, 'Content-Type': 'application/json' } })

const URL_PROJETO = Deno.env.get('SUPABASE_URL')!
const CHAVE = Deno.env.get('PAT_SECRET_KEY') ?? Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

type LinhaPost = Omit<PostQueFalta, 'ano_mes' | 'estrategia'> & { meses: { ano_mes: string, estrategia: string } }

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

  const deps: DepsRefazer = {
    cliente: () => ler(db.from('clientes').select('id, situacao, senha_provisoria, ramo, frequencia').eq('id', quem.id).maybeSingle()),
    negocio: () => ler(db.from('negocios').select('nome, insta, tom, horario').eq('cliente_id', quem.id).maybeSingle()),
    produtos: async () => precosVisiveis((await ler(db.from('produtos').select('id, nome, descricao, preco, preco_promo, promo_data, ocultar_preco')
      .eq('cliente_id', quem.id).order('ordem'))) ?? []),
    hoje: () => hojeEmSaoPaulo(),
    async postsQueFaltam(hoje) {
      const linhas = (await ler<LinhaPost[]>(db.from('posts')
        .select('id, data, rede, tipo, formato, horario, ordem, estado, postado_em, produto_id, pilar, ocasiao, foto_path, sem_foto, meses!inner(ano_mes, estrategia, cliente_id)')
        .eq('meses.cliente_id', quem.id).gte('data', hoje).is('postado_em', null))) ?? []
      return linhas.map(({ meses, ...p }) => ({ ...p, ano_mes: meses.ano_mes, estrategia: meses.estrategia }))
    },
    async gravar(mudancas) {
      const erros = (await Promise.all(mudancas.map(({ id, campos }) => db.from('posts').update(campos).eq('id', id))))
        .map((x) => x.error).filter(Boolean)
      if (erros.length) throw erros[0]
    },
  }

  try {
    const resposta = await refazerPostsDoCliente(corpo, deps)
    // posts refeitos voltam para a fila da IA
    if (resposta.status === 200) cutucarMelhorarPosts(URL_PROJETO)
    return responder(resposta)
  } catch (e) {
    console.error(e)
    return responder({ status: 500, corpo: { erro: 'Erro inesperado.' } })
  }
})
