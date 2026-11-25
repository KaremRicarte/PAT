// Regras da fila melhorar-posts, sem nenhuma API do Deno (o Vitest importa este arquivo).
// Em segundo plano, a IA reescreve os posts de modelo (spec §3.2-3.4, §7 itens 1-3, 7, 9-16): escolhe a foto,
// escreve a partir dela e grava SÓ se o post continuar igual ao que foi lido (a ação do cliente sempre vence).
import type { Estrategia, Pilar, Rede, Tom } from '../_shared/modelos/tipos.ts'
import type { Ocasiao, PostGerado } from '../_shared/modelos/gerar.ts'
import { RAMOS, ramoValido } from '../_shared/modelos/ramos/index.ts'
import { escreverPost, type CamposDaIA, type ChamarIA, type ConteudoIA } from '../_shared/ia/escrever.ts'
import { caminhoSeguro, fotoIlustrativa, fotosDoProduto, montarEntradaPost, SEM_DESCRICAO } from '../_shared/ia/entrada.ts'
import { criarPalavras } from '../_shared/ia/palavras.ts'
import { descreverFoto } from '../_shared/ia/descrever.ts'
import {
  escolherImagemGeral, indiceDoRevezamento, temaDaImagem,
  type DepsImagens, type ImagemEscolhida,
} from '../_shared/ia/imagens.ts'
import { custoImagemGerada } from '../_shared/ia/custo.ts'
import { comLimiteEUso, LIMITE_MENSAL, type RegistroUso, type TipoUso } from '../_shared/ia/uso.ts'
import { INSTRUCOES_ESCOLHA } from '../_shared/ia/instrucoes.ts'

// Linha de posts devolvida por pegar_posts_para_ia (já marcada 'trabalhando', com ia_em desta execução).
export type PostDaFila = {
  id: string, mes_id: string, data: string, rede: Rede, tipo: PostGerado['tipo'], formato: PostGerado['formato'],
  pilar: Pilar, titulo: string, legenda: string, hashtags: string[] | null, roteiro: string | null,
  produto_id: string | null, ordem: number | null, foto_path: string | null,
  // o cliente marcou "sem foto" (ramos só de texto): o post fica sem foto
  sem_foto: boolean,
  // numeric do Postgres pode chegar como texto
  preco_de: number | string | null, preco_por: number | string | null,
  // data especial do post (jsonb): a IA liga o texto à data
  ocasiao?: Ocasiao | null,
  // título de antes do "Refazer" (vem de pegar_posts_para_ia, que devolve a linha inteira de posts)
  titulo_anterior?: string | null,
  estado: string, postado_em: string | null, ia_em: string | null,
}

export type ProdutoDoCliente = { id: string, nome: string, descricao: string | null, fotos: string[] | null, foto_path: string | null, pacote?: unknown }
export type Contexto = {
  clienteId: string, situacao: string, ramo: string | null, estrategia: string,
  negocio: { nome: string, insta: string | null, tom: Tom, fotos: string[] | null } | null,
  produtos: ProdutoDoCliente[],
}
export type InfoFoto = { descricao: string | null, serve: boolean | null }
export type LinhaFotoIA = {
  path: string, cliente_id: string, origem: 'cliente' | 'banco' | 'pexels' | 'pixabay' | 'gerada', ramo: string | null,
  externo_id?: string, autor?: string | null, descricao: string, serve: boolean, motivo: string | null,
}
export type CamposGravados = CamposDaIA & { foto_path: string | null, origem: 'ia', ia_estado: 'pronto' }
// adiado = sem tempo nesta execução: volta para a fila, intacto, para a próxima
// ocupado = a API está sobrecarregada (429, 529, 5xx): volta para a fila e a execução não pega mais lotes
export type Resultado = 'pronto' | 'desistiu' | 'cliente-mexeu' | 'adiado' | 'ocupado'

