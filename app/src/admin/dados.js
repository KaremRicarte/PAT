import supabase from '../supabase.js'
import { invocar } from '../comum.js'
import { t } from '../textos.js'
import { linhaNovaDoNegocio, caminhoDoLogo } from './negocio.js'

// Cada cliente vem com o negócio (nome, Instagram e logo) em c.negocio, ou null.
export async function listarClientes() {
  const [c, n] = await Promise.all([
    supabase.from('clientes')
      .select('id, nome, email, telefone, idioma, ramo, redes, frequencia, situacao, senha_provisoria')
      .order('nome'),
    supabase.from('negocios').select('cliente_id, nome, insta, logo_path'),
  ])
  if (c.error) throw c.error
  if (n.error) throw n.error
  const porId = new Map(n.data.map((x) => [x.cliente_id, x]))
  return c.data.map((x) => ({ ...x, negocio: porId.get(x.id) ?? null }))
}

// Grava nome, Instagram e logo do negócio (dados já validados). cliente: { id, ramo, negocio }.
// Logo novo vai para um caminho novo (sem cache velho); o antigo é apagado depois de salvar.
export async function salvarNegocioDoAdmin(cliente, dados, logoBlob = null) {
  const marcas = supabase.storage.from('marcas')
  const antigo = cliente.negocio?.logo_path ?? null
  let logo_path = antigo
  if (logoBlob) {
    logo_path = caminhoDoLogo(cliente.id)
    const { error } = await marcas.upload(logo_path, logoBlob, { contentType: 'image/png' })
    if (error) return { erro: t('erro.geral') }
  }
  const agora = new Date().toISOString()
  const r = cliente.negocio
    ? await supabase.from('negocios').update({ ...dados, logo_path, atualizado_em: agora }).eq('cliente_id', cliente.id)
    : await supabase.from('negocios').insert(linhaNovaDoNegocio(cliente, dados, logo_path))
  if (r.error) {
    if (logoBlob) { try { await marcas.remove([logo_path]) } catch { /* melhor esforço */ } }
    return { erro: t('erro.geral') }
  }
  if (logoBlob && antigo) { try { await marcas.remove([antigo]) } catch { /* melhor esforço */ } }
  return {}
}

// Chama a função admin-clientes; quando o status não é 2xx, devolve { erro } com a mensagem do corpo.
async function chamarFuncao(body) {
  const { data, error } = await invocar(supabase, 'admin-clientes', { body })
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

// Dias de post do cliente (plano): todos, seg_sab, uteis ou seg_sex.
export async function definirFrequencia(id, frequencia) {
  const { error } = await supabase.from('clientes').update({ frequencia }).eq('id', id)
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
    .eq('origem', 'banco').eq('ramo', ramo).is('cliente_id', null).order('path')
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
    try { await invocar(supabase, 'descrever-fotos', { body: { paths: paths.slice(i, i + 30), ramo } }) } catch { /* segue sem descrição */ }
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
