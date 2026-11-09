import supabase from '../supabase.js'
import { t } from '../textos.js'

export async function listarClientes() {
  const { data, error } = await supabase.from('clientes')
    .select('id, nome, email, telefone, idioma, situacao, senha_provisoria')
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
