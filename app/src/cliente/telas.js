import { t } from '../textos.js'
import { el, logo, campo, mostrar, aoEnviar, telaEntrar, botaoSair } from '../comum.js'
import { erroTrocaSenha } from './tela.js'
import { telaQuiz } from './quiz.js'
import { telaQuizMes, telaMes } from './mes.js'

// ctx: { supabase, cliente, negocio, produtos, meses, atualizar }
export function desenhar(tela, ctx) {
  const { supabase, cliente, atualizar } = ctx
  if (tela === 'entrar') return telaEntrar(supabase)

  if (tela === 'trocar-senha') {
    const form = el('form', { novalidate: true },
      el('h1', { texto: t('senha.titulo') }),
      campo(t('senha.nova'), { name: 'senha', type: 'password', autocomplete: 'new-password', minlength: 8, required: true }),
      campo(t('senha.repetir'), { name: 'repetir', type: 'password', autocomplete: 'new-password', required: true }),
      el('div', { class: 'acoes' }, el('button', { type: 'submit', texto: t('senha.botao') }), botaoSair(supabase)),
    )
    let senhaJaTrocada = false // se só a marcação falhar, a nova tentativa refaz só ela
    aoEnviar(form, async (d) => {
      const senha = String(d.get('senha'))
      if (senha.length < 8) return t('senha.curta')
      if (senha !== String(d.get('repetir'))) return t('senha.diferente')
      if (!senhaJaTrocada) {
        const { error } = await supabase.auth.updateUser({ password: senha })
        if (error) return t(erroTrocaSenha(error))
        senhaJaTrocada = true
      }
      const { error: e2 } = await supabase.rpc('marcar_senha_trocada')
      if (e2) return t('erro.geral')
      await atualizar()
      return null
    })
    return mostrar(logo(), form)
  }

  if (tela === 'pausado') {
    return mostrar(logo(),
      el('h1', { texto: t('pausado.titulo') }),
      el('p', { class: 'muted', texto: t('pausado.texto') }),
      el('div', { class: 'acoes' }, botaoSair(supabase)))
  }

  if (tela === 'sem-ramo') {
    return mostrar(logo(),
      el('h1', { texto: t('inicio.ola', { nome: cliente.nome.split(' ')[0] }) }),
      el('p', { class: 'muted', texto: t('semramo.texto') }),
      el('div', { class: 'acoes' }, botaoSair(supabase)))
  }

  if (tela === 'quiz-negocio') {
    // se o cadastro ficou pela metade, reabre com o que já foi salvo
    const inicial = ctx.negocio ? { negocio: ctx.negocio, produtos: ctx.produtos } : null
    return telaQuiz({ supabase, cliente, inicial, aoSalvar: atualizar })
  }

  if (tela === 'quiz-mes') return telaQuizMes(ctx)
  if (tela === 'mes') return telaMes(ctx, editarNegocio)

  // 'erro': sessão sem cadastro de cliente
  return mostrar(logo(),
    el('p', { texto: t('erro.cadastro') }),
    el('div', { class: 'acoes' }, botaoSair(supabase)))
}

// Reabre o quiz preenchido; salvar ou voltar recarrega o app.
export function editarNegocio({ supabase, cliente, negocio, produtos, atualizar }) {
  telaQuiz({ supabase, cliente, inicial: { negocio, produtos }, aoSalvar: atualizar, aoCancelar: atualizar })
}
