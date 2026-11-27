// Quiz do mês (serviços e estratégia) e geração. O calendário fica em calendario.js.
import { t } from '../textos.js'
import { el, logo, mostrar, botaoSair, invocar } from '../comum.js'
import { RAMOS } from '../../../supabase/functions/_shared/modelos/ramos/index.ts'
import { mesAlvo, hojeEmSaoPaulo, nomeDoMes } from '../../../supabase/functions/_shared/modelos/calendario.ts'
import { datasDoMes, diaMes } from '../../../supabase/functions/_shared/modelos/datas.ts'
import { opcoes, telaPassos } from './quiz.js'
import { estadoDoNegocio } from './perguntas.js'
import { depoisDeSalvar } from './refazer.js'
import { salvarItens, itensParaSalvar, carregarNegocio } from './negocio.js'
import { linkWhatsApp, formatarWhatsApp } from '../contato.js'
import { pacoteAtivo } from '../../../supabase/functions/_shared/modelos/pacote.ts'

const ESTRATEGIAS = ['vender', 'crescer', 'credibilidade', 'tempo']

// Em ramos com regras de conselho (noPromo), "Vender mais" vira "Atrair contatos".
export function rotuloEstrategia(estrategia, ramo) {
  return t(estrategia === 'vender' && ramo.noPromo ? 'estrategia.contatos' : `estrategia.${estrategia}`)
}
const descricaoEstrategia = (estrategia, ramo) =>
  t(estrategia === 'vender' && ramo.noPromo ? 'estrategia.contatos.desc' : `estrategia.${estrategia}.desc`)

// Cartões de escolha da estratégia (atual/sugerida marcada com `selo`, se houver).
export const cartoesEstrategia = (ramo, escolhida, aoMudar, sugerida = null) =>
  opcoes('estrategia', ESTRATEGIAS.map((e) => [e, rotuloEstrategia(e, ramo), descricaoEstrategia(e, ramo),
    e === sugerida ? t('mesq.sugerido') : null]), escolhida, aoMudar)

export function sugestaoEstrategia(mesAnterior) {
  return mesAnterior?.estrategia ?? 'tempo'
}

// Mês mostrado: o escolhido (ou recém-gerado), senão o de hoje, senão o mais recente.
export function escolherMes(meses, hoje, preferido) {
  return meses.find((m) => m.ano_mes === preferido) ?? meses.find((m) => m.ano_mes === hoje.slice(0, 7)) ?? meses[0]
}
let mesPreferido = null // guarda o mês recém-gerado ou escolhido nos botões
export const mesMostrado = (meses, hoje) => escolherMes(meses, hoje, mesPreferido)
export function preferirMes(anoMes) { mesPreferido = anoMes }

// Chamada para o WhatsApp da empresa nos posts de pacote de viagem (Turismo, com o pacote marcado).
// Facebook e WhatsApp: link que abre a conversa com a mensagem pronta; Instagram e TikTok (link não abre): o número.
export function linhaDoWhatsApp(post, { negocio, produtos, ramo } = {}) {
  if (ramo?.id !== 'turismo' || !negocio?.whatsapp || !post.produto_id) return null
  const produto = (produtos ?? []).find((p) => p.id === post.produto_id)
  if (!produto || !pacoteAtivo(produto.pacote)) return null
  return post.rede === 'facebook' || post.rede === 'whatsapp'
    ? t('legenda.whats.link', { link: linkWhatsApp(`55${negocio.whatsapp}`, t('whats.mensagem', { nome: produto.nome })) })
    : t('legenda.whats.numero', { numero: formatarWhatsApp(negocio.whatsapp) })
}

// Legenda + linha do WhatsApp (quando houver) + hashtags. contexto: { negocio, produtos, ramo } do post.
export function textoParaCopiar(post, contexto) {
  const whats = contexto ? linhaDoWhatsApp(post, contexto) : null
  return [post.legenda, whats, post.hashtags?.length ? post.hashtags.join(' ') : null].filter(Boolean).join('\n\n')
}

