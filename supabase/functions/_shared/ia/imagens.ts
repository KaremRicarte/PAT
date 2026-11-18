// Escolha da imagem do post (Etapa 4A, spec §3.3, §3.4 e §7 itens 9, 10, 14, 17, 18). Puro: tudo o que vem de fora
// (banco, Pexels, Pixabay, a IA que olha as candidatas) entra em `deps`; aqui só ficam as regras.
import type { Palavras } from './palavras.ts'
import { LIMITE_GERADAS } from './uso.ts'

export type FotosInfo = Record<string, { serve?: boolean } | undefined>
type Produto = { id: string, fotos?: string[] | null, foto_path?: string | null }

// Mesma regra de fotosDoProduto em app/src/cliente/situacao.js (mantenha as duas iguais; aqui não dá para importar app/).
const fotosDoProduto = (p: Produto): string[] => (p.fotos?.length ? p.fotos : p.foto_path ? [p.foto_path] : [])

// Foto de um post de serviço: a escolhida pelo cliente vence; senão revezam as fotos do serviço pela ordem do post
// (como fotoDoPost em situacao.js), pulando as reprovadas (serve === false). Post sem serviço -> null (vai para escolherImagemGeral).
export function fotoDoLugar(a: {
  post: { produto_id?: string | null, foto_path?: string | null, ordem?: number | null },
  produtos: Produto[], fotosInfo: FotosInfo,
}): string | null {
  const { post, produtos, fotosInfo } = a
  if (post.foto_path) return post.foto_path
  const produto = post.produto_id ? produtos.find((p) => p.id === post.produto_id) : null
  if (!produto) return null
  const f = fotosDoProduto(produto).filter((p) => fotosInfo[p]?.serve !== false)
  return f.length ? f[(post.ordem ?? 0) % f.length] : null
}

export type Origem = 'cliente' | 'banco' | 'pexels' | 'pixabay' | 'gerada'
export type Candidata = { id: string, descricao?: string, url?: string }
export type Externa = { id: string, url: string, autor: string, descricao?: string }
export type FotoDoBanco = { path: string, descricao: string, serve?: boolean }
export type FotoDoCliente = { path: string, descricao: string, serve: boolean, doNegocio?: boolean }

export type DepsImagens = {
  // A IA vendo as candidatas e escolhendo pelo tema: devolve o id ou null (nenhuma serve).
  escolher: (candidatas: Candidata[], tema: string) => Promise<string | null>,
  bancoDoRamo: (ramo: string) => Promise<FotoDoBanco[]>,
  // Caminhos do banco que este cliente já recebeu desde `desdeISO` (AAAA-MM-DD).
  usadasPeloCliente: (clienteId: string, desdeISO: string) => Promise<string[]>,
  buscarPexels: (tema: string) => Promise<Externa[]>,
  buscarPixabay: (tema: string) => Promise<Externa[]>,
  // Ids já usados por QUALQUER cliente (fotos externas não se repetem entre clientes).
  idsUsados: (fonte: 'pexels' | 'pixabay') => Promise<string[]>,
  // Palavras-chave (pt e en) e prompt de imagem para o tema; null = a IA não respondeu (busca pelo tema e não gera).
  palavras: (tema: string) => Promise<Palavras | null>,
  // Gera a imagem (fal.ai); null = sem chave ou falhou.
  gerar: ((prompt: string, formato: 'feed' | 'vertical') => Promise<{ id: string, url: string } | null>) | null,
  // Imagens geradas para o cliente neste mês (limite LIMITE_GERADAS).
  geradasNoMes: (clienteId: string) => Promise<number>,
}

export type ImagemEscolhida = {
  path: string, origem: Origem, descricao: string, externo?: { id: string, autor: string, url: string },
}

const DIAS_SEM_REPETIR = 90

function desde(hoje: Date | string, dias: number): string {
  const d = new Date(typeof hoje === 'string' ? `${hoje.slice(0, 10)}T12:00:00Z` : hoje)
  d.setUTCDate(d.getUTCDate() - dias)
  return d.toISOString().slice(0, 10)
}

