// O módulo lê location.hash ao ser importado: cada caso importa uma cópia nova.
async function ler(hash) {
  vi.resetModules()
  vi.stubGlobal('location', { hash })
  const m = await import('../../app/src/linkDoEmail.js')
  vi.unstubAllGlobals()
  return m
}

test('link de recuperação', async () => {
  const m = await ler('#access_token=x&expires_in=3600&type=recovery')
  expect(m.veioDaRecuperacao).toBe(true)
  expect(m.linkExpirado).toBe(false)
})

test('link vencido', async () => {
  const m = await ler('#error=access_denied&error_code=otp_expired&error_description=Email+link+is+invalid')
  expect(m.veioDaRecuperacao).toBe(false)
  expect(m.linkExpirado).toBe(true)
})

test('abertura normal', async () => {
  const m = await ler('')
  expect(m.veioDaRecuperacao).toBe(false)
  expect(m.linkExpirado).toBe(false)
})

test('sem location (testes no node)', async () => {
  vi.resetModules()
  const m = await import('../../app/src/linkDoEmail.js')
  expect(m.veioDaRecuperacao).toBe(false)
})
