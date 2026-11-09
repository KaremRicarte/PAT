// Cria (ou atualiza) a conta de administradora.
// Uso: node scripts/criar-admin.mjs <email> [senha]
// Sem a senha no comando, ela é pedida no terminal (sem aparecer na tela e sem ficar no histórico).
import { readFileSync } from 'node:fs'
import readline from 'node:readline'
import { createClient } from '@supabase/supabase-js'

const env = Object.fromEntries(
  readFileSync(new URL('../.env.local', import.meta.url), 'utf8')
    .split(/\r?\n/).filter(l => l.includes('='))
    .map(l => [l.slice(0, l.indexOf('=')).trim(), l.slice(l.indexOf('=') + 1).trim()]),
)

function perguntarOculto(pergunta) {
  return new Promise(resolve => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout, terminal: true })
    rl._writeToOutput = s => { if (!rl.mutado) rl.output.write(s) }
    rl.question(pergunta, resposta => { rl.close(); process.stdout.write('\n'); resolve(resposta) })
    rl.mutado = true
  })
}

const email = (process.argv[2] ?? '').trim().toLowerCase()
if (!email.includes('@')) {
  console.error('Uso: node scripts/criar-admin.mjs <email> [senha]')
  process.exit(1)
}
let senha = process.argv[3]
if (!senha) {
  senha = await perguntarOculto('Senha da administradora (mínimo 8 caracteres): ')
  const repetida = await perguntarOculto('Repita a senha: ')
  if (senha !== repetida) { console.error('As senhas não são iguais.'); process.exit(1) }
}
if (senha.length < 8) { console.error('A senha precisa ter pelo menos 8 caracteres.'); process.exit(1) }

const db = createClient(env.VITE_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
})

async function acharPorEmail(alvo) {
  for (let page = 1; ; page++) {
    const { data, error } = await db.auth.admin.listUsers({ page, perPage: 1000 })
    if (error) throw error
    const u = data.users.find(x => x.email?.toLowerCase() === alvo)
    if (u || data.users.length < 1000) return u
  }
}

const existente = await acharPorEmail(email)
const { error } = existente
  ? await db.auth.admin.updateUserById(existente.id, {
      password: senha, email_confirm: true,
      app_metadata: { ...existente.app_metadata, role: 'admin' },
    })
  : await db.auth.admin.createUser({
      email, password: senha, email_confirm: true, app_metadata: { role: 'admin' },
    })
if (error) { console.error('Erro:', error.message); process.exit(1) }
console.log(existente ? `Conta ${email} atualizada como administradora.` : `Conta ${email} criada como administradora.`)
