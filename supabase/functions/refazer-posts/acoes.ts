// Regras da função refazer-posts, sem nenhuma API do Deno (o Vitest importa este arquivo).
// Depois de editar os itens, refaz os posts que ainda não foram postados e cujo dia não passou.
// Com { post_id }: refaz só aquele post ("Refazer este post"), com a estratégia do mês dele.
import type { Resposta } from '../admin-clientes/acoes.ts'
import type { Estrategia, Rede, Tom } from '../_shared/modelos/tipos.ts'
import { RAMOS, ramoValido } from '../_shared/modelos/ramos/index.ts'
import type { Ocasiao, Pacote, PostGerado } from '../_shared/modelos/gerar.ts'
import { refazerPosts, refazerUmPost } from '../_shared/modelos/refazer.ts'
import { validarPost } from '../_shared/modelos/validar.ts'

export type PostQueFalta = {
  id: string, data: string, rede: Rede, tipo: PostGerado['tipo'], formato: PostGerado['formato'], horario: string,
  ordem: number, estado: string, postado_em: string | null, ano_mes: string, estrategia: string,
  // o que o post é hoje (para "Refazer este post" manter o mesmo item, pilar e fase da data)
  produto_id?: string | null, pilar?: PostGerado['pilar'], ocasiao?: Ocasiao | null, foto_path?: string | null, sem_foto?: boolean,
}
export type CamposRefeitos = Pick<PostGerado, 'titulo' | 'legenda' | 'hashtags' | 'roteiro' | 'pilar' | 'produto_id' | 'preco_de' | 'preco_por' | 'ocasiao'> &
  // o post volta a ser de modelo e entra de novo na fila da IA (melhorar-posts)
  { estado: 'gerado', foto_path: string | null, sem_foto: boolean, origem: 'modelo', ia_estado: 'fila' }

export type DepsRefazer = {
  cliente: () => Promise<{ id: string, situacao: string, senha_provisoria: boolean, ramo: string | null } | null>,
  negocio: () => Promise<{ nome: string, insta: string | null, tom: Tom, horario: string } | null>,
  produtos: () => Promise<Pacote['produtos']>,
  hoje: () => string,
  // posts do cliente com data >= hoje e ainda não postados
  postsQueFaltam: (hoje: string) => Promise<PostQueFalta[]>,
  gravar: (mudancas: { id: string, campos: CamposRefeitos }[]) => Promise<void>,
}

export const MODOS = ['nao_aprovados', 'todos'] as const
const r = (status: number, erro: string): Resposta => ({ status, corpo: { erro } })
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

// Quais posts cada modo refaz: nunca os postados nem os de dias que já passaram.
export function postsDoModo<T extends Pick<PostQueFalta, 'data' | 'estado' | 'postado_em'>>(posts: T[], modo: string, hoje: string): T[] {
  return posts.filter((p) => !p.postado_em && p.data >= hoje && (modo === 'todos' || p.estado !== 'aprovado'))
}

