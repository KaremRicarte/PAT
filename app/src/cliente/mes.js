// Quiz do mês (estratégia e redes) e geração. O calendário fica em calendario.js.
import { t } from '../textos.js'
import { el, logo, mostrar, botaoSair } from '../comum.js'
import { RAMOS } from '../../../supabase/functions/_shared/modelos/ramos/index.ts'
import { mesAlvo, hojeEmSaoPaulo, nomeDoMes } from '../../../supabase/functions/_shared/modelos/calendario.ts'
import { REDES } from '../../../supabase/functions/_shared/modelos/tipos.ts'
import { opcoes } from './quiz.js'

export { REDES }

const ESTRATEGIAS = ['vender', 'crescer', 'credibilidade', 'tempo']

// Em ramos com regras de conselho (noPromo), "Vender mais" vira "Atrair contatos".
export function rotuloEstrategia(estrategia, ramo) {
  return t(estrategia === 'vender' && ramo.noPromo ? 'estrategia.contatos' : `estrategia.${estrategia}`)
}
const descricaoEstrategia = (estrategia, ramo) =>
  t(estrategia === 'vender' && ramo.noPromo ? 'estrategia.contatos.desc' : `estrategia.${estrategia}.desc`)

export function sugestaoEstrategia(mesAnterior) {
  return mesAnterior?.estrategia ?? 'tempo'
}

// Redes pré-marcadas: as do mês anterior (na ordem das opções); no primeiro mês, todas.
export function sugestaoRedes(mesAnterior) {
  const anteriores = mesAnterior?.redes
  return anteriores?.length ? REDES.filter((r) => anteriores.includes(r)) : [...REDES]
}

// "Todas": marca as 4; se as 4 já estão marcadas, desmarca todas.
export const alternarTodas = (redes) => (REDES.every((r) => redes.includes(r)) ? [] : [...REDES])

// Caixinhas de marcar das redes, no visual dos cartões de estratégia, com a opção "Todas" no topo.
function escolhaRedes(atuais, aoMudar) {
  let redes = [...atuais]
  const caixa = (name) => el('input', { type: 'checkbox', name })
  const cartao = (input, rotulo) => el('label', { class: 'cartao' }, input, el('span', {}, el('strong', { texto: rotulo })))
  const todas = caixa('redes-todas')
  const porRede = REDES.map((r) => [r, caixa('redes')])
  const sincronizar = () => {
    for (const [r, input] of porRede) input.checked = redes.includes(r)
    todas.checked = REDES.every((r) => redes.includes(r))
    aoMudar([...redes])
  }
  todas.addEventListener('change', () => { redes = alternarTodas(redes); sincronizar() })
  for (const [r, input] of porRede) {
    input.addEventListener('change', () => {
      redes = REDES.filter((x) => (x === r ? input.checked : redes.includes(x)))
      sincronizar()
    })
  }
  const grupo = el('fieldset', { class: 'redes' },
    el('legend', { texto: t('mesq.redes.titulo') }),
    el('div', { class: 'opcoes' }, cartao(todas, t('mesq.redes.todas')),
      porRede.map(([r, input]) => cartao(input, t(`mesq.redes.${r}`)))))
  sincronizar()
  return grupo
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
export function telaQuizMes({ supabase, cliente, meses, atualizar }) {
  const ramo = RAMOS[cliente.ramo]
  const alvo = mesAlvo(hojeEmSaoPaulo(), meses.map((m) => m.ano_mes))
  if (!alvo) return atualizar()
  let escolhida = sugestaoEstrategia(meses[0] ?? null)
  const sugerida = escolhida
  let redes = sugestaoRedes(meses[0] ?? null) // meses vem do mais recente para o mais antigo

  const erro = el('p', { class: 'erro', role: 'alert', hidden: true })
  const gerar = el('button', { type: 'submit', texto: t('mesq.gerar', { mes: nomeDoMes(alvo.anoMes) }) })
  const voltar = el('button', { type: 'button', class: 'secundario', texto: t('quiz.voltar'), onclick: atualizar })
  voltar.hidden = !meses.length
  const form = el('form', { novalidate: true, class: 'quiz' },
    el('h1', { texto: t('mesq.titulo') }),
    el('p', { class: 'muted', texto: t('mesq.dica', { mes: nomeDoMes(alvo.anoMes) }) }),
    opcoes('estrategia', ESTRATEGIAS.map((e) => [e, rotuloEstrategia(e, ramo), descricaoEstrategia(e, ramo),
      e === sugerida ? t('mesq.sugerido') : null]), escolhida, (v) => { escolhida = v }),
    escolhaRedes(redes, (v) => { redes = v; if (v.length) erro.hidden = true }),
    erro,
    el('div', { class: 'acoes' }, gerar, voltar, botaoSair(supabase)))
  form.addEventListener('submit', (ev) => {
    ev.preventDefault()
    if (!redes.length) {
      erro.textContent = t('mesq.redes.erro')
      erro.hidden = false
      return erro.scrollIntoView?.({ block: 'center' })
    }
    telaGerando({ supabase, atualizar, estrategia: escolhida, redes, voltar: () => telaQuizMes({ supabase, cliente, meses, atualizar }) })
  })
  mostrar(logo(), form)
}

// ---------- Gerando ----------
async function telaGerando({ supabase, atualizar, estrategia, redes, voltar }) {
  const passos = ['gerando.1', 'gerando.2', 'gerando.3'].map((k) => el('li', { texto: t(k) }))
  mostrar(logo(), el('h1', { texto: t('gerando.titulo') }), el('ol', { class: 'passos' }, passos))
  let i = 0
  const tique = setInterval(() => { if (i < passos.length) passos[i++].classList.add('feito') }, 700)

  const { data, error } = await supabase.functions.invoke('gerar-mes', { body: { estrategia, redes } })
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