// ---------- Quiz do mês ----------
// Passo 1: serviços/produtos (salvos ao continuar). Passo 2: estratégia e gerar. As redes vêm do cadastro (admin).
export function telaQuizMes(ctx, antes = ctx.produtos) { // antes: serviços de antes do quiz (sobrevive ao Voltar)
  const { supabase, cliente, meses, atualizar } = ctx
  const ramo = RAMOS[cliente.ramo]
  const alvo = mesAlvo(hojeEmSaoPaulo(), meses.map((m) => m.ano_mes))
  if (!alvo) return atualizar()
  const estado = estadoDoNegocio(ctx.negocio, ctx.produtos, ramo)
  telaPassos({
    titulo: t('mesq.seumes'), perguntas: ['itens'], rotuloFinal: t('quiz.continuar'),
    ctx: { ramo, estado, supabase, fotosInfo: ctx.fotosInfo }, aoCancelar: meses.length ? atualizar : undefined,
    aoSalvar: async (e, aoProgredir) => {
      await salvarItens(supabase, cliente.id, itensParaSalvar(e.itens, ramo), aoProgredir, { aoFotosInfo: (m) => { ctx.fotosInfo = m } })
      // recarrega: o Voltar refaz o passo 1 a partir do que foi gravado (não da lista antiga)
      const { negocio, produtos } = await carregarNegocio(supabase, cliente.id)
      ctx.negocio = negocio
      ctx.produtos = produtos
      telaEstrategia({ ctx, ramo, alvo, antes, voltar: () => telaQuizMes(ctx, antes) })
    },
  })
}

const SEMANA_CURTA = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb']

// As datas do mês a gerar (de alvo.inicio em diante), com as promoções marcadas nos itens.
// Cada uma: { data, nome, especial (da lista de datas ou null = "outro dia" de uma promoção), itens }.
export function datasDaEstrategia(alvo, ramo, produtos) {
  const comPromo = ramo.noPromo ? [] : (produtos ?? []).filter((p) => p.promo_data && p.promo_data.startsWith(alvo.anoMes) &&
    p.promo_data >= alvo.inicio)
  const especiais = datasDoMes(alvo.anoMes, ramo).filter((d) => d.data >= alvo.inicio)
  const outros = [...new Set(comPromo.map((p) => p.promo_data))].filter((d) => !especiais.some((x) => x.data === d))
  return [...especiais.map((d) => ({ data: d.data, nome: d.nome, especial: d })),
    ...outros.map((d) => ({ data: d, nome: t('mesq.datas.outro'), especial: null }))]
    .sort((a, b) => a.data.localeCompare(b.data))
    .map((x) => ({ ...x, itens: comPromo.filter((p) => p.promo_data === x.data).map((p) => p.nome) }))
}

// Itens que podem ter promoção com data: todos, com ou sem preço (sem preço, o post da data sai sem valor).
// Ramos com conselho não fazem promoção.
export const itensEmPromocao = (produtos, ramo) => (ramo.noPromo ? [] : [...(produtos ?? [])])

// Mudanças de data das promoções: [{ id, promo_data }] só dos itens que mudaram.
export const mudancasDeDatas = (produtos, marcadas) =>
  (produtos ?? []).filter((p) => marcadas.has(p.id) && (marcadas.get(p.id) ?? null) !== (p.promo_data ?? null))
    .map((p) => ({ id: p.id, promo_data: marcadas.get(p.id) ?? null }))

// Datas do mês na tela da estratégia, com as caixinhas para marcar em cada data os itens em promoção
// (a promoção do item passa a valer só perto da data). Devolve { corpo, mudancas() }.
export function escolhaDeDatas(alvo, ramo, produtos) {
  const datas = datasDaEstrategia(alvo, ramo, produtos)
  const promos = itensEmPromocao(produtos, ramo)
  const marcadas = new Map(promos.map((p) => [p.id, p.promo_data ?? null]))
  const mudancas = () => mudancasDeDatas(produtos, marcadas)
  if (!datas.length) return { corpo: null, mudancas }
  const semana = (d) => SEMANA_CURTA[new Date(`${d}T00:00:00Z`).getUTCDay()]
  const lista = el('ul', { class: 'datas-mes' })
  const aceitaPromo = (x) => !ramo.noPromo && (x.especial === null || x.especial.promo)
  function linha(x) {
    const doDia = promos.filter((p) => marcadas.get(p.id) === x.data)
    const dica = doDia.length ? t('mesq.datas.promo', { itens: doDia.map((p) => p.nome).join(', ') })
      : x.especial?.soPromo ? t('mesq.datas.so')
        : t('mesq.datas.post')
    const caixas = aceitaPromo(x) ? promos.map((p) => {
      const id = `data-${x.data}-${p.id}`
      const caixa = el('input', { type: 'checkbox', id, checked: marcadas.get(p.id) === x.data })
      caixa.addEventListener('change', () => { marcadas.set(p.id, caixa.checked ? x.data : null); desenhar(); document.getElementById(id)?.focus() })
      return el('label', { class: 'caixinha', for: id }, caixa, el('span', { texto: t('mesq.datas.marcar', { nome: p.nome }) }))
    }) : []
    // a lista de itens fica recolhida (o cliente pode ter muitos itens); aberta se já há item marcado
    const itensDaData = caixas.length ? el('details', { class: 'itens-data', open: doDia.length > 0 || undefined },
      el('summary', { texto: doDia.length ? t('mesq.datas.escolher.n', { n: doDia.length }) : t('mesq.datas.escolher') }), ...caixas) : null
    return el('li', {}, el('strong', { texto: `${semana(x.data)}, ${diaMes(x.data)} · ${x.nome}` }), el('small', { texto: dica }), itensDaData)
  }
  function desenhar() { lista.replaceChildren(...datas.map(linha)) }
  desenhar()
  return {
    corpo: [el('h2', { texto: t('mesq.datas.titulo', { mes: nomeDoMes(alvo.anoMes) }) }),
      promos.length && datas.some(aceitaPromo) ? el('p', { class: 'muted', texto: t('mesq.datas.explica') }) : null, lista],
    mudancas,
  }
}

