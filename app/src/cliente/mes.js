// Quiz do mês (estratégia), geração e lista do mês.
import { t } from '../textos.js'
import { el, logo, mostrar, botaoSair, carregando } from '../comum.js'
import { RAMOS } from '../../../supabase/functions/_shared/modelos/ramos/index.ts'
import { mesAlvo, hojeEmSaoPaulo, nomeDoMes } from '../../../supabase/functions/_shared/modelos/calendario.ts'
import { opcoes } from './quiz.js'

const ESTRATEGIAS = ['vender', 'crescer', 'credibilidade', 'tempo']
const ORDEM_REDE = { instagram: 0, facebook: 1, tiktok: 2, whatsapp: 3 }
const DIAS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']
const MESES = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez']

// Em ramos com regras de conselho (noPromo), "Vender mais" vira "Atrair contatos".
export function rotuloEstrategia(estrategia, ramo) {
  return t(estrategia === 'vender' && ramo.noPromo ? 'estrategia.contatos' : `estrategia.${estrategia}`)
}
const descricaoEstrategia = (estrategia, ramo) =>
  t(estrategia === 'vender' && ramo.noPromo ? 'estrategia.contatos.desc' : `estrategia.${estrategia}.desc`)

export function sugestaoEstrategia(mesAnterior) {
  return mesAnterior?.estrategia ?? 'tempo'
}

export function agruparPorDia(posts) {
  const dias = new Map()
  for (const p of posts) {
    if (!dias.has(p.data)) dias.set(p.data, [])
    dias.get(p.data).push(p)
  }
  return [...dias.keys()].sort().map((data) => {
    const d = new Date(`${data}T00:00:00Z`)
    return {
      data,
      titulo: `${DIAS[d.getUTCDay()]}, ${d.getUTCDate()} de ${MESES[d.getUTCMonth()]}`,
      posts: dias.get(data).sort((a, b) => ORDEM_REDE[a.rede] - ORDEM_REDE[b.rede] || a.ordem - b.ordem),
    }
  })
}

// Mês mostrado: o escolhido (ou recém-gerado), senão o de hoje, senão o mais recente.
export function escolherMes(meses, hoje, preferido) {
  return meses.find((m) => m.ano_mes === preferido) ?? meses.find((m) => m.ano_mes === hoje.slice(0, 7)) ?? meses[0]
}
let mesPreferido = null // guarda o mês recém-gerado ou escolhido nos botões

export function textoParaCopiar(post) {
  return post.hashtags.length ? `${post.legenda}\n\n${post.hashtags.join(' ')}` : post.legenda
}

// ---------- Quiz do mês ----------
export function telaQuizMes({ supabase, cliente, meses, atualizar }) {
  const ramo = RAMOS[cliente.ramo]
  const alvo = mesAlvo(hojeEmSaoPaulo(), meses.map((m) => m.ano_mes))
  if (!alvo) return atualizar()
  let escolhida = sugestaoEstrategia(meses[0] ?? null)
  const sugerida = escolhida

  const erro = el('p', { class: 'erro', role: 'alert', hidden: true })
  const gerar = el('button', { type: 'submit', texto: t('mesq.gerar', { mes: nomeDoMes(alvo.anoMes) }) })
  const voltar = el('button', { type: 'button', class: 'secundario', texto: t('quiz.voltar'), onclick: atualizar })
  voltar.hidden = !meses.length
  const form = el('form', { novalidate: true, class: 'quiz' },
    el('h1', { texto: t('mesq.titulo') }),
    el('p', { class: 'muted', texto: t('mesq.dica', { mes: nomeDoMes(alvo.anoMes) }) }),
    opcoes('estrategia', ESTRATEGIAS.map((e) => [e, rotuloEstrategia(e, ramo), descricaoEstrategia(e, ramo),
      e === sugerida ? t('mesq.sugerido') : null]), escolhida, (v) => { escolhida = v }),
    erro,
    el('div', { class: 'acoes' }, gerar, voltar, botaoSair(supabase)))
  form.addEventListener('submit', (ev) => {
    ev.preventDefault()
    telaGerando({ supabase, atualizar, estrategia: escolhida, voltar: () => telaQuizMes({ supabase, cliente, meses, atualizar }) })
  })
  mostrar(logo(), form)
}

