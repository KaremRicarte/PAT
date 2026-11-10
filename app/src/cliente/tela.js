import { ramoValido } from '../../../supabase/functions/_shared/modelos/ramos/index.ts'

// Decide qual tela o cliente vê. A situação vem sempre do banco, nunca da sessão.
// O ramo é definido pela administradora; sem ele o cliente espera o cadastro ser concluído.
export function telaInicial({ sessao, cliente, negocio = null, produtos = [], mes = null }) {
  if (!sessao) return 'entrar'
  if (!cliente) return 'erro'
  if (cliente.situacao === 'bloqueado') return 'pausado'
  if (cliente.senha_provisoria) return 'trocar-senha'
  if (!ramoValido(cliente.ramo)) return 'sem-ramo'
  if (!negocio || !produtos.length) return 'quiz-negocio' // sem itens = cadastro salvo pela metade
  if (!mes) return 'quiz-mes'
  return 'mes'
}

// Chave de texto para o erro ao trocar a senha (códigos do Supabase Auth).
export function erroTrocaSenha(error) {
  if (error?.code === 'same_password') return 'senha.igual'
  if (error?.code === 'weak_password') return 'senha.fraca'
  return 'erro.geral'
}
