// Função melhorar-posts: a fila da IA em segundo plano (Etapa 4A). Chamada pelo pg_cron a cada minuto e pelas
// "cutucadas" de gerar-mes, refazer-posts e trocar-estrategia. Não tem usuário: só aceita quem traz o cabeçalho
// x-melhorar-secret igual ao segredo MELHORAR_POSTS_SECRET (no Vault: melhorar_posts_secret); qualquer outro -> 401.
// Responde na hora (202) e trabalha em segundo plano por até ~110 s, pegando até 6 posts por vez.
import { createClient } from 'npm:@supabase/supabase-js@2'
import { hojeEmSaoPaulo } from '../_shared/modelos/calendario.ts'
import {
  contarUsoNoMes, copiarDoBanco, copiarExterna, criarBuscarPexels, criarBuscarPixabay, criarChamarIA, criarGerarImagem,
  registrarUso, TEMPO_FILA_MS, urlAssinada,
} from '../_shared/ia/adaptadores.ts'
import { melhorarUmPost, processarFila, type Contexto, type DepsMelhorar, type PostDaFila } from './acoes.ts'

declare const EdgeRuntime: { waitUntil?: (p: Promise<unknown>) => void } | undefined

const responder = (status: number, corpo: unknown) =>
  new Response(JSON.stringify(corpo), { status, headers: { 'Content-Type': 'application/json' } })

const URL_PROJETO = Deno.env.get('SUPABASE_URL')!
const CHAVE = Deno.env.get('PAT_SECRET_KEY') ?? Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const SEGREDO = Deno.env.get('MELHORAR_POSTS_SECRET') ?? ''
const CHAVE_IA = Deno.env.get('ANTHROPIC_API_KEY')
const CHAVE_PEXELS = Deno.env.get('PEXELS_API_KEY')
const CHAVE_PIXABAY = Deno.env.get('PIXABAY_API_KEY')
const CHAVE_FAL = Deno.env.get('FAL_KEY')

// consultas .in(...) em pedaços, para a URL não ficar longa demais
const PEDACO = 40
const PAGINA = 1000

