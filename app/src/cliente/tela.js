import { ramoValido } from '../../../supabase/functions/_shared/modelos/ramos/index.ts'

// Decide qual tela o cliente vê. A situação vem sempre do banco, nunca da sessão.
// O ramo é definido pela administradora; sem ele o cliente espera o cadastro ser concluído.
// recuperando = o cliente chegou pelo link de "Esqueci minha senha" (evento PASSWORD_RECOVERY).
export function telaInicial({ sessao, cliente, negocio = null, produtos = [], mes = null, recuperando = false }) {
  if (!sessao) return 'entrar'
  if (recuperando) return 'nova-senha'
  if (!cliente) return 'erro'
  if (cliente.situacao === 'bloqueado') return 'pausado'
  if (cliente.senha_provisoria) return 'trocar-senha'
  if (!ramoValido(cliente.ramo)) return 'sem-ramo'
  if (!negocio || !produtos.length) return 'quiz-negocio' // sem itens = cadastro salvo pela metade
  if (!mes) return 'quiz-mes'
  return 'mes'
}

// Os erros de senha moram em senha.js (o painel também usa); ficam visíveis daqui para os testes.
export { erroTrocaSenha, erroEsqueci } from '../senha.js'
