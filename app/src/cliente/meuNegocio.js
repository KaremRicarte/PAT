// Página-resumo "Meu negócio": uma linha por pergunta fixa, com 'Alterar' que abre só aquela pergunta.
// As redes são definidas pela administração (sem botão).
import { t } from '../textos.js'
import { el, logo, mostrar } from '../comum.js'
import { RAMOS } from '../../../supabase/functions/_shared/modelos/ramos/index.ts'
import { PERGUNTAS_FIXAS, estadoDoNegocio, resumoDaPergunta, nomesDasRedes } from './perguntas.js'
import { telaPassos } from './quiz.js'
import { salvarDadosNegocio, carregarNegocio, normalizarInsta } from './negocio.js'

// Linhas puras: [{ chave, rotulo, resumo }] na ordem de PERGUNTAS_FIXAS (cores têm resumo vazio).
export function linhasDoResumo(estado, ramo) {
  return PERGUNTAS_FIXAS.map((chave) => ({ chave, rotulo: t(`meu.rotulo.${chave}`), resumo: resumoDaPergunta(chave, estado, ramo) }))
}

// ctx: { supabase, cliente, negocio, produtos, atualizar }
export function telaMeuNegocio(ctx) {
  const { supabase, cliente } = ctx
  const ramo = RAMOS[cliente.ramo]
  const estado = estadoDoNegocio(ctx.negocio, ctx.produtos, ramo)

  const linhas = linhasDoResumo(estado, ramo).map(({ chave, rotulo, resumo }) => {
    const valor = chave === 'cores'
      ? el('span', { class: 'valor' }, ...[estado.cor1, estado.cor2].map((c) => el('span', { class: 'quadrado-cor', style: `background:${c}`, 'aria-hidden': 'true' })))
      : el('span', { class: 'valor', texto: resumo })
    const alterar = el('button', { type: 'button', class: 'secundario', texto: t('meu.alterar'), 'aria-label': `${t('meu.alterar')}: ${rotulo}`, onclick: () => alterarUma(chave) })
    return el('div', { class: 'linha-negocio' }, el('div', {}, el('span', { class: 'rotulo-linha', texto: rotulo }), valor), alterar)
  })

  mostrar(logo(),
    el('h1', { texto: t('meu.titulo') }),
    ...linhas,
    el('div', { class: 'linha-negocio' }, el('div', {},
      el('span', { class: 'rotulo-linha', texto: t('meu.rotulo.redes') }),
      el('span', { class: 'valor', texto: nomesDasRedes(cliente.redes) }),
      el('small', { class: 'muted', texto: t('meu.redes.aviso') }))),
    el('div', { class: 'acoes' }, el('button', { type: 'button', class: 'secundario', texto: t('meu.voltar'), onclick: () => ctx.atualizar() })))

  function alterarUma(chave) {
    const e = estadoDoNegocio(ctx.negocio, ctx.produtos, ramo)
    telaPassos({
      titulo: t('meu.titulo'), perguntas: [chave], rotuloFinal: t('quiz.salvar.so'),
      ctx: { ramo, estado: e, supabase },
      aoCancelar: () => telaMeuNegocio(ctx),
      aoSalvar: async (novo) => {
        await salvarDadosNegocio(supabase, cliente.id, { ...novo, insta: normalizarInsta(novo.insta) })
        const { negocio, produtos } = await carregarNegocio(supabase, cliente.id)
        telaMeuNegocio({ ...ctx, negocio, produtos })
      },
    })
  }
}
