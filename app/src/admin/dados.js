import supabase from '../supabase.js'
import { t } from '../textos.js'

export async function listarClientes() {
  const { data, error } = await supabase.from('clientes')
    .select('id, nome, email, telefone, idioma, ramo, redes, situacao, senha_provisoria')
    .order('nome')
  if (error) throw error
  return data
}

// Chama a função admin-clientes; quando o status não é 2xx, devolve { erro } com a mensagem do corpo.
async function chamarFuncao(body) {
  const { data, error } = await supabase.functions.invoke('admin-clientes', { body })
  if (!error) return data
  try {
    const corpo = await error.context.json()
    return { erro: corpo.erro ?? t('erro.geral') }
  } catch {
    return { erro: t('erro.geral') }
  }
}

export const criarCliente = (dados) => chamarFuncao({ acao: 'criar', ...dados })

export const redefinirSenha = (id) => chamarFuncao({ acao: 'redefinir_senha', id })

export async function definirSituacao(id, situacao) {
  const { error } = await supabase.from('clientes').update({ situacao }).eq('id', id)
  return error ? { erro: t('erro.geral') } : {}
}

export async function definirRamo(id, ramo) {
  const { error } = await supabase.from('clientes').update({ ramo }).eq('id', id)
  return error ? { erro: t('erro.geral') } : {}
}

export async function definirRedes(id, redes) {
  const { error } = await supabase.from('clientes').update({ redes }).eq('id', id)
  return error ? { erro: t('erro.geral') } : {}
}

// ===== Banco de imagens =====
export async function listarBanco(ramo) {
  const { data, error } = await supabase.from('fotos_ia')
    .select('path, descricao, serve, motivo')
    .eq('origem', 'banco').eq('ramo', ramo).order('path')
  if (error) throw error
  return data
}

// Arquivos que já estão no bucket (inclusive os ainda sem linha em fotos_ia).
export async function listarArquivosDoBanco(ramo) {
  const { data, error } = await supabase.storage.from('banco').list(ramo, { limit: 1000 })
  if (error) throw error
  return (data ?? []).filter((f) => f.name && f.id).map((f) => `${ramo}/${f.name}`)
}

export async function enviarParaBanco(ramo, blob) {
  const caminho = `${ramo}/${crypto.randomUUID()}.jpg`
  const { error } = await supabase.storage.from('banco').upload(caminho, blob, { contentType: 'image/jpeg' })
  return error ? null : caminho
}

// A função aceita até 30 fotos por chamada.
export async function descreverBanco(paths, ramo) {
  for (let i = 0; i < paths.length; i += 30) {
    try { await supabase.functions.invoke('descrever-fotos', { body: { paths: paths.slice(i, i + 30), ramo } }) } catch { /* segue sem descrição */ }
  }
}

export async function urlDaFoto(path) {
  const { data } = await supabase.storage.from('banco').createSignedUrl(path, 3600)
  return data?.signedUrl ?? null
}

export async function removerDoBanco(path) {
  const a = await supabase.storage.from('banco').remove([path])
  if (a.error) return { erro: t('erro.geral') }
  const b = await supabase.from('fotos_ia').delete().eq('path', path)
  return b.error ? { erro: t('erro.geral') } : {}
}
