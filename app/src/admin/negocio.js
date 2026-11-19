// Negócio do cliente definido pela administração: nome, Instagram e logo.
// Funções puras (sem Supabase), usadas pelo painel e pelos testes.
import { normalizarInsta } from '../cliente/negocio.js'
import { RAMOS } from '../../../supabase/functions/_shared/modelos/ramos/index.ts'

// { nome, insta } digitados → { dados: { nome, insta } } ou { erro: chave de texto }.
export function validarNegocio({ nome, insta }) {
  const n = String(nome ?? '').trim()
  if (n.length < 2 || n.length > 80) return { erro: 'admin.negocio.semnome' }
  const i = normalizarInsta(insta)
  if (i === undefined) return { erro: 'quiz.insta.erro' }
  return { dados: { nome: n, insta: i } }
}

// Linha nova de `negocios`: as cores começam nas do ramo (o cliente escolhe as dele no questionário).
export function linhaNovaDoNegocio(cliente, dados, logo_path) {
  const cores = RAMOS[cliente.ramo]?.cores ?? {}
  return { cliente_id: cliente.id, ...dados, logo_path, ...cores }
}

// Caminho do logo enviado pela administração (o cliente não grava em <id>/marca/).
export const caminhoDoLogo = (id, agora = Date.now()) => `${id}/marca/logo-${agora}.png`
