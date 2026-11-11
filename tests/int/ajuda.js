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

// Cliente pronto para gerar: ramo ferramentas, negócio e 2 produtos (gravados com a chave de serviço).
export async function novoNegocio(cliente, extra = {}) {
  const s = servico()
  const r1 = await s.from('clientes').update({ ramo: 'ferramentas' }).eq('id', cliente.id)
  if (r1.error) throw r1.error
  const r2 = await s.from('negocios').insert({
    cliente_id: cliente.id, nome: 'Ferragens Teste', cor1: '#F2A21B', cor2: '#151925', ...extra,
  })
  if (r2.error) throw r2.error
  const { data: produtos, error } = await s.from('produtos').insert([
    { cliente_id: cliente.id, nome: 'Furadeira de impacto', preco: 299.9, ordem: 0 },
    { cliente_id: cliente.id, nome: 'Trena a laser', ordem: 1 },
  ]).select('id,nome')
  if (error) throw error
  return { produtos }
}

export async function limpar(ids) {
  const s = servico()
  for (const id of ids) if (id) await s.auth.admin.deleteUser(id)
}

// Gera o mês pela função gerar-mes publicada; o cliente precisa ter senha_provisoria:false.
export async function novoMes(cliente) {
  await novoNegocio(cliente)
  const { data: { session } } = await cliente.db.auth.getSession()
  const r = await fetch(`${URL}/functions/v1/gerar-mes`, {
    method: 'POST',
    headers: { apikey: ANON, Authorization: `Bearer ${session.access_token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ estrategia: 'vender' }),
  })
  const corpo = await r.json()
  if (r.status !== 201) throw new Error(`gerar-mes ${r.status}: ${JSON.stringify(corpo)}`)
  const { data: posts, error } = await servico().from('posts').select('id').eq('mes_id', corpo.id).order('ordem')
  if (error) throw error
  return { mesId: corpo.id, posts }
}