function criarDeps(): { deps: DepsMelhorar, pegar: (n: number) => Promise<PostDaFila[]> } {
  const db = createClient(URL_PROJETO, CHAVE, { auth: { persistSession: false, autoRefreshToken: false } })
  const reservadas = new Set<string>()
  const ler = async <T>(consulta: PromiseLike<{ data: T | null, error: unknown }>): Promise<T | null> => {
    const { data, error } = await consulta
    if (error) throw error
    return data
  }

  const deps: DepsMelhorar = {
    // sem chave: null (nunca o invólucro sem chave), e nada de IA nem de uso registrado.
    // Cada chamada recebe o tempo cortado pelo prazo da execução (nunca mais que TEMPO_FILA_MS).
    chamar: CHAVE_IA ? (ms) => criarChamarIA(CHAVE_IA, { timeoutMs: Math.min(ms, TEMPO_FILA_MS) }) : null,
    agora: () => Date.now(),
    contarNoMes: contarUsoNoMes(db),
    registrarUso: registrarUso(db),

    async contexto(mesId) {
      const mes = await ler<{ cliente_id: string, estrategia: string }>(
        db.from('meses').select('cliente_id, estrategia').eq('id', mesId).maybeSingle())
      if (!mes) return null
      const [cliente, negocio, produtos] = await Promise.all([
        ler<{ situacao: string, ramo: string | null }>(db.from('clientes').select('situacao, ramo').eq('id', mes.cliente_id).maybeSingle()),
        ler(db.from('negocios').select('nome, insta, tom, fotos').eq('cliente_id', mes.cliente_id).maybeSingle()),
        ler(db.from('produtos').select('id, nome, descricao, fotos, foto_path').eq('cliente_id', mes.cliente_id).order('ordem')),
      ])
      if (!cliente) return null
      return {
        clienteId: mes.cliente_id, situacao: cliente.situacao, ramo: cliente.ramo, estrategia: mes.estrategia,
        negocio: negocio as Contexto['negocio'],
        produtos: (produtos ?? []) as Contexto['produtos'],
      }
    },

    async fotosInfo(paths) {
      const info: Record<string, { descricao: string | null, serve: boolean | null }> = {}
      for (let i = 0; i < paths.length; i += PEDACO) {
        const linhas = await ler<{ path: string, descricao: string | null, serve: boolean | null }[]>(
          db.from('fotos_ia').select('path, descricao, serve').in('path', paths.slice(i, i + PEDACO)))
        for (const l of linhas ?? []) info[l.path] = { descricao: l.descricao, serve: l.serve }
      }
      return info
    },
    urlAssinada: (path) => urlAssinada(db, 'marcas', path),
    async gravarFoto(linha) {
      const { error } = await db.from('fotos_ia').upsert(linha, { onConflict: 'path' })
      if (error) throw error
    },

    // banco próprio da administradora: só as fotos do ramo, já descritas (cliente_id nulo = do banco, não cópias)
    async bancoDoRamo(ramo) {
      const linhas = await ler<{ path: string, descricao: string | null, serve: boolean | null }[]>(
        db.from('fotos_ia').select('path, descricao, serve').eq('origem', 'banco').is('cliente_id', null).eq('ramo', ramo))
      return (linhas ?? []).filter((l) => l.descricao)
        .map((l) => ({ path: l.path, descricao: l.descricao as string, ...(l.serve === null ? {} : { serve: l.serve }) }))
    },
    async usadasPeloCliente(clienteId, desde) {
      const linhas = await ler<{ path: string }[]>(
        db.from('fotos_usadas').select('path').eq('cliente_id', clienteId).gte('usado_em', desde))
      return (linhas ?? []).map((l) => l.path)
    },
    buscarPexels: criarBuscarPexels(CHAVE_PEXELS),
    buscarPixabay: criarBuscarPixabay(CHAVE_PIXABAY),
    // todos os ids já usados por qualquer cliente, de página em página (o PostgREST corta em 1000 linhas)
    async idsUsados(fonte) {
      const ids: string[] = []
      for (let de = 0; ; de += PAGINA) {
        const linhas = await ler<{ externo_id: string | null }[]>(db.from('fotos_ia').select('externo_id')
          .eq('origem', fonte).not('externo_id', 'is', null).order('externo_id').range(de, de + PAGINA - 1))
        for (const l of linhas ?? []) if (l.externo_id) ids.push(l.externo_id)
        if ((linhas ?? []).length < PAGINA) return ids
      }
    },
    // imagem gerada pelo fal.ai; sem FAL_KEY o adaptador é null e nada é gerado
    gerarImagem: criarGerarImagem(CHAVE_FAL),
    async geradasNoMes(clienteId) {
      const n = await ler<number>(db.rpc('uso_ia_geradas_no_mes', { p_cliente: clienteId }))
      return Number(n ?? 0)
    },
    copiarExterna: (clienteId, origem, externa) => copiarExterna(db, clienteId, origem, externa),
    copiarDoBanco: (clienteId, path) => copiarDoBanco(db, clienteId, path),
    async registrarUsada(clienteId, path) {
      const { error } = await db.from('fotos_usadas').insert({ cliente_id: clienteId, path })
      if (error) throw error
    },
    // o uso mais recente de cada foto (para o revezamento das fotos do item)
    async ultimoUso(clienteId, paths) {
      const uso: Record<string, string> = {}
      for (let i = 0; i < paths.length; i += PEDACO) {
        const linhas = await ler<{ path: string, usado_em: string }[]>(db.from('fotos_usadas').select('path, usado_em')
          .eq('cliente_id', clienteId).in('path', paths.slice(i, i + PEDACO)))
        for (const l of linhas ?? []) if (!uso[l.path] || l.usado_em > uso[l.path]) uso[l.path] = l.usado_em
      }
      return uso
    },
    // fotos já pegas por um post nesta execução (os posts de um lote rodam em paralelo)
    reservar: (clienteId, path) => {
      const chave = `${clienteId}|${path}`
      if (reservadas.has(chave)) return false
      reservadas.add(chave)
      return true
    },

    async gravar(post, campos) {
      const { data, error } = await db.rpc('gravar_post_ia', {
        p_id: post.id, p_ia_em: post.ia_em, p_legenda_lida: post.legenda, p_foto_lida: post.foto_path,
        p_estado_lido: post.estado, p_sem_foto_lido: post.sem_foto,
        p_titulo: campos.titulo, p_legenda: campos.legenda, p_hashtags: campos.hashtags, p_roteiro: campos.roteiro,
        p_foto_path: campos.foto_path,
      })
      if (error) throw error
      return data === true
    },
    async marcar(post, estado) {
      let q = db.from('posts').update({ ia_estado: estado }).eq('id', post.id).eq('ia_estado', 'trabalhando')
      q = post.ia_em ? q.eq('ia_em', post.ia_em) : q.is('ia_em', null)
      const { error } = await q
      if (error) throw error
    },
    hoje: () => hojeEmSaoPaulo(),
  }

  const pegar = async (n: number) => (await ler<PostDaFila[]>(db.rpc('pegar_posts_para_ia', { p_limite: n }))) ?? []
  return { deps, pegar }
}

async function trabalhar() {
  try {
    const { deps, pegar } = criarDeps()
    const contagem = await processarFila({
      pegar,
      melhorar: (post, prazo) => melhorarUmPost(deps, post, prazo),
      desistir: (post) => deps.marcar(post, 'desistiu'),
      agora: () => Date.now(),
    })
    if (Object.values(contagem).some((n) => n > 0)) console.log('melhorar-posts', JSON.stringify(contagem))
  } catch (e) {
    console.error('melhorar-posts', e)
  }
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') return responder(405, { erro: 'Método não permitido.' })
  if (!SEGREDO || req.headers.get('x-melhorar-secret') !== SEGREDO) return responder(401, { erro: 'Não autorizado.' })

  // responde já: o pg_net (5 s) e as cutucadas não ficam esperando o trabalho
  if (typeof EdgeRuntime !== 'undefined' && EdgeRuntime?.waitUntil) {
    EdgeRuntime.waitUntil(trabalhar())
    return responder(202, { ok: true })
  }
  await trabalhar()
  return responder(200, { ok: true })
})
