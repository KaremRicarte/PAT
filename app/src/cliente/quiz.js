// Executor de passos: uma pergunta por tela. As perguntas vêm de perguntas.js; quem chama decide
// quais perguntas rodar e o que fazer ao final (aoSalvar).
import { t } from '../textos.js'
import { el, logo, mostrar } from '../comum.js'
import { pergunta } from './perguntas.js'

export { opcoes } from './perguntas.js'

// perguntas: chaves de perguntas.js. ctx: { ramo, estado, supabase }.
// aoSalvar(estado, aoProgredir?) roda no último passo; se falhar, mostra erro.geral e reabilita o botão.
// Voltar no primeiro passo chama aoCancelar (sem ele, o botão some).
export function telaPassos({ titulo, perguntas, ctx, rotuloFinal, aoSalvar, aoCancelar }) {
  let atual = 0
  desenhar()

  function desenhar() {
    const { titulo: tituloPasso, corpo, validar } = pergunta(perguntas[atual], ctx)
    const ultimo = atual === perguntas.length - 1
    const erro = el('p', { class: 'erro', role: 'alert', hidden: true })
    const continuar = el('button', { type: 'submit', texto: ultimo ? rotuloFinal : t('quiz.continuar') })
    const voltar = el('button', { type: 'button', class: 'secundario', texto: t('quiz.voltar') })
    voltar.hidden = atual === 0 && !aoCancelar
    voltar.addEventListener('click', () => {
      if (atual === 0) return aoCancelar()
      atual--
      desenhar()
    })

    const form = el('form', { novalidate: true, class: 'quiz' },
      perguntas.length > 1 ? el('p', { class: 'muted passo', texto: t('quiz.passo', { n: atual + 1, total: perguntas.length }) }) : null,
      el('span', { class: 'selo neutro', texto: titulo ?? t('quiz.ramo', { ramo: ctx.ramo.nome }) }),
      el('h1', { texto: tituloPasso }), corpo, erro,
      el('div', { class: 'acoes' }, continuar, voltar))

    form.addEventListener('submit', async (ev) => {
      ev.preventDefault()
      const msg = validar?.()
      if (msg) { erro.textContent = msg; erro.hidden = false; return }
      if (!ultimo) { atual++; desenhar(); window.scrollTo(0, 0); return }
      continuar.disabled = true
      erro.hidden = true
      const textoBotao = continuar.textContent
      try {
        await aoSalvar(ctx.estado, (feitas, total) => { continuar.textContent = t('quiz.salvando.fotos', { feitas, total }) })
      } catch (e) {
        console.error(e)
        erro.textContent = t('erro.geral')
        erro.hidden = false
        continuar.disabled = false
        continuar.textContent = textoBotao
      }
    })
    mostrar(logo(), form)
  }
}
