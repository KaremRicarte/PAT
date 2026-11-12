// Ações do post que gravam no banco (aprovar, descartar, Postei e os desfazer).
import { t } from '../textos.js'
import { aviso } from '../comum.js'
import { proximoEstado, chaveFormato } from './situacao.js'

const emAndamento = new Set() // ids dos posts com uma ação ainda gravando

// Otimista: muda o post na hora e chama aoMudar; se a gravação falhar, volta ao que era,
// chama aoMudar de novo e avisa. Uma ação por post de cada vez (a outra é ignorada).
export async function aplicarAcao({ supabase, post, acao, aoMudar }) {
  if (emAndamento.has(post.id)) return false
  const mudanca = proximoEstado(post, acao) // lança se a ação não existe: antes de marcar o post
  emAndamento.add(post.id)
  const antes = Object.fromEntries(Object.keys(mudanca).map((k) => [k, post[k]]))
  Object.assign(post, mudanca)
  aoMudar?.()
  try {
    const { data, error } = await supabase.from('posts').update(mudanca).eq('id', post.id).select().single()
    if (error) throw error
    Object.assign(post, data) // o banco decide a hora do postado_em
    aoMudar?.()
    return true
  } catch (e) {
    console.error(e)
    Object.assign(post, antes)
    aoMudar?.()
    aviso(t('erro.conexao'))
    return false
  } finally {
    emAndamento.delete(post.id)
  }
}

// ---------- Gerar outro (função trocar-post) ----------
export const LIMITE_TROCAS = 10 // o mesmo LIMITE_TROCAS de supabase/functions/trocar-post/acoes.ts

export const trocasDoMes = (posts) => posts.reduce((soma, p) => soma + (p.trocas ?? 0), 0)

// Pede outro texto para o post. Não muda o post: quem chama aplica o { post } devolvido.
// { erro } traz a mensagem da função (limite de trocas, nenhum texto novo…) ou a de sem conexão.
export async function gerarOutro({ supabase, post }) {
  if (emAndamento.has(post.id)) return { erro: t('post.aguarde') }
  emAndamento.add(post.id)
  try {
    const { data, error } = await supabase.functions.invoke('trocar-post', { body: { post_id: post.id } })
    if (!error && data?.post) return { post: data.post }
    console.error(error)
    if (error?.name === 'FunctionsFetchError' || !error?.context?.json) return { erro: t('erro.conexao') }
    try {
      const { erro } = await error.context.json()
      if (erro) return { erro }
    } catch { /* sem corpo: fica a mensagem geral */ }
    return { erro: t('erro.geral') }
  } catch (e) {
    console.error(e)
    return { erro: t('erro.conexao') }
  } finally {
    emAndamento.delete(post.id)
  }
}

// Nome do arquivo baixado: 2026-11-04_instagram_carrossel_2.png (a página só quando houver).
export function nomeDoArquivo(post, pagina, ext) {
  return `${post.data}_${post.rede}_${chaveFormato(post)}${pagina ? `_${pagina}` : ''}.${ext}`
}

// Como entregar o arquivo ao aparelho. No iPhone/iPad o <a download> leva ao app Arquivos;
// o compartilhamento (Web Share) oferece "Salvar imagem", que leva às Fotos.
// O iPad no modo computador se apresenta como Mac: a diferença é a tela de toque.
export function modoDeSalvar({ userAgent = '', maxTouchPoints = 0, podeCompartilharArquivos = false }) {
  const ehIos = /iPhone|iPad|iPod/.test(userAgent) || (/Macintosh/.test(userAgent) && maxTouchPoints > 1)
  return ehIos && podeCompartilharArquivos ? 'compartilhar' : 'baixar'
}

// Os arquivos para salvar, prontos antes do toque: um por página (_1, _2… quando há mais de um).
export function arquivosParaSalvar(post, blobs, ext) {
  return blobs.map((b, i) => new File([b], nomeDoArquivo(post, blobs.length > 1 ? i + 1 : null, ext), { type: b.type }))
}
