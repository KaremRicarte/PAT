import { t } from '../textos.js'
import { el, logo, campo, mostrar, aoEnviar, telaEntrar, botaoSair } from '../comum.js'

export function desenhar(tela, { supabase, cliente, aoTrocarSenha }) {
  if (tela === 'entrar') return telaEntrar(supabase)

  if (tela === 'trocar-senha') {
    const form = el('form', { novalidate: true },
      el('h1', { texto: t('senha.titulo') }),
      campo(t('senha.nova'), { name: 'senha', type: 'password', autocomplete: 'new-password', minlength: 8, required: true }),
      campo(t('senha.repetir'), { name: 'repetir', type: 'password', autocomplete: 'new-password', required: true }),
      el('div', { class: 'acoes' }, el('button', { type: 'submit', texto: t('senha.botao') }), botaoSair(supabase)),
    )
    aoEnviar(form, async (d) => {
      const senha = String(d.get('senha'))
      if (senha.length < 8) return t('senha.curta')
      if (senha !== String(d.get('repetir'))) return t('senha.diferente')
      const { error } = await supabase.auth.updateUser({ password: senha })
      if (error) return t('erro.geral')
      const { error: e2 } = await supabase.rpc('marcar_senha_trocada')
      if (e2) return t('erro.geral')
      await aoTrocarSenha()
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

  if (tela === 'inicio') {
    return mostrar(logo(),
      el('h1', { texto: t('inicio.ola', { nome: cliente.nome.split(' ')[0] }) }),
      el('p', { class: 'muted', texto: t('inicio.embreve') }),
      el('div', { class: 'acoes' }, botaoSair(supabase)))
  }

  // 'erro': sessão sem cadastro de cliente
  return mostrar(logo(),
    el('p', { texto: t('erro.cadastro') }),
    el('div', { class: 'acoes' }, botaoSair(supabase)))
}