export type DepsMelhorar = Omit<DepsImagens, 'escolher' | 'palavras' | 'gerar'> & {
  // Gera a imagem (fal.ai) em até `timeoutMs`; null = sem chave ou falhou. `bloqueada` = filtro de conteúdo do provedor.
  gerarImagem: ((prompt: string, formato: 'feed' | 'vertical', timeoutMs: number) =>
    Promise<{ id: string, url: string, largura: number, altura: number, bloqueada: boolean } | null>) | null,
  // null = sem ANTHROPIC_API_KEY: nada de IA, o post desiste (fica o modelo e a faixa "Melhorando…" termina).
  // Recebe o tempo máximo da chamada (cortado pelo prazo da execução).
  chamar: ((timeoutMs: number) => ChamarIA) | null,
  // relógio (ms), para o prazo da execução
  agora: () => number,
  contarNoMes: (clienteId: string) => Promise<number>,
  registrarUso: (r: RegistroUso) => Promise<void>,
  // mês do post -> cliente, ramo, estratégia, negócio e produtos
  contexto: (mesId: string) => Promise<Contexto | null>,
  // linhas de fotos_ia destes caminhos (os que não estão lá ficam de fora)
  fotosInfo: (paths: string[]) => Promise<Record<string, InfoFoto>>,
  // URL assinada no bucket marcas; null se o arquivo não existe
  urlAssinada: (path: string) => Promise<string | null>,
  gravarFoto: (linha: LinhaFotoIA) => Promise<void>,
  copiarExterna: (clienteId: string, origem: 'pexels' | 'pixabay' | 'gerada', externa: { id: string, url: string }) => Promise<string | null>,
  copiarDoBanco: (clienteId: string, pathNoBanco: string) => Promise<string | null>,
  // fotos_usadas: fotos do banco próprio (janela de 90 dias) e fotos dos itens do cliente (revezamento)
  registrarUsada: (clienteId: string, path: string) => Promise<void>,
  // último uso (usado_em mais recente) de cada caminho em fotos_usadas; caminho nunca usado fica de fora
  ultimoUso: (clienteId: string, paths: string[]) => Promise<Record<string, string>>,
  // reserva a foto para um post desta execução; false = outro post desta execução já pegou
  reservar: (clienteId: string, path: string) => boolean,
  // gravação condicional: true se pegou a linha (legenda, foto, sem_foto, estado e postado iguais ao lido,
  // e ainda 'trabalhando' com o mesmo ia_em)
  gravar: (post: PostDaFila, campos: CamposGravados) => Promise<boolean>,
  // muda só ia_estado, e só se o post ainda estiver 'trabalhando' com o mesmo ia_em ('fila' = adiado)
  marcar: (post: PostDaFila, estado: 'desistiu' | 'pulado' | 'fila') => Promise<void>,
  hoje: () => string,
}

const ESTRATEGIAS: readonly string[] = ['vender', 'crescer', 'credibilidade', 'tempo']
// post de tema geral: foto do cliente usada há menos que isso não volta (o "Refazer" troca a imagem de verdade)
const DIAS_SEM_REPETIR_DO_CLIENTE = 7
// a data (AAAA-MM-DD) de n dias antes de hoje
const desdeDias = (hoje: string, n: number) => new Date(Date.parse(`${hoje}T12:00:00Z`) - n * 86_400_000).toISOString().slice(0, 10)
// fotos do cliente ainda sem descrição que um post de tema geral descreve na hora (as outras ficam para os próximos)
const DESCREVER_POR_POST = 2

// ---------- A IA escolhendo a imagem (DepsImagens.escolher) ----------

export const ESQUEMA_ESCOLHA = {
  type: 'object',
  properties: {
    id: { anyOf: [{ type: 'string' }, { type: 'null' }], description: 'Id da candidata escolhida, exatamente como recebido; null se nenhuma serve.' },
  },
  required: ['id'],
  additionalProperties: false,
} as const

const MAX_IMAGENS = 8
const MAX_DESCRICOES = 40

