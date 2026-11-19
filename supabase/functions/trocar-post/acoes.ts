// Regras da função trocar-post ("Gerar outro"), sem nenhuma API do Deno (o Vitest importa este arquivo).
// Escolhe o novo lugar com os modelos (gerarTroca) e pede o texto à IA na hora (spec §3.5); sem a IA, fica o modelo.
import type { Resposta } from '../admin-clientes/acoes.ts'
import type { Estrategia, Tom } from '../_shared/modelos/tipos.ts'
import { lerFrequencia } from '../_shared/modelos/tipos.ts'
import { RAMOS, ramoValido } from '../_shared/modelos/ramos/index.ts'
import type { Pacote, PostGerado } from '../_shared/modelos/gerar.ts'
import { gerarTroca } from '../_shared/modelos/troca.ts'
import { validarPost } from '../_shared/modelos/validar.ts'
import { daPastaDoCliente, fotoEnviadaParaOPost, fotosDoProduto } from '../_shared/ia/entrada.ts'
import { fotoDoLugar, type FotosInfo } from '../_shared/ia/imagens.ts'
import { escreverNaHora, type DepsNaHora, type InfoFoto } from '../_shared/ia/naHora.ts'

export type PostDoMes = {
  id: string, mes_id: string, data: string, rede: string, tipo: string, formato: string, horario: string,
  ordem: number, trocas: number, legenda: string, cliente_id: string, ano_mes: string, estrategia: string,
  produto_id: string | null, foto_path: string | null, sem_foto: boolean,
}
// Texto de modelo: origem 'modelo' e ia_estado 'pulado' (a fila não reescreve uma troca pedida pelo cliente).
// Texto da IA: origem 'ia', 'pronto', e a foto da qual a IA escreveu fica no post (null = só texto).
export type CamposTroca = Pick<PostGerado, 'titulo' | 'legenda' | 'hashtags' | 'roteiro' | 'pilar' | 'produto_id' | 'preco_de' | 'preco_por' | 'ocasiao'> &
  { estado: 'gerado', foto_path: string | null, sem_foto: false, trocas: number } &
  ({ origem: 'modelo', ia_estado: 'pulado' } | { origem: 'ia', ia_estado: 'pronto' })

export type ProdutoTroca = Pacote['produtos'][number] & { fotos?: string[] | null, foto_path?: string | null }

export type DepsTroca = DepsNaHora & {
  cliente: () => Promise<{ id: string, situacao: string, senha_provisoria: boolean, ramo: string | null, frequencia?: string | null } | null>,
  post: (id: string) => Promise<PostDoMes | null>,
  trocasDoMes: (mesId: string) => Promise<number>,
  negocio: () => Promise<{ nome: string, insta: string | null, tom: Tom, horario: string } | null>,
  produtos: () => Promise<ProdutoTroca[]>,
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
    negocio, produtos, frequencia: lerFrequencia(cliente.frequencia),
  }
  const alvo = {
    data: post.data, rede: post.rede, tipo: post.tipo, formato: post.formato, horario: post.horario,
    ordem: post.ordem, legenda: post.legenda,
  } as Pick<PostGerado, 'data' | 'rede' | 'tipo' | 'formato' | 'horario' | 'ordem' | 'legenda'>
  const novo = gerarTroca(pacote, alvo, post.trocas + 1)
  // Nenhum texto que o cliente ainda não viu: não grava e não conta a troca.
  if (!novo) return r(422, 'Não encontrei outro texto diferente para este post. Você pode usar "Só descartar".')
  const doCliente = [negocio.nome, ...produtos.flatMap((p) => [p.nome, p.descricao ?? ''])]
  const problemas = validarPost(novo, RAMOS[cliente.ramo], doCliente)
  if (problemas.length) {
    console.error('trocar-post: validação recusou o post', cliente.id, post.id, problemas)
    return r(500, 'Não foi possível gerar outro post.')
  }

  const modelo: CamposTroca = {
    titulo: novo.titulo, legenda: novo.legenda, hashtags: novo.hashtags, roteiro: novo.roteiro,
    pilar: novo.pilar, produto_id: novo.produto_id, preco_de: novo.preco_de, preco_por: novo.preco_por, ocasiao: novo.ocasiao,
    // sem a IA também fica a foto que o cliente escolheu, se o serviço do lugar não mudou (como no texto da IA)
    estado: 'gerado', foto_path: fotoEscolhida(cliente.id, post, novo), sem_foto: false, trocas: post.trocas + 1, origem: 'modelo', ia_estado: 'pulado',
  }
  const daIA = await textoDaIA(deps, cliente.id, cliente.ramo, post, novo, negocio, produtos)
  const campos: CamposTroca = daIA
    ? { ...modelo, ...daIA.campos, foto_path: daIA.fotoPath, origem: 'ia', ia_estado: 'pronto' }
    : modelo
  await deps.gravar(post.id, campos)
  const { cliente_id: _c, ano_mes: _a, estrategia: _e, ...lugar } = post
  return { status: 200, corpo: { post: { ...lugar, ...campos } } }
}

// A foto que o cliente escolheu no post vale no novo texto se o serviço do lugar não mudou (só da pasta dele).
function fotoEscolhida(clienteId: string, post: PostDoMes, novo: PostGerado): string | null {
  const mesmoServico = (post.produto_id ?? null) === (novo.produto_id ?? null)
  return !post.sem_foto && mesmoServico && post.foto_path && daPastaDoCliente(clienteId)(post.foto_path) ? post.foto_path : null
}

// O texto da IA para o novo lugar (mesmo serviço e preço que o modelo escolheu); null = fica o modelo.
// Foto: a que o cliente escolheu no post, se o serviço do lugar não mudou; senão a do serviço (fotoDoLugar,
// pulando as reprovadas). Só fotos da pasta do cliente.
async function textoDaIA(
  deps: DepsTroca, clienteId: string, ramo: string, post: PostDoMes, novo: PostGerado,
  negocio: Pacote['negocio'], produtos: ProdutoTroca[],
) {
  if (!deps.chamar) return null
  try {
    const doCliente = daPastaDoCliente(clienteId)
    const comFotos = produtos.map((p) => ({ id: p.id, fotos: fotosDoProduto(p).filter(doCliente) }))
    const escolhida = fotoEscolhida(clienteId, post, novo)
    const servico = novo.produto_id ? comFotos.find((p) => p.id === novo.produto_id) : null
    const candidatas = escolhida ? [escolhida] : servico?.fotos ?? []
    const info: Record<string, InfoFoto> = candidatas.length ? await deps.fotosInfo(candidatas) : {}
    const fotosInfo: FotosInfo = Object.fromEntries(Object.entries(info).map(([p, i]) => [p, { serve: i.serve ?? undefined }]))
    const path = fotoDoLugar({ post: { produto_id: novo.produto_id, foto_path: escolhida, ordem: post.ordem }, produtos: comFotos, fotosInfo })
    return await escreverNaHora(deps, {
      clienteId,
      dados: { ramo, estrategia: post.estrategia as Estrategia, negocio, produtos },
      post: novo,
      // foto enviada para o post: a descrição guardada pode ser da foto anterior, então vai só a imagem
      foto: path ? { path, descricao: fotoEnviadaParaOPost(clienteId, path) ? null : info[path]?.descricao ?? null } : null,
    })
  } catch (e) {
    console.error('trocar-post: IA falhou, fica o modelo', clienteId, post.id, e)
    return null
  }
}
