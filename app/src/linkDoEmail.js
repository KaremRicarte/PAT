// Lê o fim do endereço (#...) com que o link do e-mail abriu o app, ANTES de o supabase-js
// consumi-lo. Por isso supabase.js importa este módulo antes de criar o cliente.
const hash = globalThis.location?.hash ?? ''

// Veio do link de "Esqueci minha senha".
export const veioDaRecuperacao = /(^|[#&])type=recovery(&|$)/.test(hash)

// O link já tinha sido usado ou passou da validade.
export const linkExpirado = /(^|[#&])error_code=otp_expired(&|$)/.test(hash)
