// Contato da administração, mostrado ao cliente com acesso pausado.
// PROVISÓRIO: número fictício. Troque `exibir` e `whatsapp` pelo número real.
export const CONTATO_ADMIN = {
  exibir: '(11) 90000-0000',
  whatsapp: '55 11 90000-0000',
}

// WhatsApp digitado → só dígitos (DDD + número, sem o 55). Vazio → null; inválido → undefined.
export function normalizarWhatsApp(texto) {
  let d = String(texto ?? '').replace(/\D/g, '')
  if (!d) return null
  if ((d.length === 12 || d.length === 13) && d.startsWith('55')) d = d.slice(2)
  return d.length === 10 || d.length === 11 ? d : undefined
}

// '83999990000' → '(83) 99999-0000'; '8333330000' → '(83) 3333-0000'.
export const formatarWhatsApp = (d) => `(${d.slice(0, 2)}) ${d.slice(2, -4)}-${d.slice(-4)}`

// Link que abre a conversa no WhatsApp já com a mensagem escrita.
export const linkWhatsApp = (numero, mensagem) =>
  `https://wa.me/${String(numero).replace(/\D/g, '')}?text=${encodeURIComponent(mensagem)}`
