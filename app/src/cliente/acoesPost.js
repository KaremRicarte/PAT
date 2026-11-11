// Ações do post que gravam no banco (aprovar, descartar, Postei e os desfazer).
import { t } from '../textos.js'
import { aviso } from '../comum.js'
import { proximoEstado } from './situacao.js'

const emAndamento = new Set() // ids dos posts com uma ação ainda gravando

// Otimista: muda o post na hora e chama aoMudar; se a gravação falhar, volta ao que era,
// chama aoMudar de novo e avisa. Uma ação por post de cada vez (a outra é ignorada).
export async function aplicarAcao({ supabase, post, acao, aoMudar }) {
  if (emAndamento.has(post.id)) return false
  emAndamento.add(post.id)
  const mudanca = proximoEstado(post, acao)
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
