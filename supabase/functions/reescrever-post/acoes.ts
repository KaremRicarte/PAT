// Regras da função reescrever-post, sem nenhuma API do Deno (o Vitest importa este arquivo).
// Depois do "Trocar imagem", a IA reescreve na hora a legenda para combinar com a foto atual do post (spec §3.5).
// Qualquer falha da IA (sem chave, limite, recusa, tempo, erro) -> 200 { post: null }: a foto já trocou e o texto
// fica como estava. Grava só se o post continuar igual ao que foi lido (a ação do cliente vence).
import type { Resposta } from '../admin-clientes/acoes.ts'
import type { Estrategia, Pilar, Rede, Tom } from '../_shared/modelos/tipos.ts'
import type { PostGerado } from '../_shared/modelos/gerar.ts'
import { ramoValido } from '../_shared/modelos/ramos/index.ts'
import type { CamposDaIA } from '../_shared/ia/escrever.ts'
import { daPastaDoCliente, fotoEnviadaParaOPost, fotosDoProduto } from '../_shared/ia/entrada.ts'
import { fotoDoLugar, type FotosInfo } from '../_shared/ia/imagens.ts'
import { escreverNaHora, type DepsNaHora, type InfoFoto } from '../_shared/ia/naHora.ts'

export type PostParaReescrever = {
  id: string, mes_id: string, data: string, rede: Rede, tipo: PostGerado['tipo'], formato: PostGerado['formato'],
  pilar: Pilar, titulo: string, legenda: string, hashtags: string[] | null, roteiro: string | null,
  produto_id: string | null, ordem: number | null, foto_path: string | null, sem_foto: boolean,
  // numeric do Postgres pode chegar como texto
  preco_de: number | string | null, preco_por: number | string | null,
  estado: string, postado_em: string | null,
  // do mês do post
  cliente_id: string, estrategia: string,
}

export type DepsReescrever = DepsNaHora & {
  cliente: () => Promise<{ id: string, situacao: string, senha_provisoria: boolean, ramo: string | null } | null>,
  post: (id: string) => Promise<PostParaReescrever | null>,
  negocio: () => Promise<{ nome: string, insta: string | null, tom: Tom } | null>,
  produtos: () => Promise<{ id: string, nome: string, descricao: string | null, fotos: string[] | null, foto_path: string | null }[]>,
  // gravação condicional (gravar_reescrita_ia): true se o post ainda estava como foi lido
  gravar: (lido: PostParaReescrever, campos: CamposDaIA) => Promise<boolean>,
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const ESTRATEGIAS: readonly string[] = ['vender', 'crescer', 'credibilidade', 'tempo']
const r = (status: number, erro: string): Resposta => ({ status, corpo: { erro } })
// Post de outro cliente responde igual a post inexistente, para não revelar que o id existe.
const NAO_ACHEI = r(404, 'Post não encontrado.')
const SEM_MUDANCA: Resposta = { status: 200, corpo: { post: null } }

export async function reescreverPostDoCliente(entrada: unknown, deps: DepsReescrever): Promise<Resposta> {
  const cliente = await deps.cliente()
  if (!cliente || cliente.situacao !== 'ativo' || cliente.senha_provisoria) {
    return r(403, 'Seu acesso não permite mudar posts.')
  }
  const id = (entrada && typeof entrada === 'object' ? entrada as Record<string, unknown> : {}).post_id
  if (typeof id !== 'string' || !UUID.test(id)) return NAO_ACHEI
  const post = await deps.post(id)
  if (!post || post.cliente_id !== cliente.id) return NAO_ACHEI

  // Sem IA, ou um post cujo texto o cliente já aceitou (aprovado/postado): fica como está.
  if (!deps.chamar || !ramoValido(cliente.ramo) || !ESTRATEGIAS.includes(post.estrategia)) return SEM_MUDANCA
  if (!['gerado', 'reprovado'].includes(post.estado) || post.postado_em) return SEM_MUDANCA
  const ramo = cliente.ramo

  try {
    const [negocio, produtos] = await Promise.all([deps.negocio(), deps.produtos()])
    if (!negocio) return SEM_MUDANCA

    // A foto atual do post (a mesma regra da fila): "sem foto" -> só texto; a escolhida pelo cliente; senão a da vez
    // do serviço (pulando as reprovadas); post geral sem foto escolhida -> só texto. Só fotos da pasta do cliente.
    const doCliente = daPastaDoCliente(cliente.id)
    if (!post.sem_foto && post.foto_path && !doCliente(post.foto_path)) return SEM_MUDANCA
    let foto: { path: string, descricao: string | null } | null = null
    if (!post.sem_foto && post.foto_path) {
      // foto enviada para o post: a descrição guardada pode ser da foto anterior, então vai só a imagem
      const info: Record<string, InfoFoto> = fotoEnviadaParaOPost(cliente.id, post.foto_path) ? {} : await deps.fotosInfo([post.foto_path])
      foto = { path: post.foto_path, descricao: info[post.foto_path]?.descricao ?? null }
    } else if (!post.sem_foto && post.produto_id) {
      const comFotos = produtos.map((p) => ({ id: p.id, fotos: fotosDoProduto(p).filter(doCliente) }))
      const candidatas = comFotos.find((p) => p.id === post.produto_id)?.fotos ?? []
      const info: Record<string, InfoFoto> = candidatas.length ? await deps.fotosInfo(candidatas) : {}
      const fotosInfo: FotosInfo = Object.fromEntries(Object.entries(info).map(([p, i]) => [p, { serve: i.serve ?? undefined }]))
      const path = fotoDoLugar({ post: { produto_id: post.produto_id, foto_path: null, ordem: post.ordem }, produtos: comFotos, fotosInfo })
      if (path) foto = { path, descricao: info[path]?.descricao ?? null }
    }

    const escrito = await escreverNaHora(deps, {
      clienteId: cliente.id,
      dados: { ramo, estrategia: post.estrategia as Estrategia, negocio, produtos },
      post,
      foto,
    })
    if (!escrito) return SEM_MUDANCA
    if (!(await deps.gravar(post, escrito.campos))) return SEM_MUDANCA
    return { status: 200, corpo: { post: { id: post.id, ...escrito.campos, origem: 'ia', ia_estado: 'pronto' } } }
  } catch (e) {
    console.error('reescrever-post: falhou, o texto fica', cliente.id, post.id, e)
    return SEM_MUDANCA
  }
}
