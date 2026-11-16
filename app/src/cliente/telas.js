import { t } from '../textos.js'
import { el, logo, mostrar, telaEntrar, botaoSair, formSenha, aviso } from '../comum.js'
import { CONTATO_ADMIN, linkWhatsApp } from '../contato.js'
import { telaQuiz } from './quiz.js'
import { telaQuizMes } from './mes.js'
import { telaCalendario } from './calendario.js'

// ctx: { supabase, cliente, negocio, produtos, meses, atualizar, fimDaRecuperacao }
export function desenhar(tela, ctx) {
  const { supabase, cliente, atualizar } = ctx
  if (tela === 'entrar') return telaEntrar(supabase)

  if (tela === 'trocar-senha') {
    const form = formSenha(supabase, {
      titulo: t('senha.titulo'),
      extras: [botaoSair(supabase)],
      aoSalvar: async () => {
        const { error } = await supabase.rpc('marcar_senha_trocada')
        if (error) return t('erro.geral')
        await atualizar()
        return null
      },
    })
    return mostrar(logo(), form)
  }

  // Chegou pelo link de "Esqueci minha senha": a sessão já é dele, falta só a senha nova.
  if (tela === 'nova-senha') {
    const form = formSenha(supabase, {
      titulo: t('senha.nova.titulo'),
      texto: t('senha.nova.texto'),
      aoSalvar: async () => {
        // quem ainda tinha a senha provisória acabou de criar a dele
        if (cliente?.senha_provisoria) {
          const { error } = await supabase.rpc('marcar_senha_trocada')
          if (error) return t('erro.geral')
        }
        ctx.fimDaRecuperacao()
        aviso(t('senha.salva'))
        await atualizar()
        return null
      },
    })
    return mostrar(logo(), form)
  }

  if (tela === 'pausado') {
    return mostrar(logo(),
      el('h1', { texto: t('pausado.titulo') }),
      el('p', { class: 'muted', texto: t('pausado.texto') }),
      el('p', { class: 'contato', texto: CONTATO_ADMIN.exibir }),
      el('div', { class: 'acoes' },
        el('a', { class: 'botao', href: linkWhatsApp(CONTATO_ADMIN.whatsapp, t('pausado.mensagem')), target: '_blank', rel: 'noopener', texto: t('pausado.whatsapp') }),
        botaoSair(supabase)))
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
  if (tela === 'mes') return telaCalendario(ctx, editarNegocio, diaDaUrl())

  // 'erro': sessão sem cadastro de cliente
  return mostrar(logo(),
    el('p', { texto: t('erro.cadastro') }),
    el('div', { class: 'acoes' }, botaoSair(supabase)))
}

// Dia vindo da notificação (?dia=AAAA-MM-DD). Lido uma vez: o parâmetro sai da URL.
function diaDaUrl() {
  const dia = new URLSearchParams(location.search).get('dia')
  if (dia === null) return undefined
  history.replaceState(null, '', location.pathname)
  return /^\d{4}-\d{2}-\d{2}$/.test(dia) ? dia : undefined
}

// Reabre o quiz preenchido; salvar ou voltar recarrega o app.
export function editarNegocio({ supabase, cliente, negocio, produtos, atualizar }) {
  telaQuiz({ supabase, cliente, inicial: { negocio, produtos }, aoSalvar: atualizar, aoCancelar: atualizar })
}
