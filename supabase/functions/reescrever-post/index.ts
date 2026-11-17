// Função reescrever-post: depois do "Trocar imagem", a IA reescreve na hora (até ~30 s) a legenda do post para a foto
// atual. Quem chama é sempre o próprio cliente; o id vem do token validado pelo Auth, nunca do corpo.
// Responde { post } (o texto novo) ou { post: null } (fica o texto de antes) — nunca erro por causa da IA.
import { createClient } from 'npm:@supabase/supabase-js@2'
import type { Resposta } from '../admin-clientes/acoes.ts'
import { contarUsoNoMes, criarChamarIA, registrarUso, TEMPO_TROCA_MS, urlAssinada } from '../_shared/ia/adaptadores.ts'
import { reescreverPostDoCliente, type DepsReescrever, type PostParaReescrever } from './acoes.ts'

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

type LinhaPost = Omit<PostParaReescrever, 'cliente_id' | 'estrategia'> & { meses: { cliente_id: string, estrategia: string } }

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

  const deps: DepsReescrever = {
    cliente: () => ler(db.from('clientes').select('id, situacao, senha_provisoria, ramo').eq('id', quem.id).maybeSingle()),
    async post(id) {
      const linha = await ler<LinhaPost>(db.from('posts')
        .select('id, mes_id, data, rede, tipo, formato, pilar, titulo, legenda, hashtags, roteiro, produto_id, ordem, foto_path, '
          + 'sem_foto, preco_de, preco_por, estado, postado_em, meses!inner(cliente_id, estrategia)')
        .eq('id', id).maybeSingle())
      if (!linha) return null
      const { meses, ...post } = linha
      return { ...post, ...meses }
    },
    negocio: () => ler(db.from('negocios').select('nome, insta, tom').eq('cliente_id', quem.id).maybeSingle()),
    produtos: async () => (await ler(db.from('produtos').select('id, nome, descricao, fotos, foto_path')
      .eq('cliente_id', quem.id).order('ordem'))) ?? [],
    async gravar(lido, campos) {
      const { data, error } = await db.rpc('gravar_reescrita_ia', {
        p_id: lido.id, p_legenda_lida: lido.legenda, p_foto_lida: lido.foto_path, p_estado_lido: lido.estado,
        p_sem_foto_lido: lido.sem_foto,
        p_titulo: campos.titulo, p_legenda: campos.legenda, p_hashtags: campos.hashtags, p_roteiro: campos.roteiro,
      })
      if (error) throw error
      return data === true
    },
    // sem chave: null (nada de IA nem de uso registrado). Cada chamada recebe o tempo que sobra do prazo.
    chamar: CHAVE_IA ? (ms) => criarChamarIA(CHAVE_IA, { timeoutMs: Math.min(ms, TEMPO_TROCA_MS), effort: 'low' }) : null,
    agora: () => Date.now(),
    contarNoMes: contarUsoNoMes(db),
    registrarUso: registrarUso(db),
    async fotosInfo(paths) {
      const linhas = await ler<{ path: string, descricao: string | null, serve: boolean | null }[]>(
        db.from('fotos_ia').select('path, descricao, serve').in('path', paths))
      return Object.fromEntries((linhas ?? []).map((l) => [l.path, { descricao: l.descricao, serve: l.serve }]))
    },
    urlAssinada: (path) => urlAssinada(db, 'marcas', path),
  }

  try {
    return responder(await reescreverPostDoCliente(corpo, deps))
  } catch (e) {
    console.error(e)
    return responder({ status: 500, corpo: { erro: 'Erro inesperado.' } })
  }
})