export function criarEscolher(chamar: ChamarIA): DepsImagens['escolher'] {
  return async (candidatas, tema) => {
    const comImagem = candidatas.filter((c) => c.url).slice(0, MAX_IMAGENS)
    const soDescricao = candidatas.filter((c) => !c.url && c.descricao).slice(0, MAX_DESCRICOES)
    const lista = [...comImagem, ...soDescricao]
    if (!lista.length) return null
    const conteudo: ConteudoIA[] = []
    for (const c of comImagem) {
      conteudo.push({ tipo: 'imagem', url: c.url! })
      conteudo.push({ tipo: 'texto', texto: `Imagem acima: candidata id "${c.id}"${c.descricao ? ` (${c.descricao})` : ''}.` })
    }
    if (soDescricao.length) {
      conteudo.push({ tipo: 'texto', texto: ['Candidatas pela descrição:', ...soDescricao.map((c) => `- id "${c.id}": ${c.descricao}`)].join('\n') })
    }
    conteudo.push({ tipo: 'texto', texto: `Tema do post: ${tema || 'post do negócio'}.\nEscolha a candidata que melhor ilustra o tema, ou null.` })
    const r = await chamar({ sistema: INSTRUCOES_ESCOLHA, conteudo, esquema: ESQUEMA_ESCOLHA, maxTokens: 8000, esforco: 'low' })
    if (!r.ok || !r.dados || typeof r.dados !== 'object') return null
    const id = (r.dados as Record<string, unknown>).id
    return typeof id === 'string' && lista.some((c) => c.id === id) ? id : null
  }
}

// ---------- Tempo ----------

// Tempo máximo de uma chamada à IA (= TEMPO_FILA_MS dos adaptadores); cada chamada é cortada pelo prazo da execução.
export const TEMPO_MAX_CHAMADA_MS = 60_000
// folga antes do prazo, para gravar o resultado
export const MARGEM_MS = 5_000
// menos que isto não vale começar uma chamada
export const MIN_CHAMADA_MS = 15_000
// tempo guardado para escrever o post: os passos antes (descrever foto, escolher imagem) não podem comê-lo
export const RESERVA_ESCRITA_MS = 45_000
// tempo guardado para copiar a imagem gerada (copiarExterna leva até 15 s) depois de paga: sem ele o post seria adiado com a imagem já cobrada
export const RESERVA_COPIA_MS = 15_000

class SemTempo extends Error {}
// a API respondeu 'ocupado': o post volta para a fila (escreverPost/descreverFoto não pegam esta exceção)
class Ocupado extends Error {}

// ---------- Um post ----------

// `prazo` = Date/agora() em ms até quando a execução pode trabalhar. Sem tempo para fazer direito: o post volta
// para a fila intacto ('adiado') e a próxima execução o pega.
export async function melhorarUmPost(deps: DepsMelhorar, post: PostDaFila, prazo = Number.POSITIVE_INFINITY): Promise<Resultado> {
  const desistir = async (): Promise<Resultado> => { await deps.marcar(post, 'desistiu'); return 'desistiu' }
  const adiar = async (): Promise<Resultado> => { await deps.marcar(post, 'fila'); return 'adiado' }
  const devolver = async (): Promise<Resultado> => { await deps.marcar(post, 'fila'); return 'ocupado' }

  if (!deps.chamar) return desistir()
  const restante = () => prazo - deps.agora()
  if (restante() < RESERVA_ESCRITA_MS) return adiar()
  try {
    return await melhorarComPrazo(deps, post, restante, desistir)
  } catch (e) {
    if (e instanceof SemTempo) return adiar()
    if (e instanceof Ocupado) return devolver()
    throw e
  }
}