// ---------- Gerando ----------
async function telaGerando({ supabase, atualizar, estrategia, voltar }) {
  const passos = ['gerando.1', 'gerando.2', 'gerando.3'].map((k) => el('li', { texto: t(k) }))
  mostrar(logo(), el('h1', { texto: t('gerando.titulo') }), el('ol', { class: 'passos' }, passos))
  let i = 0
  const tique = setInterval(() => { if (i < passos.length) passos[i++].classList.add('feito') }, 700)

  const { data, error } = await supabase.functions.invoke('gerar-mes', { body: { estrategia } })
  clearInterval(tique)
  if (!error) {
    mesPreferido = data?.anoMes ?? null // mostra o mês que acabou de ser gerado
    return atualizar()
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

// ---------- Lista do mês ----------
export async function telaMes(ctx, editarNegocio) {
  const { supabase, cliente, meses, atualizar } = ctx
  const ramo = RAMOS[cliente.ramo]
  const hoje = hojeEmSaoPaulo()
  const mes = escolherMes(meses, hoje, mesPreferido)

  carregando()
  const { data: posts, error } = await supabase.from('posts')
    .select('id, data, rede, tipo, formato, titulo, legenda, hashtags, roteiro, ordem')
    .eq('mes_id', mes.id).order('data').order('ordem')
  if (error) {
    console.error(error)
    return mostrar(logo(), el('p', { class: 'erro', texto: t('erro.geral') }),
      el('div', { class: 'acoes' }, el('button', { type: 'button', texto: t('comum.tentar'), onclick: atualizar })))
  }

  const alvo = mesAlvo(hoje, meses.map((m) => m.ano_mes))
  const proximo = alvo
    ? el('button', { type: 'button', texto: t('mes.gerarproximo', { mes: nomeDoMes(alvo.anoMes) }), onclick: () => telaQuizMes(ctx) })
    : null
  const editar = el('button', { type: 'button', class: 'secundario', texto: t('mes.editar'), onclick: () => editarNegocio(ctx) })

  // botões para alternar entre os meses mais recentes (ex.: o atual e o próximo já gerado)
  const trocaMes = meses.length > 1
    ? el('div', { class: 'chips' }, meses.slice(0, 3).map((m) => el('button', {
      type: 'button', class: m.id === mes.id ? 'chip ativo' : 'chip', 'aria-pressed': String(m.id === mes.id),
      texto: nomeDoMes(m.ano_mes), onclick: () => { mesPreferido = m.ano_mes; telaMes(ctx, editarNegocio) },
    })))
    : null

  mostrar(
    el('header', { class: 'topo' }, logo(), botaoSair(supabase)),
    trocaMes,
    el('h1', { texto: t('mes.titulo', { mes: nomeDoMes(mes.ano_mes) }) }),
    el('p', {}, el('span', { class: 'selo neutro', texto: rotuloEstrategia(mes.estrategia, ramo) }),
      el('span', { class: 'muted', texto: t('mes.total', { n: posts.length }) })),
    el('div', { class: 'acoes' }, proximo, editar),
    agruparPorDia(posts).map((dia) => el('section', { class: dia.data === hoje ? 'dia hoje' : 'dia' },
      el('h2', {}, dia.titulo, dia.data === hoje ? el('span', { class: 'selo bom', texto: t('mes.hoje') }) : null),
      dia.posts.map(cartaoPost))),
  )
}

function cartaoPost(p) {
  const copiar = el('button', { type: 'button', class: 'pequeno', texto: t('mes.copiar') })
  copiar.addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(textoParaCopiar(p))
      copiar.textContent = t('mes.copiado')
    } catch { copiar.textContent = t('mes.naocopiou') }
  })
  return el('details', { class: `post rede-${p.rede}` },
    el('summary', {},
      el('span', { class: 'rede', texto: `${t(`rede.${p.rede}`)} · ${t(`formato.${p.tipo === 'feed' || p.tipo === 'video' ? p.formato : p.tipo}`)}` }),
      el('strong', { texto: p.titulo })),
    el('p', { class: 'legenda', texto: p.legenda }),
    p.hashtags.length ? el('p', { class: 'muted hashtags', texto: p.hashtags.join(' ') }) : null,
    p.roteiro ? el('div', { class: 'roteiro' }, el('p', { class: 'rotulo', texto: t('mes.roteiro') }),
      el('p', { class: 'legenda', texto: p.roteiro.replace(/^Como montar: /, '') })) : null,
    el('div', { class: 'acoes' }, copiar))
}
