// Escolha da imagem do post (Etapa 4A, spec §3.3, §3.4 e §7 itens 9, 10, 14, 17, 18). Puro: tudo o que vem de fora
// (banco, Pexels, Pixabay, a IA que olha as candidatas) entra em `deps`; aqui só ficam as regras.

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

export type Origem = 'cliente' | 'banco' | 'pexels' | 'pixabay'
export type Candidata = { id: string, descricao?: string, url?: string }
export type Externa = { id: string, url: string, autor: string, descricao?: string }
export type FotoDoBanco = { path: string, descricao: string, serve?: boolean }
export type FotoDoCliente = { path: string, descricao: string, serve: boolean }

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

// Ordem (spec §7 item 18): fotos do cliente -> banco próprio do ramo -> Pexels -> Pixabay -> null (só texto).
export async function escolherImagemGeral(deps: DepsImagens, a: {
  clienteId: string, ramo: string, temaDoPost: string, fotosDoCliente: FotoDoCliente[], hoje: Date | string,
}): Promise<ImagemEscolhida | null> {
  const { clienteId, ramo, temaDoPost: tema } = a

  const doCliente = a.fotosDoCliente.filter((f) => f.serve !== false)
  if (doCliente.length) {
    const id = await deps.escolher(doCliente.map((f) => ({ id: f.path, descricao: f.descricao })), tema)
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

  for (const [fonte, buscar] of [['pexels', deps.buscarPexels], ['pixabay', deps.buscarPixabay]] as const) {
    const usados = new Set(await deps.idsUsados(fonte))
    const novas = (await buscar(tema)).filter((f) => !usados.has(f.id))
    if (!novas.length) continue
    const id = await deps.escolher(novas.map((f) => ({ id: f.id, url: f.url, descricao: f.descricao })), tema)
    const f = novas.find((x) => x.id === id)
    if (f) return { path: f.url, origem: fonte, descricao: f.descricao ?? tema, externo: { id: f.id, autor: f.autor, url: f.url } }
  }
  return null
}

// Tema curto em português para a busca: o título sem emojis nem pontuação, até 7 palavras; sem título, o pilar.
export function temaDaImagem(post: { titulo?: string | null, pilar?: string | null }): string {
  const palavras = (post.titulo ?? '').replace(/[^\p{L}\p{N}\s]/gu, ' ').split(/\s+/).filter(Boolean)
  const corte = palavras.slice(0, 7)
  return corte.length ? corte.join(' ') : (post.pilar ?? '')
}
