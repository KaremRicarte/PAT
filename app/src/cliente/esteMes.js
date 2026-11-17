// Cartão "Este mês": estratégia, serviços e redes do mês mostrado, e as telas que ele abre
// (editar os serviços e trocar a estratégia).
import { t } from '../textos.js'
import { el, logo, mostrar, aviso } from '../comum.js'
import { RAMOS } from '../../../supabase/functions/_shared/modelos/ramos/index.ts'
import { hojeEmSaoPaulo } from '../../../supabase/functions/_shared/modelos/calendario.ts'
import { servicosSemFoto } from './situacao.js'
import { telaPassos } from './quiz.js'
import { estadoDoNegocio, nomesDasRedes } from './perguntas.js'
import { salvarItens, itensParaSalvar } from './negocio.js'
import { depoisDeSalvar, chamarFuncao } from './refazer.js'
import { rotuloEstrategia, cartoesEstrategia } from './mes.js'

// A estratégia só muda no mês atual ou nos futuros. hoje: 'AAAA-MM-DD'.
export const podeTrocarEstrategia = (mes, hoje) => mes.ano_mes >= hoje.slice(0, 7)

// Posts que a troca refaz: os não postados de hoje em diante (mês atual) ou do mês inteiro (mês futuro).
export function postsQueMudam(posts, mes, hoje) {
  const desde = mes.ano_mes === hoje.slice(0, 7) ? hoje : `${mes.ano_mes}-01`
  return posts.filter((p) => !p.postado_em && p.data >= desde).length
}

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
  const trocar = podeTrocarEstrategia(mes, hojeEmSaoPaulo())
    ? el('button', { type: 'button', class: 'secundario', texto: t('este.trocar'), 'aria-label': `${t('este.trocar')}: ${t('este.estrategia')}`,
      onclick: () => telaTrocarEstrategia(ctx, mes) })
    : null
  const editar = el('button', { type: 'button', class: 'secundario', texto: t('este.editar'), 'aria-label': `${t('este.editar')}: ${ramo.itens}`,
    onclick: () => telaServicos(ctx) })
  return el('section', { class: 'este-mes', 'aria-label': t('este.titulo') },
    el('h2', { texto: t('este.titulo') }),
    linha(t('este.estrategia'), rotuloEstrategia(mes.estrategia, ramo), trocar),
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

function telaTrocarEstrategia(ctx, mes, inicial = mes.estrategia) {
  const ramo = ctx.ramo ?? RAMOS[ctx.cliente.ramo]
  let escolhida = inicial
  const voltar = () => { ctx.atualizar() }
  const form = el('form', { novalidate: true, class: 'quiz' },
    el('span', { class: 'selo neutro', texto: t('este.titulo') }),
    el('h1', { texto: t('estrat.titulo') }),
    el('p', { class: 'muted', texto: t('estrat.dica') }),
    cartoesEstrategia(ramo, escolhida, (v) => { escolhida = v }),
    el('div', { class: 'acoes' }, el('button', { type: 'submit', texto: t('quiz.continuar') }),
      el('button', { type: 'button', class: 'secundario', texto: t('quiz.voltar'), onclick: voltar })))
  form.addEventListener('submit', (ev) => {
    ev.preventDefault()
    if (escolhida === mes.estrategia) return voltar()
    confirmar(ctx, mes, escolhida, ramo, () => telaTrocarEstrategia(ctx, mes, escolhida))
  })
  mostrar(logo(), form)
}

function confirmar(ctx, mes, estrategia, ramo, aoCancelar) {
  const { supabase, atualizar } = ctx
  const n = postsQueMudam(ctx.posts ?? [], mes, hojeEmSaoPaulo())
  const chave = n === 0 ? 'estrat.confirma.zero' : n === 1 ? 'estrat.confirma.um' : 'estrat.confirma'
  const erro = el('p', { class: 'erro', role: 'alert', hidden: true })
  const trocar = el('button', { type: 'button', texto: t(n === 0 ? 'estrat.confirma.botao.zero' : 'estrat.confirma.botao') })
  const cancelar = el('button', { type: 'button', class: 'secundario', texto: t('estrat.cancelar'), onclick: aoCancelar })
  trocar.addEventListener('click', async () => {
    trocar.disabled = cancelar.disabled = true
    erro.hidden = true
    const r = await chamarFuncao(supabase, 'trocar-estrategia', { mes_id: mes.id, estrategia })
    if (r.erro) {
      erro.textContent = r.erro
      erro.hidden = false
      trocar.disabled = cancelar.disabled = false
      return
    }
    aviso(t(r.refeitos === 1 ? 'estrat.ok.um' : 'estrat.ok', { n: r.refeitos }))
    ctx.mesDosPosts = null // recarrega os posts refeitos
    atualizar()
  })
  mostrar(logo(),
    el('h1', { texto: t('estrat.confirma.titulo') }),
    el('p', { texto: t(chave, { n, estrategia: rotuloEstrategia(estrategia, ramo) }) }),
    erro,
    el('div', { class: 'acoes' }, trocar, cancelar))
}