export async function refazerPostsDoCliente(entrada: unknown, deps: DepsRefazer): Promise<Resposta> {
  const cliente = await deps.cliente()
  if (!cliente || cliente.situacao !== 'ativo' || cliente.senha_provisoria) {
    return r(403, 'Seu acesso não permite refazer posts.')
  }
  if (!ramoValido(cliente.ramo)) return r(400, 'Seu ramo ainda não foi definido. Fale com a administração.')

  const e = entrada && typeof entrada === 'object' ? entrada as Record<string, unknown> : {}
  const modo = e.modo, postId = e.post_id
  if (postId !== undefined) {
    if (typeof postId !== 'string' || !UUID.test(postId)) return r(404, 'Post não encontrado.')
  } else if (typeof modo !== 'string' || !(MODOS as readonly string[]).includes(modo)) return r(400, 'Escolha o que refazer.')

  const [negocio, produtos] = await Promise.all([deps.negocio(), deps.produtos()])
  if (!negocio || !produtos.length) return r(400, 'Complete o cadastro do seu negócio antes.')

  const hoje = deps.hoje()
  const ramo = RAMOS[cliente.ramo]
  const doCliente = [negocio.nome, ...produtos.flatMap((p) => [p.nome, p.descricao ?? ''])]

  if (typeof postId === 'string') {
    // só um post: dos que faltam (não postado, de hoje em diante) e deste cliente (postsQueFaltam já filtra)
    const post = (await deps.postsQueFaltam(hoje)).find((p) => p.id === postId)
    if (!post) return r(404, 'Este post não pode mais ser refeito: já foi postado ou o dia passou.')
    const pacote: Pacote = { ramo: cliente.ramo, estrategia: post.estrategia as Estrategia, anoMes: post.ano_mes, inicio: `${post.ano_mes}-01`, negocio, produtos }
    const novo = refazerUmPost(pacote, { ...post, produto_id: post.produto_id ?? null, pilar: post.pilar ?? 'demo', ocasiao: post.ocasiao ?? null })
    if (!novo) return r(422, 'Não encontrei como refazer este post.')
    const problemas = validarPost(novo, ramo, doCliente)
    if (problemas.length) {
      console.error('refazer-posts: validação recusou o post', cliente.id, post.id, problemas)
      return r(500, 'Não foi possível refazer este post.')
    }
    // mesmo item: a foto que o cliente escolheu (ou o "sem foto") continua
    const mesmo = (novo.produto_id ?? null) === (post.produto_id ?? null)
    await deps.gravar([{ id: post.id, campos: {
      titulo: novo.titulo, legenda: novo.legenda, hashtags: novo.hashtags, roteiro: novo.roteiro,
      pilar: novo.pilar, produto_id: novo.produto_id, preco_de: novo.preco_de, preco_por: novo.preco_por, ocasiao: novo.ocasiao,
      estado: 'gerado', foto_path: mesmo ? post.foto_path ?? null : null, sem_foto: mesmo ? Boolean(post.sem_foto) : false,
      origem: 'modelo', ia_estado: 'fila',
    } }])
    return { status: 200, corpo: { refeitos: 1 } }
  }

  const alvos = postsDoModo(await deps.postsQueFaltam(hoje), modo as string, hoje)

  // Um mês por vez: cada mês tem a estratégia dele.
  const porMes = new Map<string, PostQueFalta[]>()
  for (const p of alvos) porMes.set(p.ano_mes, [...(porMes.get(p.ano_mes) ?? []), p])

  const mudancas: { id: string, campos: CamposRefeitos }[] = []
  for (const [anoMes, posts] of porMes) {
    const pacote: Pacote = { ramo: cliente.ramo, estrategia: posts[0].estrategia as Estrategia, anoMes, inicio: `${anoMes}-01`, negocio, produtos }
    refazerPosts(pacote, posts).forEach((novo, i) => {
      const post = posts[i]
      if (!novo) return
      const problemas = validarPost(novo, ramo, doCliente)
      // post recusado pela validação fica como estava, em vez de derrubar os outros
      if (problemas.length) return console.error('refazer-posts: validação recusou o post', cliente.id, post.id, problemas)
      mudancas.push({ id: post.id, campos: {
        titulo: novo.titulo, legenda: novo.legenda, hashtags: novo.hashtags, roteiro: novo.roteiro,
        pilar: novo.pilar, produto_id: novo.produto_id, preco_de: novo.preco_de, preco_por: novo.preco_por, ocasiao: novo.ocasiao,
        estado: 'gerado', foto_path: null, sem_foto: false, origem: 'modelo', ia_estado: 'fila',
      } })
    })
  }

  if (mudancas.length) await deps.gravar(mudancas)
  return { status: 200, corpo: { refeitos: mudancas.length } }
}