// Grava as datas das promoções marcadas na tela da estratégia e atualiza os itens em memória.
export async function gravarDatasDasPromocoes(supabase, produtos, mudancas) {
  for (const m of mudancas) {
    const { error } = await supabase.from('produtos').update({ promo_data: m.promo_data }).eq('id', m.id)
    if (error) throw error
    const p = produtos.find((x) => x.id === m.id)
    if (p) p.promo_data = m.promo_data
  }
}

function telaEstrategia({ ctx, ramo, alvo, antes, voltar: aoVoltar }) {
  const { supabase, cliente, meses, atualizar } = ctx
  let escolhida = sugestaoEstrategia(meses[0] ?? null) // meses vem do mais recente para o mais antigo
  const sugerida = escolhida
  const gerar = el('button', { type: 'submit', texto: t('mesq.gerar', { mes: nomeDoMes(alvo.anoMes) }) })
  const voltar = el('button', { type: 'button', class: 'secundario', texto: t('quiz.voltar'), onclick: aoVoltar })
  const datas = escolhaDeDatas(alvo, ramo, ctx.produtos)
  const erro = el('p', { class: 'erro', role: 'alert', hidden: true })
  const form = el('form', { novalidate: true, class: 'quiz' },
    el('h1', { texto: t('mesq.titulo') }),
    el('p', { class: 'muted', texto: t('mesq.dica', { mes: nomeDoMes(alvo.anoMes) }) }),
    cartoesEstrategia(ramo, escolhida, (v) => { escolhida = v }, sugerida),
    datas.corpo,
    // depois de gerar, a estratégia do mês não muda
    el('p', { class: 'aviso-foto', texto: t('mesq.aviso', { mes: nomeDoMes(alvo.anoMes) }) }),
    erro,
    el('div', { class: 'acoes' }, gerar, voltar, botaoSair(supabase)))
  form.addEventListener('submit', async (ev) => {
    ev.preventDefault()
    // as datas marcadas nas promoções vão para o banco antes de gerar (o gerar-mes lê os itens de lá)
    try {
      gerar.disabled = true
      await gravarDatasDasPromocoes(supabase, ctx.produtos, datas.mudancas())
    } catch (e) {
      console.error(e)
      erro.textContent = t('erro.geral')
      erro.hidden = false
      gerar.disabled = false
      return
    }
    // Com meses anteriores, mudou serviço? Oferece refazer os posts que faltam (só dos meses de antes).
    const aposGerar = meses.length ? () => depoisDeSalvar({ supabase, cliente, produtos: antes, meses, atualizar }) : atualizar
    telaGerando({ supabase, atualizar, aposGerar, estrategia: escolhida, voltar: () => telaEstrategia({ ctx, ramo, alvo, antes, voltar: aoVoltar }) })
  })
  mostrar(logo(), form)
}

// ---------- Gerando ----------
async function telaGerando({ supabase, atualizar, aposGerar = atualizar, estrategia, voltar }) {
  const passos = ['gerando.1', 'gerando.2', 'gerando.3'].map((k) => el('li', { texto: t(k) }))
  mostrar(logo(), el('h1', { texto: t('gerando.titulo') }), el('ol', { class: 'passos' }, passos))
  let i = 0
  const tique = setInterval(() => { if (i < passos.length) passos[i++].classList.add('feito') }, 700)

  const { data, error } = await invocar(supabase, 'gerar-mes', { body: { estrategia } })
  clearInterval(tique)
  if (!error) {
    mesPreferido = data?.anoMes ?? null // mostra o mês que acabou de ser gerado
    return aposGerar()
  }

  let msg = t('erro.geral'), status = 0
  try {
    status = error.context?.status ?? 0
    msg = (await error.context.json()).erro ?? msg
  } catch { /* sem corpo: fica a mensagem geral */ }
  if (status === 409) return atualizar() // o mês já existe (outra aba ou clique duplo): mostra o que está gravado
  mostrar(logo(), el('p', { class: 'erro', role: 'alert', texto: msg }),
    el('div', { class: 'acoes' }, el('button', { type: 'button', texto: t('comum.tentar'), onclick: voltar })))
}

