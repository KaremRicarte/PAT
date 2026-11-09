// Função admin-clientes: criar cliente e redefinir senha (exigem a chave secreta).
// Só quem tem app_metadata.role === 'admin' pode chamar.
import { createClient } from 'npm:@supabase/supabase-js@2'
import { gerarSenha } from '../_shared/senha.ts'
import { criarCliente, redefinirSenha, type Deps, type Resposta } from './acoes.ts'

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, content-type, apikey, x-client-info',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

const responder = ({ status, corpo }: Resposta) =>
  new Response(JSON.stringify(corpo), { status, headers: { ...CORS, 'Content-Type': 'application/json' } })

const URL_PROJETO = Deno.env.get('SUPABASE_URL')!
const CHAVE = Deno.env.get('PAT_SECRET_KEY') ?? Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })
  if (req.method !== 'POST') return responder({ status: 405, corpo: { erro: 'Método não permitido.' } })

  const db = createClient(URL_PROJETO, CHAVE, { auth: { persistSession: false, autoRefreshToken: false } })

  // Quem está chamando? A situação é lida do token validado pelo Auth, nunca do corpo.
  const jwt = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '')
  const quem = jwt ? (await db.auth.getUser(jwt)).data.user : null
  if (quem?.app_metadata?.role !== 'admin') {
    return responder({ status: 403, corpo: { erro: 'Só a administração pode fazer isso.' } })
  }

  let corpo: Record<string, unknown>
  try {
    corpo = await req.json()
  } catch {
    return responder({ status: 400, corpo: { erro: 'Ação desconhecida.' } })
  }

  const deps: Deps = {
    senha: () => gerarSenha(),
    async criarUsuario(email, senha) {
      const { data, error } = await db.auth.admin.createUser({ email, password: senha, email_confirm: true })
      if (error) {
        const repetido = error.code === 'email_exists' || /already/i.test(error.message)
        return { erro: repetido ? 'email_existe' : error.message }
      }
      return { id: data.user.id }
    },
    apagarUsuario: (id) => db.auth.admin.deleteUser(id),
    async inserirCliente(linha) {
      const { error } = await db.from('clientes').insert(linha)
      if (!error) return {}
      return { erro: error.code === '23505' ? 'email_existe' : error.message }
    },
    async trocarSenha(id, senha) {
      // só redefine a senha de quem é cliente (nunca a de uma admin)
      const { data: linha } = await db.from('clientes').select('id').eq('id', id).maybeSingle()
      if (!linha) return { erro: 'nao_encontrado' }
      const { error } = await db.auth.admin.updateUserById(id, { password: senha })
      return error ? { erro: error.message } : {}
    },
    async marcarProvisoria(id) {
      const { error } = await db.from('clientes').update({ senha_provisoria: true }).eq('id', id)
      return error ? { erro: error.message } : {}
    },
  }

  try {
    if (corpo?.acao === 'criar') return responder(await criarCliente(deps, corpo))
    if (corpo?.acao === 'redefinir_senha') return responder(await redefinirSenha(deps, corpo.id))
    return responder({ status: 400, corpo: { erro: 'Ação desconhecida.' } })
  } catch (e) {
    console.error(e)
    return responder({ status: 500, corpo: { erro: 'Erro inesperado.' } })
  }
})
