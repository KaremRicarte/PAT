import { CONTATO_ADMIN, linkWhatsApp } from '../../app/src/contato.js'

test('o link do WhatsApp usa só os dígitos e leva a mensagem pronta', () => {
  expect(linkWhatsApp('+55 (11) 90000-0000', 'Olá! Tudo bem?'))
    .toBe('https://wa.me/5511900000000?text=Ol%C3%A1!%20Tudo%20bem%3F')
})

test('o contato da administração tem número para mostrar e para o link', () => {
  expect(CONTATO_ADMIN.exibir).toMatch(/\d/)
  expect(CONTATO_ADMIN.whatsapp.replace(/\D/g, '')).toMatch(/^55\d{10,11}$/)
})

test('normalizarWhatsApp: só dígitos, com DDD; vazio é null; inválido é undefined', async () => {
  const { normalizarWhatsApp } = await import('../../app/src/contato.js')
  expect(normalizarWhatsApp('+55 (83) 99999-0000')).toBe('83999990000')
  expect(normalizarWhatsApp('83 3333-0000')).toBe('8333330000')
  expect(normalizarWhatsApp('')).toBe(null)
  expect(normalizarWhatsApp('   ')).toBe(null)
  expect(normalizarWhatsApp('123')).toBe(undefined)
  expect(normalizarWhatsApp('9999-0000')).toBe(undefined)
})

test('formatarWhatsApp', async () => {
  const { formatarWhatsApp } = await import('../../app/src/contato.js')
  expect(formatarWhatsApp('83999990000')).toBe('(83) 99999-0000')
  expect(formatarWhatsApp('8333330000')).toBe('(83) 3333-0000')
})
