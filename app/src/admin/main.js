import supabase from '../supabase.js'
import { carregando, telaEntrar } from '../comum.js'
import { ehAdmin } from './acesso.js'
import { telaSoAdmin, telaPainel } from './telas.js'

let usuarioMostrado

async function atualizar() {
  carregando()
  document.getElementById('app').classList.remove('largo')
  const { data: { session: sessao } } = await supabase.auth.getSession()
  usuarioMostrado = sessao?.user.id ?? null
  if (!sessao) return telaEntrar(supabase)
  if (!ehAdmin(sessao)) return telaSoAdmin(supabase)
  await telaPainel(supabase)
}

// Mesmo cuidado do app do cliente: nada de chamar o supabase dentro do callback,
// e só redesenhar quando muda quem está logado.
supabase.auth.onAuthStateChange((evento, sessao) => {
  const id = sessao?.user.id ?? null
  if (evento === 'INITIAL_SESSION' || evento === 'SIGNED_OUT' || id !== usuarioMostrado) {
    setTimeout(atualizar, 0)
  }
})