// Ordem (spec §7 item 18): fotos do cliente -> banco próprio do ramo -> Pexels -> Pixabay (por palavras-chave, pt e
// depois en) -> imagem gerada -> null (só texto). Post de aproximação: as Minhas fotos (do negócio) vêm primeiro.
export async function escolherImagemGeral(deps: DepsImagens, a: {
  clienteId: string, ramo: string, temaDoPost: string, fotosDoCliente: FotoDoCliente[], hoje: Date | string,
  aproximacao?: boolean, formato: 'feed' | 'vertical',
}): Promise<ImagemEscolhida | null> {
  const { clienteId, ramo, temaDoPost: tema } = a

  let doCliente = a.fotosDoCliente.filter((f) => f.serve !== false)
  let temaCliente = tema
  if (a.aproximacao) {
    doCliente = [...doCliente.filter((f) => f.doNegocio), ...doCliente.filter((f) => !f.doNegocio)]
      .map((f) => (f.doNegocio ? { ...f, descricao: `Foto do próprio negócio: ${f.descricao}` } : f))
    temaCliente = `${tema} (post de aproximação: prefira uma foto do próprio negócio)`
  }
  if (doCliente.length) {
    const id = await deps.escolher(doCliente.map((f) => ({ id: f.path, descricao: f.descricao })), temaCliente)
    const f = doCliente.find((x) => x.path === id)
    if (f) return { path: f.path, origem: 'cliente', descricao: f.descricao }
  }

  const banco = (await deps.bancoDoRamo(ramo)).filter((f) => f.serve !== false)
  if (banco.length) {
    const usadas = new Set(await deps.usadasPeloCliente(clienteId, desde(a.hoje, DIAS_SEM_REPETIR)))
    const livres = banco.filter((f) => !usadas.has(f.path))
    if (livres.length) {
      const id = await deps.escolher(livres.map((f) => ({ id: f.path, descricao: f.descricao })), tema)
      const f = livres.find((x) => x.path === id)
      if (f) return { path: f.path, origem: 'banco', descricao: f.descricao }
    }
  }

  const palavras = await deps.palavras(tema)
  const termos = palavras ? [palavras.busca_pt, palavras.busca_en] : [tema]
  for (const [fonte, buscar] of [['pexels', deps.buscarPexels], ['pixabay', deps.buscarPixabay]] as const) {
    const usados = new Set(await deps.idsUsados(fonte))
    let novas: Externa[] = []
    for (const termo of termos) {
      novas = (await buscar(termo)).filter((f) => !usados.has(f.id))
      if (novas.length) break
    }
    if (!novas.length) continue
    const id = await deps.escolher(novas.map((f) => ({ id: f.id, url: f.url, descricao: f.descricao })), tema)
    const f = novas.find((x) => x.id === id)
    if (f) return { path: f.url, origem: fonte, descricao: f.descricao ?? tema, externo: { id: f.id, autor: f.autor, url: f.url } }
  }

  if (!palavras || !deps.gerar) return null
  try {
    if ((await deps.geradasNoMes(clienteId)) >= LIMITE_GERADAS) return null
  } catch (e) {
    // sem saber quantas já foram geradas, não gera (o limite protege o custo)
    console.error('imagens: não consegui contar as imagens geradas', e)
    return null
  }
  const g = await deps.gerar(palavras.prompt_imagem, a.formato)
  if (!g) return null
  return { path: g.url, origem: 'gerada', descricao: palavras.prompt_imagem, externo: { id: g.id, autor: '', url: g.url } }
}

// Tema curto em português para a busca: o título sem emojis nem pontuação, até 7 palavras; sem título, o pilar.
export function temaDaImagem(post: { titulo?: string | null, pilar?: string | null }): string {
  const palavras = (post.titulo ?? '').replace(/[^\p{L}\p{N}\s]/gu, ' ').split(/\s+/).filter(Boolean)
  const corte = palavras.slice(0, 7)
  return corte.length ? corte.join(' ') : (post.pilar ?? '')
}
