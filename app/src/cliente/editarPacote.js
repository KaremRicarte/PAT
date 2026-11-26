// "✏️ Editar pacote" (Turismo): o cliente corrige o pacote do post direto do calendário (o mesmo cadastro do
// Editar/Importar) e escolhe o que fazer com o texto: refazer só este post, todos os posts do pacote que faltam
// ou nada agora. A arte se atualiza sozinha: ela é desenhada com os dados do pacote na hora.
import { t } from '../textos.js'
import { el, logo, mostrar, campo, aviso } from '../comum.js'
import { validarItens } from './negocio.js'
import { estadoDoNegocio, camposDePrecoDoItem } from './perguntas.js'
import { itemParaGravar } from './refazerPost.js'
import { chamarFuncao } from './refazer.js'
import { datasParaPromocao } from '../../../supabase/functions/_shared/modelos/datas.ts'
import { hojeEmSaoPaulo } from '../../../supabase/functions/_shared/modelos/calendario.ts'

// O botão só aparece no Turismo, em post de um pacote que existe.
export const temEditarPacote = (post, ramo, produtos) =>
  ramo?.id === 'turismo' && Boolean(post.produto_id) && (produtos ?? []).some((p) => p.id === post.produto_id)

// Os posts do mesmo pacote que faltam: de hoje em diante e não postados (os que a função refaz).
export const postsDoPacote = (posts, post, hoje) =>
  (posts ?? []).filter((p) => p.produto_id === post.produto_id && p.data >= hoje && !p.postado_em)

// O que vai para refazer-posts: só este post, ou todos os posts do pacote que faltam.
export const corpoDoTexto = (postId, qual) => (qual === 'todos' ? { post_id: postId, item: true } : { post_id: postId })

// Pergunta depois de salvar: 'este', 'todos' ou null ("Agora não").
function perguntarTexto(nome, { podeEste, n }) {
  return new Promise((resolver) => {
    const dialogo = el('dialog', { class: 'dialogo', 'aria-labelledby': 'editar-pacote-texto' })
    const fechar = (r) => { dialogo.close(); dialogo.remove(); resolver(r) }
    const botoes = [
      podeEste ? el('button', { type: 'button', texto: t('pacote.editar.texto.este'), onclick: () => fechar('este') }) : null,
      n > 0 ? el('button', { type: 'button', class: podeEste ? 'secundario' : null, texto: t('pacote.editar.texto.todos', { nome, n }), onclick: () => fechar('todos') }) : null,
      el('button', { type: 'button', class: 'secundario', texto: t('pacote.editar.texto.agoranao'), onclick: () => fechar(null) }),
    ].filter(Boolean)
    dialogo.append(el('h2', { id: 'editar-pacote-texto', texto: t('pacote.editar.texto.titulo') }),
      el('p', { class: 'muted', texto: t('pacote.editar.texto.dica') }),
      el('div', { class: 'acoes coluna' }, ...botoes))
    dialogo.addEventListener('cancel', (ev) => { ev.preventDefault(); fechar(null) })
    document.body.append(dialogo)
    dialogo.showModal()
    botoes[0].focus()
  })
}

// aoCancelar: volta ao post; aoSalvo(refez): volta ao calendário (refez = algum texto foi mandado refazer).
export function telaEditarPacote(ctx, post, { aoCancelar, aoSalvo }) {
  const { supabase, ramo } = ctx
  const produto = (ctx.produtos ?? []).find((p) => p.id === post.produto_id)
  const item = estadoDoNegocio(null, [produto], ramo).itens[0]
  const hoje = hojeEmSaoPaulo()

  const erro = el('p', { class: 'erro', role: 'alert', hidden: true })
  const salvar = el('button', { type: 'submit', texto: t('pacote.editar.salvar') })
  const cancelar = el('button', { type: 'button', class: 'secundario', texto: t('estrat.cancelar'), onclick: aoCancelar })
  const [rNome, iNome] = campo(t('quiz.item.nome'), { value: item.nome, maxlength: 80 })
  iNome.addEventListener('input', () => { item.nome = iNome.value })
  const [rDesc, iDesc] = campo(t('quiz.item.descricao'), { value: item.descricao, maxlength: 300 })
  iDesc.addEventListener('input', () => { item.descricao = iDesc.value })

  const form = el('form', { novalidate: true, class: 'quiz' },
    el('h1', { texto: t('pacote.editar.titulo', { nome: produto.nome }) }),
    el('p', { class: 'aviso-foto', texto: t('pacote.editar.aviso', { nome: produto.nome }) }),
    rNome, iNome, rDesc, iDesc,
    ...camposDePrecoDoItem(item, ramo, datasParaPromocao(hoje, ramo)),
    erro,
    el('div', { class: 'acoes' }, salvar, cancelar))

  form.addEventListener('submit', async (ev) => {
    ev.preventDefault()
    erro.hidden = true
    const problema = validarItens([item], ramo)
    if (problema) { erro.textContent = t(problema, { max: 20 }); erro.hidden = false; return }
    salvar.disabled = cancelar.disabled = true
    salvar.textContent = t('pacote.editar.salvando')
    try {
      const dados = itemParaGravar(item, ramo)
      const { error } = await supabase.from('produtos').update(dados).eq('id', produto.id)
      if (error) throw error
      Object.assign(produto, dados) // a lista em memória fica igual à do banco: a arte já sai com os dados novos
    } catch (e) {
      console.error(e)
      erro.textContent = t('erro.geral'); erro.hidden = false
      salvar.disabled = cancelar.disabled = false; salvar.textContent = t('pacote.editar.salvar')
      return
    }
    const podeEste = !post.postado_em && post.data >= hoje
    const doPacote = postsDoPacote(ctx.posts, post, hoje)
    const qual = await perguntarTexto(produto.nome, { podeEste, n: doPacote.length })
    if (!qual) { aviso(t('pacote.editar.ok')); return aoSalvo(false) }
    // a função parte de um post que falta: este, ou (se este já passou) o primeiro do pacote que falta
    const r = await chamarFuncao(supabase, 'refazer-posts', corpoDoTexto(podeEste ? post.id : doPacote[0].id, qual))
    if (r.erro) aviso(r.erro)
    else aviso(t('pacote.editar.refeito'))
    aoSalvo(true)
  })
  mostrar(logo(), form)
}