async function melhorarComPrazo(
  deps: DepsMelhorar, post: PostDaFila, restante: () => number, desistir: () => Promise<Resultado>,
): Promise<Resultado> {
  const ctx = await deps.contexto(post.mes_id)
  if (!ctx || ctx.situacao !== 'ativo' || !ramoValido(ctx.ramo) || !ctx.negocio || !ESTRATEGIAS.includes(ctx.estrategia)) {
    return desistir()
  }
  const { clienteId, negocio } = ctx
  const ramo = ctx.ramo as string
  const pasta = `${clienteId}/`
  // só fotos da pasta do cliente vão para a IA ou para o post
  const doCliente = (p: string) => p.startsWith(pasta) && caminhoSeguro(p)
  const semFoto = post.sem_foto === true
  if (!semFoto && post.foto_path && !doCliente(post.foto_path)) return desistir()
  // ramos só de texto (advocacia, psicologia): post geral fica só texto, como fotoDoPost em situacao.js
  const soTexto = RAMOS[ramo].textOnly

  // limite do mês já estourado: nem procura imagem
  if ((await deps.contarNoMes(clienteId)) >= LIMITE_MENSAL) return desistir()

  // Cada chamada: tempo cortado pelo prazo, guardando `reserva` para o que vem depois. Sem tempo -> SemTempo
  // (o post é adiado sem gastar a chamada). Tempo esgotado numa chamada que cortamos também é falta de tempo.
  const chamada = (tipo: TipoUso, reserva: number): ChamarIA => async (pedido) => {
    const ms = Math.min(TEMPO_MAX_CHAMADA_MS, restante() - reserva - MARGEM_MS)
    if (ms < MIN_CHAMADA_MS) throw new SemTempo()
    const r = await comLimiteEUso(deps.chamar!(ms), {
      clienteId, tipo, registrar: deps.registrarUso, contarNoMes: deps.contarNoMes,
    })(pedido)
    if (!r.ok && r.motivo === 'tempo' && ms < TEMPO_MAX_CHAMADA_MS) throw new SemTempo()
    if (!r.ok && r.motivo === 'ocupado') throw new Ocupado()
    return r
  }
  const chamarFoto = chamada('foto', RESERVA_ESCRITA_MS)
  const chamarImagem = chamada('imagem', RESERVA_ESCRITA_MS)
  const chamarPost = chamada('post', 0)

  // Imagem gerada: o tempo da chamada é cortado pelo prazo (sem tempo, o post é adiado); o custo é registrado
  // mesmo se o provedor bloqueou o conteúdo.
  const gerar: DepsImagens['gerar'] = deps.gerarImagem ? async (prompt, formato) => {
    const ms = Math.min(30_000, restante() - RESERVA_ESCRITA_MS - RESERVA_COPIA_MS - MARGEM_MS)
    if (ms < 10_000) throw new SemTempo()
    const g = await deps.gerarImagem!(prompt, formato, ms)
    if (!g) return null
    try {
      await deps.registrarUso({ clienteId, tipo: 'gerada', tokensEntrada: 0, tokensSaida: 0, custoUsd: custoImagemGerada(g.largura, g.altura) })
    } catch (e) { console.error('melhorar-posts: não consegui registrar o uso da imagem gerada', e) }
    return g.bloqueada ? null : { id: g.id, url: g.url }
  } : null

  const produtos = ctx.produtos.map((p) => ({ ...p, fotos: fotosDoProduto(p).filter(doCliente), foto_path: null }))
  const produto = post.produto_id ? produtos.find((p) => p.id === post.produto_id) ?? null : null
  const minhasFotos = (negocio.fotos ?? []).filter(doCliente)

  const candidatas = semFoto ? [] : [...new Set([
    ...(post.foto_path ? [post.foto_path] : []),
    ...(produto ? produto.fotos : soTexto ? [] : [...minhasFotos, ...produtos.flatMap((p) => p.fotos)]),
  ])]
  const info: Record<string, InfoFoto> = candidatas.length ? { ...(await deps.fotosInfo(candidatas)) } : {}

  // Descrição da foto: a de fotos_ia; senão descreve agora e guarda (uma vez por foto, spec §7 item 11).
  const contextoFoto = produto ? `Foto do serviço "${produto.nome}" de ${negocio.nome}.` : `Foto do negócio ${negocio.nome}.`
  const descrita = async (path: string): Promise<InfoFoto | null> => {
    if (info[path]?.descricao) return info[path]
    // cópias de banco/Pexels/Pixabay já entram descritas; não viram "foto do cliente"
    if (path.startsWith(`${pasta}banco/`)) return null
    const url = await deps.urlAssinada(path)
    if (!url) return null
    const d = await descreverFoto(chamarFoto, { url, contexto: contextoFoto })
    if (!d) return null
    await deps.gravarFoto({ path, cliente_id: clienteId, origem: 'cliente', ramo, descricao: d.descricao, serve: d.serve, motivo: d.motivo })
    info[path] = { descricao: d.descricao, serve: d.serve }
    return info[path]
  }

  let foto: { path: string, descricao: string } | null = null
  // foto do item escolhida pelo revezamento (para marcar como usada depois de gravar)
  let fotoDoItem = null as string | null
  if (semFoto) {
    // sem foto: só texto
  } else if (post.foto_path) {
    // o cliente escolheu a foto do post ("Trocar imagem"): a IA escreve a partir dela
    const d = await descrita(post.foto_path)
    foto = { path: post.foto_path, descricao: d?.descricao ?? SEM_DESCRICAO }
  } else if (post.produto_id) {
    // post de serviço: as fotos do serviço que servem, começando pela da vez (revezamento por ordem e mês) e depois
    // pelas que o cliente usou há mais tempo (nunca usadas primeiro). Fotos reservadas por outro post desta execução
    // ficam para o fim; reprovadas (inclusive agora) são puladas.
    const servem = (produto?.fotos ?? []).filter((p) => info[p]?.serve !== false)
    const i0 = indiceDoRevezamento(post.ordem, post.data, servem.length)
    const daVez = i0 < 0 ? [] : [...servem.slice(i0), ...servem.slice(0, i0)]
    // sem saber o uso (erro de leitura), segue só com o revezamento: o post não perde a versão da IA por isso
    const uso: Record<string, string> = daVez.length
      ? await deps.ultimoUso(clienteId, daVez).catch((e) => { console.error('melhorar-posts: não consegui ler o uso das fotos', e); return {} })
      : {}
    const ordem = [...daVez].sort((a, b) => (uso[a] ?? '').localeCompare(uso[b] ?? ''))
    // reserva uma por vez (sem await entre olhar e reservar), para dois posts em paralelo não pegarem a mesma
    const tentadas = new Set<string>()
    const tentar = async (path: string) => {
      tentadas.add(path)
      const d = await descrita(path)
      if (d?.serve === false) return false
      foto = { path, descricao: d?.descricao ?? SEM_DESCRICAO }
      fotoDoItem = path
      return true
    }
    let achou = false
    for (const path of ordem) {
      if (!deps.reservar(clienteId, path)) continue
      if ((achou = await tentar(path))) break
    }
    // todas reservadas por outros posts: repete a foto, na mesma ordem
    if (!achou) for (const path of ordem) if (!tentadas.has(path) && await tentar(path)) break
  } else if (!soTexto) {
    // post de tema geral: fotos do cliente -> banco próprio -> Pexels -> Pixabay -> imagem gerada -> só texto
    let descrever = DESCREVER_POR_POST
    for (const p of candidatas) {
      if (info[p]?.descricao || descrever <= 0) continue
      descrever--
      await descrita(p)
    }
    // fotos do cliente usadas há poucos dias (num post ou tiradas de um post refeito) ficam de fora: a IA escolhe outra
    const usoGeral = candidatas.length
      ? await deps.ultimoUso(clienteId, candidatas).catch((e) => { console.error('melhorar-posts: não consegui ler o uso das fotos', e); return {} as Record<string, string> })
      : {}
    const recente = (p: string) => Boolean(usoGeral[p]) && usoGeral[p].slice(0, 10) >= desdeDias(deps.hoje(), DIAS_SEM_REPETIR_DO_CLIENTE)
    const fotosDoCliente = candidatas.filter((p) => info[p]?.descricao && !recente(p))
      .map((p) => ({ path: p, descricao: info[p].descricao as string, serve: info[p].serve !== false, doNegocio: minhasFotos.includes(p) }))
    const palavras = criarPalavras(chamarImagem)
    const escolhida = await escolherImagemGeral({
      ...deps, escolher: criarEscolher(chamarImagem), palavras: (tema) => palavras(tema, ramo), gerar,
    }, {
      clienteId, ramo, temaDoPost: temaDaImagem(post), fotosDoCliente, hoje: deps.hoje(),
      aproximacao: post.pilar === 'aprox', formato: post.tipo === 'feed' ? 'feed' : 'vertical',
    })
    if (escolhida) foto = await trazerParaOCliente(deps, clienteId, ramo, escolhida)
  }

  const url = foto ? await deps.urlAssinada(foto.path) : null
  const fotoPath = semFoto ? null : post.foto_path ?? (url ? foto!.path : null)

  const entrada = montarEntradaPost(
    { ramo, estrategia: ctx.estrategia as Estrategia, negocio, produtos: ctx.produtos },
    post, foto && url ? { url, descricao: foto.descricao, ilustrativa: fotoIlustrativa(clienteId, foto.path) } : null)
  const escrito = await escreverPost(chamarPost, entrada)
  if (!escrito) return desistir()

  const pegou = await deps.gravar(post, { ...escrito.post, foto_path: fotoPath, origem: 'ia', ia_estado: 'pronto' })
  if (pegou) {
    // a foto do item entrou no post: fica marcada como usada agora, para o revezamento dos próximos posts
    if (fotoDoItem && fotoPath === fotoDoItem) {
      try { await deps.registrarUsada(clienteId, fotoDoItem) } catch (e) { console.error('melhorar-posts: não consegui registrar a foto usada', e) }
    }
    return 'pronto'
  }
  // o cliente mexeu no post enquanto a IA escrevia: o que ele fez vence; o post sai da fila sem ser sobrescrito
  await deps.marcar(post, 'pulado')
  return 'cliente-mexeu'
}

