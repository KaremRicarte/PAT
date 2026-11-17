// Monta a EntradaPost (o que a IA recebe para escrever um post) a partir dos dados do banco, e as regras de foto
// que a fila (melhorar-posts) e as ações na hora (trocar-post, reescrever-post) compartilham. Puro: o Vitest importa.
import type { Estrategia, Pilar, Rede, Tom } from '../modelos/tipos.ts'
import type { PostGerado } from '../modelos/gerar.ts'
import type { EntradaPost } from './escrever.ts'

// descrição usada quando a foto ainda não foi descrita (a imagem vai anexada mesmo assim)
export const SEM_DESCRICAO = 'Veja a foto anexada.'

// caminho sem '..', '.' nem partes vazias
export const caminhoSeguro = (p: string) => !p.split('/').some((s) => s === '..' || s === '.' || s === '')

// só fotos da pasta do cliente vão para a IA ou para o post
export const daPastaDoCliente = (clienteId: string) => (p: string) => p.startsWith(`${clienteId}/`) && caminhoSeguro(p)

// Foto enviada para um post ("Trocar imagem" > "Enviar outra foto"): fica sempre no mesmo caminho
// ({uid}/posts/{id}.jpg), então a descrição guardada em fotos_ia pode ser da foto anterior.
export const fotoEnviadaParaOPost = (clienteId: string, path: string) => path.startsWith(`${clienteId}/posts/`)

// numeric do Postgres pode chegar como texto
export const numero = (v: number | string | null | undefined): number | null => {
  if (v == null || v === '') return null
  const n = Number(v)
  return Number.isFinite(n) ? n : null
}

// Mesma regra de fotosDoProduto (imagens.ts / situacao.js).
export const fotosDoProduto = (p: { fotos?: string[] | null, foto_path?: string | null }): string[] =>
  (p.fotos?.length ? p.fotos : p.foto_path ? [p.foto_path] : [])

export type DadosDoCliente = {
  ramo: string,
  estrategia: Estrategia,
  negocio: { nome: string, insta: string | null, tom: Tom },
  // todos os serviços do cliente (os textos dele não contam nas checagens)
  produtos: { id: string, nome: string, descricao: string | null }[],
}
export type LugarDoPost = {
  data: string, rede: Rede, tipo: PostGerado['tipo'], formato: PostGerado['formato'], pilar: Pilar,
  titulo: string, legenda: string, produto_id: string | null,
  preco_de: number | string | null, preco_por: number | string | null,
}

export function montarEntradaPost(
  c: DadosDoCliente, post: LugarDoPost, foto: { url: string, descricao: string } | null,
): EntradaPost {
  const produto = post.produto_id ? c.produtos.find((p) => p.id === post.produto_id) ?? null : null
  return {
    ramo: c.ramo,
    negocio: { nome: c.negocio.nome, insta: c.negocio.insta, tom: c.negocio.tom },
    estrategia: c.estrategia,
    lugar: {
      data: post.data, rede: post.rede, tipo: post.tipo, formato: post.formato, pilar: post.pilar,
      preco_de: numero(post.preco_de), preco_por: numero(post.preco_por),
    },
    produto: produto ? { nome: produto.nome, descricao: produto.descricao } : null,
    foto,
    textoModelo: [post.titulo, post.legenda].filter(Boolean).join('\n\n'),
    // mesmos textos do cliente de gerar-mes (o que ele escreveu não conta nas checagens)
    textosDoCliente: [c.negocio.nome, ...c.produtos.flatMap((p) => [p.nome, p.descricao ?? ''])],
  }
}
