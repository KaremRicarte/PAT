import supabase from '../supabase.js'
import { t } from '../textos.js'
import { el, logo, mostrar, carregando, botaoSair } from '../comum.js'
import { telaInicial } from './tela.js'
import { desenhar } from './telas.js'

let acessoRegistrado = false // um evento 'acesso' por abertura do app
let usuarioMostrado // id do usuário da tela atual (undefined = nenhuma tela ainda)

async function atualizar() {
  carregando()
  const { data: { session: sessao } } = await supabase.auth.getSession()
  usuarioMostrado = sessao?.user.id ?? null

  // A situação é sempre relida do banco: um bloqueio vale na próxima abertura.
  let cliente = null
  if (sessao) {
    const { data, error } = await supabase.from('clientes')
      .select('id, nome, situacao, senha_provisoria').eq('id', sessao.user.id).maybeSingle()
    if (error) {
      return mostrar(logo(), el('p', { class: 'erro', texto: t('erro.geral') }),
        el('div', { class: 'acoes' }, el('button', { type: 'button', texto: t('comum.tentar'), onclick: atualizar }), botaoSair(supabase)))
    }
    cliente = data
  }

  const tela = telaInicial({ sessao, cliente })
  if (tela === 'inicio' && !acessoRegistrado) {
    acessoRegistrado = true
    const { error } = await supabase.from('eventos').insert({ cliente_id: cliente.id, tipo: 'acesso' })
    if (error) { acessoRegistrado = false; console.error(error) }
  }
  desenhar(tela, { supabase, cliente, aoTrocarSenha: atualizar })
}

// O supabase-js avisa: não chamar o próprio supabase dentro do callback; por isso o setTimeout.
// Só redesenha quando muda quem está logado (o SIGNED_IN repetido ao voltar à aba não apaga formulários).
supabase.auth.onAuthStateChange((evento, sessao) => {
  const id = sessao?.user.id ?? null
  if (evento === 'INITIAL_SESSION' || evento === 'SIGNED_OUT' || id !== usuarioMostrado) {
    if (evento === 'SIGNED_OUT') acessoRegistrado = false
    setTimeout(atualizar, 0)
  }
})
