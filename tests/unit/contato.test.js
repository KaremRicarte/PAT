import { CONTATO_ADMIN, linkWhatsApp } from '../../app/src/contato.js'

test('o link do WhatsApp usa só os dígitos e leva a mensagem pronta', () => {
  expect(linkWhatsApp('+55 (11) 90000-0000', 'Olá! Tudo bem?'))
    .toBe('https://wa.me/5511900000000?text=Ol%C3%A1!%20Tudo%20bem%3F')
})

test('o contato da administração tem número para mostrar e para o link', () => {
  expect(CONTATO_ADMIN.exibir).toMatch(/\d/)
  expect(CONTATO_ADMIN.whatsapp.replace(/\D/g, '')).toMatch(/^55\d{10,11}$/)
})
