// Contato da administração, mostrado ao cliente com acesso pausado.
// PROVISÓRIO: número fictício. Troque `exibir` e `whatsapp` pelo número real.
export const CONTATO_ADMIN = {
  exibir: '(11) 90000-0000',
  whatsapp: '55 11 90000-0000',
}

// Link que abre a conversa no WhatsApp já com a mensagem escrita.
export const linkWhatsApp = (numero, mensagem) =>
  `https://wa.me/${String(numero).replace(/\D/g, '')}?text=${encodeURIComponent(mensagem)}`
