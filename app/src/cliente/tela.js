// Decide qual tela o cliente vê. A situação vem sempre do banco, nunca da sessão.
export function telaInicial({ sessao, cliente }) {
  if (!sessao) return 'entrar'
  if (!cliente) return 'erro'
  if (cliente.situacao === 'bloqueado') return 'pausado'
  if (cliente.senha_provisoria) return 'trocar-senha'
  return 'inicio'
}