// Foto do banco próprio ou de fora: copiada para a pasta do cliente (o post guarda só o caminho no Storage, nunca a URL).
async function trazerParaOCliente(
  deps: DepsMelhorar, clienteId: string, ramo: string, e: ImagemEscolhida,
): Promise<{ path: string, descricao: string } | null> {
  if (e.origem === 'cliente') return { path: e.path, descricao: e.descricao }
  try {
    if (e.origem === 'banco') {
      const path = await deps.copiarDoBanco(clienteId, e.path)
      if (!path) return null
      await deps.registrarUsada(clienteId, e.path)
      await deps.gravarFoto({ path, cliente_id: clienteId, origem: 'banco', ramo, descricao: e.descricao, serve: true, motivo: null })
      return { path, descricao: e.descricao }
    }
    if (!e.externo) return null
    const path = await deps.copiarExterna(clienteId, e.origem, { id: e.externo.id, url: e.externo.url })
    if (!path) return null
    // guarda a origem, o id e o autor: é o que impede a mesma foto de ir para outro cliente
    await deps.gravarFoto({ path, cliente_id: clienteId, origem: e.origem, ramo, externo_id: e.externo.id,
      autor: e.origem === 'gerada' ? null : e.externo.autor, descricao: e.descricao, serve: true, motivo: null })
    return { path, descricao: e.descricao }
  } catch (erro) {
    // ex.: outro cliente pegou a mesma foto ao mesmo tempo (unique de fotos_ia): segue só com texto
    console.error('melhorar-posts: não consegui trazer a imagem', e.origem, erro)
    return null
  }
}

