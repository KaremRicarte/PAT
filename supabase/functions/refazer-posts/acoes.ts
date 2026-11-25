// Regras da função refazer-posts, sem nenhuma API do Deno (o Vitest importa este arquivo).
// Depois de editar os itens, refaz os posts que ainda não foram postados e cujo dia não passou.
// Com { post_id }: refaz só aquele post ("Refazer este post"), com a estratégia do mês dele.
import type { Resposta } from '../admin-clientes/acoes.ts'
import type { Estrategia, Rede, Tom } from '../_shared/modelos/tipos.ts'
import { lerFrequencia } from '../_shared/modelos/tipos.ts'
import { RAMOS, ramoValido } from '../_shared/modelos/ramos/index.ts'
import type { Ocasiao, Pacote, PostGerado } from '../_shared/modelos/gerar.ts'
import { refazerPosts, refazerUmPost } from '../_shared/modelos/refazer.ts'
import { validarPost } from '../_shared/modelos/validar.ts'

export type PostQueFalta = {
  id: string, data: string, rede: Rede, tipo: PostGerado['tipo'], formato: PostGerado['formato'], horario: string,
  ordem: number, estado: string, postado_em: string | null, ano_mes: string, estrategia: string,
  // o que o post é hoje (para "Refazer este post" manter o mesmo item, pilar e fase da data)
  produto_id?: string | null, pilar?: PostGerado['pilar'], ocasiao?: Ocasiao | null, foto_path?: string | null, sem_foto?: boolean,
  // título atual (vira titulo_anterior no "Refazer este post", para a IA não repetir)
  titulo?: string | null,
}
export type CamposRefeitos = Pick<PostGerado, 'titulo' | 'legenda' | 'hashtags' | 'roteiro' | 'pilar' | 'produto_id' | 'preco_de' | 'preco_por' | 'ocasiao'> &
  // o post volta a ser de modelo e entra de novo na fila da IA (melhorar-posts)
  { estado: 'gerado', foto_path: string | null, sem_foto: boolean, origem: 'modelo', ia_estado: 'fila', titulo_anterior?: string | null }

export type DepsRefazer = {
  cliente: () => Promise<{ id: string, situacao: string, senha_provisoria: boolean, ramo: string | null, frequencia?: string | null } | null>,
  negocio: () => Promise<{ nome: string, insta: string | null, tom: Tom, horario: string } | null>,
  produtos: () => Promise<Pacote['produtos']>,
  hoje: () => string,
  // posts do cliente com data >= hoje e ainda não postados
  postsQueFaltam: (hoje: string) => Promise<PostQueFalta[]>,
  gravar: (mudancas: { id: string, campos: CamposRefeitos }[]) => Promise<void>,
  // fotos que saíram dos posts refeitos: entram em fotos_usadas, para o revezamento da IA escolher outras
  marcarUsadas: (paths: string[]) => Promise<void>,
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
    // "Refazer este post": a foto escolhida (foto_path; ausente = manter a atual) e, com dia, os outros posts do dia
    const fotoEscolhida = e.foto_path
    if (fotoEscolhida !== undefined && (typeof fotoEscolhida !== 'string' || !fotoEscolhida.startsWith(`${cliente.id}/`) || fotoEscolhida.includes('..'))) {
      return r(400, 'Foto inválida.')
    }
    // só posts que faltam (não postados, de hoje em diante) e deste cliente (postsQueFaltam já filtra)
    const faltam = await deps.postsQueFaltam(hoje)
    const post = faltam.find((p) => p.id === postId)
    if (!post) return r(404, 'Este post não pode mais ser refeito: já foi postado ou o dia passou.')
    const alvos = e.dia === true ? [post, ...faltam.filter((p) => p.data === post.data && p.id !== post.id)] : [post]

    const mudancas: { id: string, campos: CamposRefeitos }[] = []
    const usadas: string[] = []
    for (const alvo of alvos) {
      const clicado = alvo.id === post.id
      const pacote: Pacote = { ramo: cliente.ramo, estrategia: alvo.estrategia as Estrategia, anoMes: alvo.ano_mes, inicio: `${alvo.ano_mes}-01`, negocio, produtos, frequencia: lerFrequencia(cliente.frequencia) }
      const novo = refazerUmPost(pacote, { ...alvo, produto_id: alvo.produto_id ?? null, pilar: alvo.pilar ?? 'demo', ocasiao: alvo.ocasiao ?? null })
      const problemas = novo ? validarPost(novo, ramo, doCliente) : []
      if (!novo || problemas.length) {
        console.error('refazer-posts: não refiz o post', cliente.id, alvo.id, problemas)
        // o post clicado precisa sair; os outros do dia que falharem ficam como estavam
        if (clicado) return novo ? r(500, 'Não foi possível refazer este post.') : r(422, 'Não encontrei como refazer este post.')
        continue
      }
      const mesmo = (novo.produto_id ?? null) === (alvo.produto_id ?? null)
      const semFoto = mesmo ? Boolean(alvo.sem_foto) : false
      let foto: string | null
      if (clicado && typeof fotoEscolhida === 'string') foto = fotoEscolhida // a foto que o cliente escolheu
      else if (clicado) foto = mesmo ? alvo.foto_path ?? null : null // manter a foto atual (mesmo item)
      else foto = null // os outros do dia: a IA escolhe a próxima foto do revezamento
      // a foto que sai fica marcada como usada agora: o revezamento da IA escolhe outra
      if (alvo.foto_path && foto !== alvo.foto_path) usadas.push(alvo.foto_path)
      mudancas.push({ id: alvo.id, campos: {
        titulo: novo.titulo, legenda: novo.legenda, hashtags: novo.hashtags, roteiro: novo.roteiro,
        pilar: novo.pilar, produto_id: novo.produto_id, preco_de: novo.preco_de, preco_por: novo.preco_por, ocasiao: novo.ocasiao,
        estado: 'gerado', foto_path: semFoto ? null : foto, sem_foto: semFoto,
        origem: 'modelo', ia_estado: 'fila', titulo_anterior: alvo.titulo ?? null,
      } })
    }
    await deps.gravar(mudancas)
    if (usadas.length) {
      try { await deps.marcarUsadas([...new Set(usadas)]) } catch (erro) { console.error('refazer-posts: não marquei as fotos usadas', erro) }
    }
    return { status: 200, corpo: { refeitos: mudancas.length } }
  }

  const alvos = postsDoModo(await deps.postsQueFaltam(hoje), modo as string, hoje)

  // Um mês por vez: cada mês tem a estratégia dele.
  const porMes = new Map<string, PostQueFalta[]>()
  for (const p of alvos) porMes.set(p.ano_mes, [...(porMes.get(p.ano_mes) ?? []), p])

  const mudancas: { id: string, campos: CamposRefeitos }[] = []
  for (const [anoMes, posts] of porMes) {
    const pacote: Pacote = { ramo: cliente.ramo, estrategia: posts[0].estrategia as Estrategia, anoMes, inicio: `${anoMes}-01`, negocio, produtos, frequencia: lerFrequencia(cliente.frequencia) }
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
