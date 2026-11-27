// Cartão "Este mês": estratégia, serviços e redes do mês mostrado, e as telas que ele abre
// (editar os serviços). A estratégia é escolhida ao gerar o mês e não muda depois.
import { t } from '../textos.js'
import { el } from '../comum.js'
import { RAMOS } from '../../../supabase/functions/_shared/modelos/ramos/index.ts'
import { servicosSemFoto } from './situacao.js'
import { telaPassos } from './quiz.js'
import { estadoDoNegocio, nomesDasRedes } from './perguntas.js'
import { salvarItens, itensParaSalvar } from './negocio.js'
import { depoisDeSalvar } from './refazer.js'
import { rotuloEstrategia } from './mes.js'

// '4 itens · 1 sem foto' / '1 item'.
export function resumoServicos(produtos, ramo, fotosInfo) {
  const n = produtos.length
  const sem = servicosSemFoto(produtos, ramo, fotosInfo)
  const total = t(n === 1 ? 'este.itens.um' : 'este.itens.n', { n })
  return sem ? `${total} · ${t('este.semfoto', { n: sem })}` : total
}

// ctx: { supabase, cliente, negocio, produtos, meses, atualizar, ramo, posts }; mes: o mês mostrado.
export function cartaoEsteMes(ctx, mes) {
  const ramo = ctx.ramo ?? RAMOS[ctx.cliente.ramo]
  const linha = (rotulo, valor, botao) => el('div', { class: 'linha-negocio' },
    el('div', {}, el('span', { class: 'rotulo-linha', texto: rotulo }), el('span', { class: 'valor', texto: valor })), botao)
  const editar = el('button', { type: 'button', class: 'secundario', texto: t('este.editar'), 'aria-label': `${t('este.editar')}: ${ramo.itens}`,
    onclick: () => telaServicos(ctx) })
  return el('section', { class: 'este-mes', 'aria-label': t('este.titulo') },
    el('h2', { texto: t('este.titulo') }),
    // a estratégia é escolhida ao gerar o mês e não muda depois (os posts e as datas já foram montados com ela)
    el('div', { class: 'linha-negocio' }, el('div', {}, el('span', { class: 'rotulo-linha', texto: t('este.estrategia') }),
      el('span', { class: 'valor', texto: rotuloEstrategia(mes.estrategia, ramo) }),
      el('small', { class: 'muted', texto: t('este.estrategia.fixa') }))),
    linha(ramo.itens, resumoServicos(ctx.produtos ?? [], ramo, ctx.fotosInfo), editar),
    el('p', { class: 'muted', texto: t('este.redes', { redes: nomesDasRedes(mes.redes) }) }))
}

// Só os serviços: o mesmo passo do quiz, com 'Salvar'. Depois pergunta se refaz os posts, se os itens mudaram.
export function telaServicos(ctx) {
  const { supabase, cliente, meses, atualizar } = ctx
  const ramo = ctx.ramo ?? RAMOS[cliente.ramo]
  const antes = ctx.produtos
  const recarregar = () => { ctx.mesDosPosts = null; return atualizar() } // os posts podem ter sido refeitos
  telaPassos({
    perguntas: ['itens'], rotuloFinal: t('quiz.salvar.so'),
    ctx: { ramo, estado: estadoDoNegocio(ctx.negocio, ctx.produtos, ramo), supabase, fotosInfo: ctx.fotosInfo },
    aoCancelar: atualizar,
    aoSalvar: async (e, aoProgredir) => {
      await salvarItens(supabase, cliente.id, itensParaSalvar(e.itens, ramo), aoProgredir, { aoFotosInfo: (m) => { ctx.fotosInfo = m } })
      await depoisDeSalvar({ supabase, cliente, produtos: antes, meses, atualizar: recarregar })
    },
  })
}