// ---------- A fila ----------

export const LOTE = 3
// a função trabalha até ~110 s; um lote novo só começa se ainda sobra tempo para terminá-lo
export const TEMPO_TOTAL_MS = 110_000
export const MARGEM_LOTE_MS = 50_000

export type Contagem = Record<Resultado | 'erro', number>

export async function processarFila(d: {
  pegar: (limite: number) => Promise<PostDaFila[]>,
  melhorar: (post: PostDaFila, prazo: number) => Promise<Resultado>,
  // erro inesperado num post: ele desiste (fica o modelo) em vez de voltar à fila para sempre
  desistir: (post: PostDaFila) => Promise<void>,
  agora: () => number,
}): Promise<Contagem> {
  const contagem: Contagem = { pronto: 0, desistiu: 0, 'cliente-mexeu': 0, adiado: 0, ocupado: 0, erro: 0 }
  const inicio = d.agora()
  const prazo = inicio + TEMPO_TOTAL_MS
  while (d.agora() - inicio < TEMPO_TOTAL_MS - MARGEM_LOTE_MS) {
    const posts = await d.pegar(LOTE)
    if (!posts.length) break
    await Promise.all(posts.map(async (post) => {
      try {
        contagem[await d.melhorar(post, prazo)]++
      } catch (e) {
        contagem.erro++
        console.error('melhorar-posts: erro no post', post.id, e)
        try { await d.desistir(post) } catch (e2) { console.error('melhorar-posts: não consegui marcar', post.id, e2) }
      }
    }))
    // API ocupada: não adianta pegar mais posts agora; os devolvidos ficam para a próxima execução
    if (contagem.ocupado) break
  }
  return contagem
}
