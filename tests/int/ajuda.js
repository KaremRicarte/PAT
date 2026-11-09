// Ajudantes dos testes de integração: rodam contra o projeto remoto pat-dev.
import { createClient } from '@supabase/supabase-js'
import { randomUUID } from 'node:crypto'

const URL = process.env.VITE_SUPABASE_URL
const ANON = process.env.VITE_SUPABASE_ANON_KEY
const SERVICO = process.env.SUPABASE_SERVICE_ROLE_KEY
const opcoes = { auth: { persistSession: false, autoRefreshToken: false } }

// ids criados nos testes; o afterEach passa para limpar()
export const criados = []

export function servico() {
  return createClient(URL, SERVICO, opcoes)
}

export async function entrarComo(email, senha) {
  const db = createClient(URL, ANON, opcoes)
  const { error } = await db.auth.signInWithPassword({ email, password: senha })
  if (error) throw error
  return db
}

async function novoUsuario(app_metadata = {}) {
  const email = `teste-${randomUUID().slice(0, 8)}@example.com`
  const senha = `Senha-${randomUUID()}`
  const { data, error } = await servico().auth.admin.createUser({
    email, password: senha, email_confirm: true, app_metadata,
  })
  if (error) throw error
  criados.push(data.user.id)
  return { id: data.user.id, email, senha }
}

export async function novoCliente(dados = {}) {
  const u = await novoUsuario()
  const { error } = await servico().from('clientes').insert({
    id: u.id, nome: 'Cliente Teste', email: u.email, telefone: '5511987654321', ...dados,
  })
  if (error) throw error
  return { ...u, db: await entrarComo(u.email, u.senha) }
}

export async function novaAdmin() {
  const u = await novoUsuario({ role: 'admin' })
  return { id: u.id, db: await entrarComo(u.email, u.senha) }
}

export async function limpar(ids) {
  const s = servico()
  for (const id of ids) await s.auth.admin.deleteUser(id)
}
