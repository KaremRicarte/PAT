import { readFileSync } from 'node:fs'

// O service worker (app/public/sw.js) roda com um `self` falso: aqui só o toque na notificação.
const codigo = readFileSync(new URL('../../app/public/sw.js', import.meta.url), 'utf8')
const ORIGEM = 'https://pat.exemplo'

function carregar(abas) {
  const ouvintes = {}
  const abertas = []
  const self = {
    location: { origin: ORIGEM },
    addEventListener: (nome, fn) => { ouvintes[nome] = fn },
    clients: { matchAll: async () => abas, openWindow: async (url) => { abertas.push(url) }, claim: async () => {} },
    registration: {},
  }
  new Function('self', codigo)(self)
  const clicar = async (url = '/?post=1') => {
    let espera
    ouvintes.notificationclick({ notification: { close: () => {}, data: { url } }, waitUntil: (p) => { espera = p } })
    await espera
  }
  return { clicar, abertas }
}

function aba(caminho, { focoFalha = false, navegaFalha = false } = {}) {
  const a = {
    url: `${ORIGEM}${caminho}`, focada: false, navegada: null,
    focus: async () => { if (focoFalha) throw new Error('sem foco'); a.focada = true; return a },
    navigate: async (url) => { if (navegaFalha) throw new Error('não controlada'); a.navegada = url; return a },
  }
  return a
}

test('notificationclick: foca a aba do PAT e vai para a url do lembrete', async () => {
  const a = aba('/')
  const { clicar, abertas } = carregar([a])
  await clicar('/?post=9')
  expect(a.focada).toBe(true)
  expect(a.navegada).toBe(`${ORIGEM}/?post=9`)
  expect(abertas).toEqual([])
})

test('notificationclick: focou mas não navegou -> não abre segunda janela', async () => {
  const a = aba('/', { navegaFalha: true })
  const { clicar, abertas } = carregar([a])
  await clicar()
  expect(a.focada).toBe(true)
  expect(abertas).toEqual([])
})

test('notificationclick: prefere a aba do cliente à do /admin', async () => {
  const admin = aba('/admin.html'), cliente = aba('/')
  const { clicar, abertas } = carregar([admin, cliente])
  await clicar()
  expect(admin.focada).toBe(false)
  expect(cliente.focada).toBe(true)
  expect(abertas).toEqual([])
})

test('notificationclick: só a aba do /admin, ou o foco falhou -> abre uma janela nova', async () => {
  const s1 = carregar([aba('/admin.html')])
  await s1.clicar('/?post=2')
  expect(s1.abertas).toEqual([`${ORIGEM}/?post=2`])
  const s2 = carregar([aba('/', { focoFalha: true })])
  await s2.clicar('/?post=3')
  expect(s2.abertas).toEqual([`${ORIGEM}/?post=3`])
})

test('notificationclick: aba de outro site não conta', async () => {
  const outra = { ...aba('/'), url: 'https://outro.site/' }
  const { clicar, abertas } = carregar([outra])
  await clicar('/')
  expect(abertas).toEqual([`${ORIGEM}/`])
})
