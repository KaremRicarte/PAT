import { createClient } from '@supabase/supabase-js'
import { randomUUID } from 'node:crypto'
import { servico, novoCliente, novaAdmin, limpar, criados } from './ajuda.js'

const URL = process.env.VITE_SUPABASE_URL
const ANON = process.env.VITE_SUPABASE_ANON_KEY

afterEach(() => limpar(criados.splice(0)))

async function chamar(db, body) {
  const { data: { session } } = await db.auth.getSession()
  const r = await fetch(`${URL}/functions/v1/admin-clientes`, {
    method: 'POST',
    headers: { apikey: ANON, Authorization: `Bearer ${session.access_token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  return { status: r.status, corpo: await r.json() }
}

async function consegueEntrar(email, senha) {
  const db = createClient(URL, ANON, { auth: { persistSession: false } })
  const { error } = await db.auth.signInWithPassword({ email, password: senha })
  return !error
}

const novo = () => ({
  acao: 'criar', nome: 'Ana Teste', email: `Teste-${randomUUID().slice(0, 8)}@Example.com`,
  telefone: '(11) 98765-4321', idioma: 'pt',
})

test('admin cria cliente; e-mail e telefone normalizados; cliente entra com a senha provisória', async () => {
  const adm = await novaAdmin(), dados = novo()
  const r = await chamar(adm.db, dados)
  expect(r.status).toBe(201)
  criados.push(r.corpo.id)
  expect(r.corpo.senhaProvisoria).toMatch(/^[A-HJ-NP-Za-km-np-z2-9]{10}$/)
  const { data } = await servico().from('clientes')
    .select('email,telefone,senha_provisoria,situacao').eq('id', r.corpo.id).single()
  expect(data).toEqual({
    email: dados.email.toLowerCase(), telefone: '5511987654321', senha_provisoria: true, situacao: 'ativo',
  })
  expect(await consegueEntrar(data.email, r.corpo.senhaProvisoria)).toBe(true)
})

test('mesmo e-mail com maiúsculas → 409 sem usuário órfão', async () => {
  const adm = await novaAdmin(), dados = novo()
  const r1 = await chamar(adm.db, dados)
  criados.push(r1.corpo.id)
  const r2 = await chamar(adm.db, { ...dados, email: dados.email.toUpperCase() })
  expect(r2).toEqual({ status: 409, corpo: { erro: 'Já existe um cliente com este e-mail.' } })
})

test('dados inválidos → 400', async () => {
  const adm = await novaAdmin()
  expect(await chamar(adm.db, { ...novo(), telefone: '123' }))
    .toEqual({ status: 400, corpo: { erro: 'Telefone inválido. Use DDD e número.' } })
})

test('cliente comum chamando → 403', async () => {
  const a = await novoCliente()
  expect(await chamar(a.db, novo())).toEqual({ status: 403, corpo: { erro: 'Só a administração pode fazer isso.' } })
})

test('sem login → recusado', async () => {
  const r = await fetch(`${URL}/functions/v1/admin-clientes`, {
    method: 'POST', headers: { apikey: ANON, 'Content-Type': 'application/json' }, body: JSON.stringify(novo()),
  })
  expect([401, 403]).toContain(r.status)
})

test('redefinir: senha antiga para de funcionar, a nova funciona, volta a ser provisória', async () => {
  const a = await novoCliente(), adm = await novaAdmin()
  await a.db.rpc('marcar_senha_trocada')
  const r = await chamar(adm.db, { acao: 'redefinir_senha', id: a.id })
  expect(r.status).toBe(200)
  expect(await consegueEntrar(a.email, a.senha)).toBe(false)
  expect(await consegueEntrar(a.email, r.corpo.senhaProvisoria)).toBe(true)
  const { data } = await servico().from('clientes').select('senha_provisoria').eq('id', a.id).single()
  expect(data.senha_provisoria).toBe(true)
})

test('redefinir a senha de uma admin → 404', async () => {
  const adm = await novaAdmin(), outra = await novaAdmin()
  expect(await chamar(adm.db, { acao: 'redefinir_senha', id: outra.id }))
    .toEqual({ status: 404, corpo: { erro: 'Cliente não encontrado.' } })
})

test('ação desconhecida → 400', async () => {
  const adm = await novaAdmin()
  expect(await chamar(adm.db, { acao: 'apagar_tudo' })).toEqual({ status: 400, corpo: { erro: 'Ação desconhecida.' } })
})

test('cliente em espanhol do Chile (11 dígitos com DDI) é criado', async () => {
  const adm = await novaAdmin()
  const r = await chamar(adm.db, { ...novo(), idioma: 'es', telefone: '+56 9 1234 5678' })
  expect(r.status).toBe(201)
  criados.push(r.corpo.id)
  const { data } = await servico().from('clientes').select('telefone,idioma').eq('id', r.corpo.id).single()
  expect(data).toEqual({ telefone: '56912345678', idioma: 'es' })
})
