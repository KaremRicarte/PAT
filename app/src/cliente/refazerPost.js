// "Refazer este post": o cliente corrige os dados do item do post (nome, descrição, preços e data da promoção)
// e o PAT refaz só este post, no mesmo lugar e com a estratégia do mês (função refazer-posts com { post_id }).
// Os outros posts do item não mudam (para isso há o "Refazer os posts que faltam" do Meu negócio).
import { t } from '../textos.js'
import { el, logo, mostrar, campo, aviso } from '../comum.js'
import { RAMOS } from '../../../supabase/functions/_shared/modelos/ramos/index.ts'
import { validarItens, itensParaSalvar } from './negocio.js'
import { estadoDoNegocio, caixaDaData, caixaOcultarPreco } from './perguntas.js'
import { chamarFuncao } from './refazer.js'
import { datasParaPromocao } from '../../../supabase/functions/_shared/modelos/datas.ts'
import { hojeEmSaoPaulo } from '../../../supabase/functions/_shared/modelos/calendario.ts'

// O que gravar no item, a partir do formulário (mesmas regras do cadastro de itens).
export function itemParaGravar(item, ramo) {
  const [salvo] = itensParaSalvar([item], ramo)
  return { nome: salvo.nome.trim(), descricao: salvo.descricao?.trim() || null, preco: salvo.preco,
    preco_promo: salvo.preco_promo, promo_data: salvo.promo_data, ocultar_preco: salvo.ocultar_preco }
}

// aoCancelar: volta ao post; aoRefeito: o post foi refeito (o calendário recarrega e mostra o PAT trabalhando).
export function telaRefazerPost(ctx, post, { aoCancelar, aoRefeito }) {
  const { supabase } = ctx
  const ramo = ctx.ramo ?? RAMOS[ctx.cliente.ramo]
  const produto = post.produto_id ? (ctx.produtos ?? []).find((p) => p.id === post.produto_id) : null
  const item = produto ? estadoDoNegocio(null, [produto], ramo).itens[0] : null

  const erro = el('p', { class: 'erro', role: 'alert', hidden: true })
  const refazer = el('button', { type: 'submit', texto: t('refazer1.botao') })
  const cancelar = el('button', { type: 'button', class: 'secundario', texto: t('estrat.cancelar'), onclick: aoCancelar })

  let campos = []
  if (item) {
    const [rNome, iNome] = campo(t('quiz.item.nome'), { value: item.nome, maxlength: 80 })
    iNome.addEventListener('input', () => { item.nome = iNome.value })
    const [rDesc, iDesc] = campo(t('quiz.item.descricao'), { value: item.descricao, maxlength: 300 })
    iDesc.addEventListener('input', () => { item.descricao = iDesc.value })
    campos = [rNome, iNome, rDesc, iDesc]
    if (!ramo.noPromo) {
      const [rPreco, iPreco] = campo(t('quiz.item.preco'), { value: item.precoTexto, inputmode: 'decimal', placeholder: 'Ex.: 49,90' })
      iPreco.addEventListener('input', () => { item.precoTexto = iPreco.value })
      const [rPromo, iPromo] = campo(t('quiz.item.promo'), { value: item.promoTexto, inputmode: 'decimal', placeholder: 'Ex.: 39,90' })
      iPromo.addEventListener('input', () => { item.promoTexto = iPromo.value })
      campos.push(el('div', { class: 'precos' }, el('div', {}, rPreco, iPreco), el('div', {}, rPromo, iPromo)), caixaDaData(item, datasParaPromocao(hojeEmSaoPaulo(), ramo)), caixaOcultarPreco(item))
    }
  }

  const form = el('form', { novalidate: true, class: 'quiz' },
    el('h1', { texto: t('refazer1.titulo') }),
    el('p', { class: 'muted', texto: item ? t('refazer1.dica.item', { nome: produto.nome }) : t('refazer1.dica.geral') }),
    ...campos,
    item ? el('p', { class: 'muted pequeno', texto: t('refazer1.outros') }) : null,
    erro,
    el('div', { class: 'acoes' }, refazer, cancelar))

  form.addEventListener('submit', async (ev) => {
    ev.preventDefault()
    erro.hidden = true
    if (item) {
      const problema = validarItens([item], ramo)
      if (problema) { erro.textContent = t(problema, { max: 20 }); erro.hidden = false; return }
    }
    refazer.disabled = cancelar.disabled = true
    refazer.textContent = t('refazer1.fazendo')
    try {
      if (item) {
        const dados = itemParaGravar(item, ramo)
        const { error } = await supabase.from('produtos').update(dados).eq('id', produto.id)
        if (error) throw error
        Object.assign(produto, dados) // a lista de itens em memória fica igual à do banco
      }
    } catch (e) {
      console.error(e)
      erro.textContent = t('erro.geral'); erro.hidden = false
      refazer.disabled = cancelar.disabled = false; refazer.textContent = t('refazer1.botao')
      return
    }
    const r = await chamarFuncao(supabase, 'refazer-posts', { post_id: post.id })
    if (r.erro) {
      erro.textContent = r.erro; erro.hidden = false
      refazer.disabled = cancelar.disabled = false; refazer.textContent = t('refazer1.botao')
      return
    }
    aviso(t('refazer1.ok'))
    aoRefeito()
  })
  mostrar(logo(), form)
}
