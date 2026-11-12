import { estadoDosLembretes, ehIphone, chaveParaBytes, adiarAviso, avisoAdiado } from '../../app/src/cliente/lembretes.js'

// ---------- estadoDosLembretes ----------
const base = { temPush: true, temChave: true, permissao: 'default', iphone: false, instalado: false, inscrito: false }
const estado = (extra) => estadoDosLembretes({ ...base, ...extra })

test('estadoDosLembretes: iPhone fora da tela inicial pede para instalar (mesmo sem push no Safari)', () => {
  expect(estado({ iphone: true, instalado: false, temPush: false })).toBe('instalar')
  expect(estado({ iphone: true, instalado: false, temPush: true })).toBe('instalar')
})

test('estadoDosLembretes: iPhone já na tela inicial segue o fluxo normal', () => {
  expect(estado({ iphone: true, instalado: true })).toBe('inativo')
})

test('estadoDosLembretes: sem push no navegador -> sem-suporte', () => {
  expect(estado({ temPush: false })).toBe('sem-suporte')
})

test('estadoDosLembretes: permissão negada -> bloqueado', () => {
  expect(estado({ permissao: 'denied' })).toBe('bloqueado')
  expect(estado({ permissao: 'denied', inscrito: true })).toBe('bloqueado')
})

test('estadoDosLembretes: inscrito com permissão -> ativo', () => {
  expect(estado({ permissao: 'granted', inscrito: true })).toBe('ativo')
})

test('estadoDosLembretes: sem inscrição -> inativo', () => {
  expect(estado({ permissao: 'default' })).toBe('inativo')
  expect(estado({ permissao: 'granted', inscrito: false })).toBe('inativo')
  expect(estado({ permissao: 'default', inscrito: true })).toBe('inativo') // permissão zerada: a inscrição não vale
})

// ---------- ehIphone ----------
const UA = {
  iphone: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1',
  android: 'Mozilla/5.0 (Linux; Android 14; SM-A145M) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Mobile Safari/537.36',
  mac: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Safari/605.1.15',
}

test('ehIphone: iPhone sim, Android não', () => {
  expect(ehIphone(UA.iphone, 5)).toBe(true)
  expect(ehIphone(UA.android, 5)).toBe(false)
})

test('ehIphone: iPad que se apresenta como Mac é reconhecido pelo toque; Mac de verdade não', () => {
  expect(ehIphone(UA.mac, 5)).toBe(true)
  expect(ehIphone(UA.mac, 0)).toBe(false)
})

// ---------- chaveParaBytes ----------
test('chaveParaBytes: chave pública VAPID (base64url) vira 65 bytes começando com 4', () => {
  const b = chaveParaBytes('BKhQ-A0ZsEgUmB8HF54PERppA-Vnuid7xDiHh7bTq7hmH2zIrCJ_Ywr5U4uGVQ6-kG96NdQyZrwxLXKr1Ausu-c')
  expect(b).toBeInstanceOf(Uint8Array)
  expect(b).toHaveLength(65)
  expect([b[0], b[1], b[2], b[3], b[64]]).toEqual([4, 168, 80, 248, 231])
})

// ---------- Agora não (7 dias) ----------
function armazenamentoFalso() {
  const dados = new Map()
  return { getItem: (k) => dados.get(k) ?? null, setItem: (k, v) => dados.set(k, String(v)), dados }
}

test('adiarAviso guarda a data em pat-lembrete-adiado e o aviso some por 7 dias', () => {
  const armazenamento = armazenamentoFalso()
  vi.stubGlobal('localStorage', armazenamento)
  try {
    const agora = new Date('2026-11-12T10:00:00Z')
    expect(avisoAdiado(agora)).toBe(false)
    adiarAviso(agora)
    expect(armazenamento.dados.get('pat-lembrete-adiado')).toBe(agora.toISOString())
    expect(avisoAdiado(new Date('2026-11-18T09:59:00Z'))).toBe(true)
    expect(avisoAdiado(new Date('2026-11-19T10:00:00Z'))).toBe(false)
  } finally {
    vi.unstubAllGlobals()
  }
})

test('sem armazenamento no aparelho, o aviso aparece e adiar não quebra', () => {
  vi.stubGlobal('localStorage', { getItem: () => { throw new Error('bloqueado') }, setItem: () => { throw new Error('bloqueado') } })
  try {
    expect(() => adiarAviso()).not.toThrow()
    expect(avisoAdiado()).toBe(false)
  } finally {
    vi.unstubAllGlobals()
  }
})

test('estadoDosLembretes: sem a chave VAPID no app -> sem-suporte (até no iPhone fora da tela inicial)', () => {
  expect(estado({ temChave: false })).toBe('sem-suporte')
  expect(estado({ temChave: false, permissao: 'granted', inscrito: true })).toBe('sem-suporte')
  expect(estado({ temChave: false, iphone: true, instalado: false })).toBe('sem-suporte')
})
