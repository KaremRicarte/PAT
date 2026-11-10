// Decide qual tela o cliente vê. A situação vem sempre do banco, nunca da sessão.
export function telaInicial({ sessao, cliente }) {
  if (!sessao) return 'entrar'
  if (!cliente) return 'erro'
  if (cliente.situacao === 'bloqueado') return 'pausado'
  if (cliente.senha_provisoria) return 'trocar-senha'
  return 'inicio'
}

// Chave de texto para o erro ao trocar a senha (códigos do Supabase Auth).
export function erroTrocaSenha(error) {
  if (error?.code === 'same_password') return 'senha.igual'
  if (error?.code === 'weak_password') return 'senha.fraca'
  return 'erro.geral'
}
