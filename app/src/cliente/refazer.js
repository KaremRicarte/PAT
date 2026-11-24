// Depois de salvar "Editar meu negócio": se os itens mudaram e há posts que faltam,
// pergunta se o cliente quer refazê-los com os itens novos (função refazer-posts).
import { t } from '../textos.js'
import { el, logo, mostrar, aviso, invocar } from '../comum.js'
import { hojeEmSaoPaulo } from '../../../supabase/functions/_shared/modelos/calendario.ts'
import { carregarNegocio } from './negocio.js'

// O que, nos itens, muda os posts: ordem, nome, descrição, preços, data da promoção, "Ocultar preço" e fotos.
const resumoDosItens = (produtos) => JSON.stringify((produtos ?? []).map((p) => [
  p.id, p.nome, p.descricao ?? '', p.preco ?? null, p.preco_promo ?? null, p.promo_data ?? null, Boolean(p.ocultar_preco),
  p.fotos?.length ? p.fotos : p.foto_path ? [p.foto_path] : [],
]))
export const itensMudaram = (antes, depois) => resumoDosItens(antes) !== resumoDosItens(depois)

// Quantos posts cada opção refaz. `posts`: os que faltam (data >= hoje e não postados).
export function contarParaRefazer(posts) {
  return { naoAprovados: posts.filter((p) => p.estado !== 'aprovado').length, todos: posts.length }
}

async function postsQueFaltam(supabase, meses) {
  if (!meses?.length) return []
  const { data, error } = await supabase.from('posts').select('id, estado')
    .in('mes_id', meses.map((m) => m.id)).gte('data', hojeEmSaoPaulo()).is('postado_em', null)
  if (error) throw error
  return data
}

// Chamado pelo aoSalvar do quiz. Se não houver o que perguntar (ou a consulta falhar), segue para o app.
export async function depoisDeSalvar({ supabase, cliente, produtos, meses, atualizar }) {
  try {
    if (meses?.length) {
      const depois = (await carregarNegocio(supabase, cliente.id)).produtos
      if (itensMudaram(produtos, depois)) {
        const conta = contarParaRefazer(await postsQueFaltam(supabase, meses))
        if (conta.todos) return telaRefazer({ supabase, conta, atualizar })
      }
    }
  } catch (e) {
    console.error(e) // a pergunta é um extra: sem ela, o cadastro já está salvo
  }
  return atualizar()
}

function telaRefazer({ supabase, conta, atualizar }) {
  const erro = el('p', { class: 'erro', role: 'alert', hidden: true })
  const botoes = []
  const refazer = async (modo) => {
    for (const b of botoes) b.disabled = true
    erro.hidden = true
    const r = await chamarFuncao(supabase, 'refazer-posts', { modo })
    if (r.erro) {
      erro.textContent = r.erro
      erro.hidden = false
      for (const b of botoes) b.disabled = false
      return
    }
    aviso(t(r.refeitos === 1 ? 'refazer.ok.um' : 'refazer.ok', { n: r.refeitos }))
    atualizar()
  }
  if (conta.naoAprovados) {
    botoes.push(el('button', { type: 'button', texto: t('refazer.naoaprovados', { n: conta.naoAprovados }), onclick: () => refazer('nao_aprovados') }))
  }
  if (conta.todos > conta.naoAprovados) {
    botoes.push(el('button', { type: 'button', class: conta.naoAprovados ? 'secundario' : '', texto: t('refazer.todos', { n: conta.todos }), onclick: () => refazer('todos') }))
  }
  botoes.push(el('button', { type: 'button', class: 'secundario', texto: t('refazer.manter'), onclick: atualizar }))
  mostrar(logo(),
    el('h1', { texto: t('refazer.titulo') }),
    el('p', { texto: t('refazer.texto') }),
    el('p', { class: 'muted', texto: t('refazer.nunca') }),
    erro,
    el('div', { class: 'acoes' }, botoes))
}

// Chama uma função de refazer posts: { refeitos } ou { erro } com a mensagem pronta para mostrar.
export async function chamarFuncao(supabase, nome, body) {
  try {
    const { data, error } = await invocar(supabase, nome, { body })
    if (!error) return { refeitos: data?.refeitos ?? 0 }
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
  }
}
