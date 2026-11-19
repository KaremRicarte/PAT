import { ramoValido } from '../../../supabase/functions/_shared/modelos/ramos/index.ts'

// Decide qual tela o cliente vê. A situação vem sempre do banco, nunca da sessão.
// O ramo e o negócio (nome, Instagram e logo) são definidos pela administradora; sem eles o
// cliente espera o cadastro ser concluído. negocio.pronto = o cliente já respondeu o questionário.
// recuperando = o cliente chegou pelo link de "Esqueci minha senha" (evento PASSWORD_RECOVERY).
export function telaInicial({ sessao, cliente, negocio = null, mes = null, recuperando = false }) {
  if (!sessao) return 'entrar'
  if (recuperando) return 'nova-senha'
  if (!cliente) return 'erro'
  if (cliente.situacao === 'bloqueado') return 'pausado'
  if (cliente.senha_provisoria) return 'trocar-senha'
  if (!ramoValido(cliente.ramo) || !negocio) return 'sem-ramo'
  if (!negocio.pronto) return 'quiz-negocio'
  if (!mes) return 'quiz-mes'
  return 'mes'
}

// Os erros de senha moram em senha.js (o painel também usa); ficam visíveis daqui para os testes.
export { erroTrocaSenha, erroEsqueci } from '../senha.js'
