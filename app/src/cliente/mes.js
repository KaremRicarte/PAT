// Quiz do mês (serviços e estratégia) e geração. O calendário fica em calendario.js.
import { t } from '../textos.js'
import { el, logo, mostrar, botaoSair } from '../comum.js'
import { RAMOS } from '../../../supabase/functions/_shared/modelos/ramos/index.ts'
import { mesAlvo, hojeEmSaoPaulo, nomeDoMes } from '../../../supabase/functions/_shared/modelos/calendario.ts'
import { datasDoMes, diaMes } from '../../../supabase/functions/_shared/modelos/datas.ts'
import { opcoes, telaPassos } from './quiz.js'
import { estadoDoNegocio } from './perguntas.js'
import { depoisDeSalvar } from './refazer.js'
import { salvarItens, itensParaSalvar, carregarNegocio } from './negocio.js'

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

export function textoParaCopiar(post) {
  return post.hashtags.length ? `${post.legenda}\n\n${post.hashtags.join(' ')}` : post.legenda
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
  const comPromo = (produtos ?? []).filter((p) => p.promo_data && p.promo_data.startsWith(alvo.anoMes) &&
    p.promo_data >= alvo.inicio && p.preco != null && p.preco_promo != null && Number(p.preco_promo) < Number(p.preco))
  const especiais = datasDoMes(alvo.anoMes, ramo).filter((d) => d.data >= alvo.inicio)
  const outros = [...new Set(comPromo.map((p) => p.promo_data))].filter((d) => !especiais.some((x) => x.data === d))
  return [...especiais.map((d) => ({ data: d.data, nome: d.nome, especial: d })),
    ...outros.map((d) => ({ data: d, nome: t('mesq.datas.outro'), especial: null }))]
    .sort((a, b) => a.data.localeCompare(b.data))
    .map((x) => ({ ...x, itens: comPromo.filter((p) => p.promo_data === x.data).map((p) => p.nome) }))
}

export function listaDeDatas(alvo, ramo, produtos) {
  const datas = datasDaEstrategia(alvo, ramo, produtos)
  if (!datas.length) return null
  const semana = (d) => SEMANA_CURTA[new Date(`${d}T00:00:00Z`).getUTCDay()]
  return [el('h2', { texto: t('mesq.datas.titulo', { mes: nomeDoMes(alvo.anoMes) }) }),
    el('ul', { class: 'datas-mes' }, datas.map((x) => el('li', {},
      el('strong', { texto: `${semana(x.data)}, ${diaMes(x.data)} · ${x.nome}` }),
      el('small', { texto: x.itens.length ? t('mesq.datas.promo', { itens: x.itens.join(', ') })
        : x.especial?.soPromo ? t('mesq.datas.so')
          : x.especial?.promo ? `${t('mesq.datas.post')} ${t('mesq.datas.dica')}` : t('mesq.datas.post') }))))]
}

function telaEstrategia({ ctx, ramo, alvo, antes, voltar: aoVoltar }) {
  const { supabase, cliente, meses, atualizar } = ctx
  let escolhida = sugestaoEstrategia(meses[0] ?? null) // meses vem do mais recente para o mais antigo
  const sugerida = escolhida
  const gerar = el('button', { type: 'submit', texto: t('mesq.gerar', { mes: nomeDoMes(alvo.anoMes) }) })
  const voltar = el('button', { type: 'button', class: 'secundario', texto: t('quiz.voltar'), onclick: aoVoltar })
  const form = el('form', { novalidate: true, class: 'quiz' },
    el('h1', { texto: t('mesq.titulo') }),
    el('p', { class: 'muted', texto: t('mesq.dica', { mes: nomeDoMes(alvo.anoMes) }) }),
    cartoesEstrategia(ramo, escolhida, (v) => { escolhida = v }, sugerida),
    listaDeDatas(alvo, ramo, ctx.produtos),
    el('div', { class: 'acoes' }, gerar, voltar, botaoSair(supabase)))
  form.addEventListener('submit', (ev) => {
    ev.preventDefault()
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

  const { data, error } = await supabase.functions.invoke('gerar-mes', { body: { estrategia } })
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

