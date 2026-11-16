import supabase from '../supabase.js'
import { veioDaRecuperacao } from '../linkDoEmail.js'
import { t } from '../textos.js'
import { carregando, telaEntrar, formSenha, mostrar, logo, aviso } from '../comum.js'
import { ehAdmin } from './acesso.js'
import { telaSoAdmin, telaPainel } from './telas.js'

let usuarioMostrado
let recuperando = veioDaRecuperacao // abriu pelo link de "Esqueci minha senha"

async function atualizar() {
  carregando()
  document.getElementById('app').classList.remove('largo')
  const { data: { session: sessao } } = await supabase.auth.getSession()
  usuarioMostrado = sessao?.user.id ?? null
  if (!sessao) return telaEntrar(supabase)
  if (recuperando) {
    return mostrar(logo(), formSenha(supabase, {
      titulo: t('senha.nova.titulo'),
      texto: t('senha.nova.texto'),
      aoSalvar: async () => { recuperando = false; aviso(t('senha.salva')); await atualizar(); return null },
    }))
  }
  if (!ehAdmin(sessao)) return telaSoAdmin(supabase)
  await telaPainel(supabase)
}

// Mesmo cuidado do app do cliente: nada de chamar o supabase dentro do callback,
// e só redesenhar quando muda quem está logado.
supabase.auth.onAuthStateChange((evento, sessao) => {
  const id = sessao?.user.id ?? null
  if (evento === 'PASSWORD_RECOVERY') { recuperando = true; setTimeout(atualizar, 0); return }
  if (evento === 'SIGNED_OUT') recuperando = false
  if (evento === 'INITIAL_SESSION' || evento === 'SIGNED_OUT' || id !== usuarioMostrado) {
    setTimeout(atualizar, 0)
  }
})
