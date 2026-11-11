// Regras da função trocar-post ("Gerar outro"), sem nenhuma API do Deno (o Vitest importa este arquivo).
import type { Resposta } from '../admin-clientes/acoes.ts'
import type { Estrategia, Tom } from '../_shared/modelos/tipos.ts'
import { RAMOS, ramoValido } from '../_shared/modelos/ramos/index.ts'
import type { Pacote, PostGerado } from '../_shared/modelos/gerar.ts'
import { gerarTroca } from '../_shared/modelos/troca.ts'
import { validarPost } from '../_shared/modelos/validar.ts'

export type PostDoMes = {
  id: string, mes_id: string, data: string, rede: string, tipo: string, formato: string, horario: string,
  ordem: number, trocas: number, legenda: string, cliente_id: string, ano_mes: string, estrategia: string,
}
export type CamposTroca = Pick<PostGerado, 'titulo' | 'legenda' | 'hashtags' | 'roteiro' | 'pilar' | 'produto_id'> &
  { estado: 'gerado', foto_path: null, sem_foto: false, trocas: number }

export type DepsTroca = {
  cliente: () => Promise<{ id: string, situacao: string, senha_provisoria: boolean, ramo: string | null } | null>,
  post: (id: string) => Promise<PostDoMes | null>,
  trocasDoMes: (mesId: string) => Promise<number>,
  negocio: () => Promise<{ nome: string, insta: string | null, tom: Tom, horario: string } | null>,
  produtos: () => Promise<Pacote['produtos']>,
  gravar: (id: string, campos: CamposTroca) => Promise<void>,
}

export const LIMITE_TROCAS = 10
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const r = (status: number, erro: string): Resposta => ({ status, corpo: { erro } })
// Post de outro cliente responde igual a post inexistente, para não revelar que o id existe.
const NAO_ACHEI = r(404, 'Post não encontrado.')

export async function trocarPostDoCliente(entrada: unknown, deps: DepsTroca): Promise<Resposta> {
  const cliente = await deps.cliente()
  if (!cliente || cliente.situacao !== 'ativo' || cliente.senha_provisoria) {
    return r(403, 'Seu acesso não permite trocar posts.')
  }
  if (!ramoValido(cliente.ramo)) return r(400, 'Seu ramo ainda não foi definido. Fale com a administração.')

  const id = (entrada && typeof entrada === 'object' ? entrada as Record<string, unknown> : {}).post_id
  if (typeof id !== 'string' || !UUID.test(id)) return NAO_ACHEI
  const post = await deps.post(id)
  if (!post || post.cliente_id !== cliente.id) return NAO_ACHEI

  if ((await deps.trocasDoMes(post.mes_id)) >= LIMITE_TROCAS) {
    return r(429, `Você já usou as ${LIMITE_TROCAS} trocas deste mês.`)
  }

  const [negocio, produtos] = await Promise.all([deps.negocio(), deps.produtos()])
  if (!negocio || !produtos.length) return r(400, 'Complete o cadastro do seu negócio antes.')

  // O pacote usa o mês inteiro; gerarTroca acha o lugar do post mesmo se o mês foi gerado a partir do meio.
  const pacote: Pacote = {
    ramo: cliente.ramo, estrategia: post.estrategia as Estrategia, anoMes: post.ano_mes, inicio: `${post.ano_mes}-01`,
    negocio, produtos,
  }
  const alvo = {
    data: post.data, rede: post.rede, tipo: post.tipo, formato: post.formato, horario: post.horario,
    ordem: post.ordem, legenda: post.legenda,
  } as Pick<PostGerado, 'data' | 'rede' | 'tipo' | 'formato' | 'horario' | 'ordem' | 'legenda'>
  const novo = gerarTroca(pacote, alvo, post.trocas + 1)
  // Nenhum texto que o cliente ainda não viu: não grava e não conta a troca.
  if (!novo) return r(422, 'Não encontrei outro texto diferente para este post. Você pode usar "Só descartar".')
  const problemas = validarPost(novo, RAMOS[cliente.ramo])
  if (problemas.length) {
    console.error('trocar-post: validação recusou o post', cliente.id, post.id, problemas)
    return r(500, 'Não foi possível gerar outro post.')
  }

  const campos: CamposTroca = {
    titulo: novo.titulo, legenda: novo.legenda, hashtags: novo.hashtags, roteiro: novo.roteiro,
    pilar: novo.pilar, produto_id: novo.produto_id,
    estado: 'gerado', foto_path: null, sem_foto: false, trocas: post.trocas + 1,
  }
  await deps.gravar(post.id, campos)
  const { cliente_id: _c, ano_mes: _a, estrategia: _e, ...lugar } = post
  return { status: 200, corpo: { post: { ...lugar, ...campos } } }
}
