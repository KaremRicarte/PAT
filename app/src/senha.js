// Erros de senha (códigos do Supabase Auth) → chaves de texto.

// Chave de texto para o erro ao trocar a senha (códigos do Supabase Auth).
export function erroTrocaSenha(error) {
  if (error?.code === 'same_password') return 'senha.igual'
  if (error?.code === 'weak_password') return 'senha.fraca'
  return 'erro.geral'
}

// Chave de texto para o erro ao pedir o link de nova senha.
export function erroEsqueci(error) {
  if (error?.status === 429 || error?.code === 'over_email_send_rate_limit') return 'esqueci.limite'
  return 'erro.geral'
}
