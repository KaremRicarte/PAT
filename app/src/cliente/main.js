import supabase from '../supabase.js'
import { t } from '../textos.js'
import { el, logo, mostrar, carregando, botaoSair } from '../comum.js'
import { telaInicial } from './tela.js'
import { desenhar } from './telas.js'
import { carregarNegocio } from './negocio.js'
import { limparImagens } from '../artes/imagens.js'

let acessoRegistrado = false // um evento 'acesso' por abertura do app
let usuarioMostrado // id do usuário da tela atual (undefined = nenhuma tela ainda)
const TELAS_DO_APP = ['sem-ramo', 'quiz-negocio', 'quiz-mes', 'mes'] // cliente ativo, já com a senha dele

function telaErro() {
  mostrar(logo(), el('p', { class: 'erro', texto: t('erro.geral') }),
    el('div', { class: 'acoes' }, el('button', { type: 'button', texto: t('comum.tentar'), onclick: atualizar }), botaoSair(supabase)))
}

async function atualizar() {
  carregando()
  const { data: { session: sessao } } = await supabase.auth.getSession()
  usuarioMostrado = sessao?.user.id ?? null

  // A situação é sempre relida do banco: um bloqueio vale na próxima abertura.
  let cliente = null, negocio = null, produtos = [], meses = []
  if (sessao) {
    const { data, error } = await supabase.from('clientes')
      .select('id, nome, ramo, situacao, senha_provisoria').eq('id', sessao.user.id).maybeSingle()
    if (error) return telaErro()
    cliente = data
  }
  if (cliente && cliente.situacao === 'ativo' && !cliente.senha_provisoria) {
    try {
      ({ negocio, produtos } = await carregarNegocio(supabase, cliente.id))
      const r = await supabase.from('meses').select('id, ano_mes, estrategia, gerado_em')
        .eq('cliente_id', cliente.id).order('ano_mes', { ascending: false })
      if (r.error) throw r.error
      meses = r.data
    } catch (e) {
      console.error(e)
      return telaErro()
    }
  }

  const tela = telaInicial({ sessao, cliente, negocio, produtos, mes: meses[0] ?? null })
  if (TELAS_DO_APP.includes(tela) && !acessoRegistrado) {
    acessoRegistrado = true
    const { error } = await supabase.from('eventos').insert({ cliente_id: cliente.id, tipo: 'acesso' })
    if (error) { acessoRegistrado = false; console.error(error) }
  }
  desenhar(tela, { supabase, cliente, negocio, produtos, meses, atualizar })
}

// O supabase-js avisa: não chamar o próprio supabase dentro do callback; por isso o setTimeout.
// Só redesenha quando muda quem está logado (o SIGNED_IN repetido ao voltar à aba não apaga formulários).
supabase.auth.onAuthStateChange((evento, sessao) => {
  const id = sessao?.user.id ?? null
  if (evento === 'INITIAL_SESSION' || evento === 'SIGNED_OUT' || id !== usuarioMostrado) {
    if (evento === 'SIGNED_OUT') { acessoRegistrado = false; limparImagens() } // fecha as fotos da conta que saiu
    setTimeout(atualizar, 0)
  }
})
