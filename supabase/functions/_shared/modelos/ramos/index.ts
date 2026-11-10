// Registro dos ramos. Para incluir um ramo novo: crie o arquivo ao lado e acrescente-o na lista abaixo
// (passo a passo em docs/como-incluir-um-ramo.md). Nada mais precisa mudar.
import type { Item, Ramo } from '../tipos.ts'
import advocacia from './advocacia.ts'
import beleza from './beleza.ts'
import ferramentas from './ferramentas.ts'
import psicologia from './psicologia.ts'
import turismo from './turismo.ts'

const TODOS: Ramo[] = [ferramentas, turismo, beleza, psicologia, advocacia]

export const RAMOS: Readonly<Record<string, Ramo>> = Object.freeze(
  Object.fromEntries(TODOS.map((r) => [r.id, r])),
)

export function ramoValido(id: unknown): id is string {
  return typeof id === 'string' && Object.hasOwn(RAMOS, id)
}

export function listaRamos(): { id: string, nome: string, desc: string }[] {
  return TODOS.map(({ id, nome, desc }) => ({ id, nome, desc }))
    .sort((a, b) => a.nome.localeCompare(b.nome, 'pt'))
}

// Item da biblioteca cujo `k` aparece no nome; senão, os textos genéricos do ramo.
export function itemDoProduto(ramo: Ramo, nome: string): Item {
  const baixo = nome.toLowerCase()
  const base = ramo.lib.find((l) => baixo.includes(l.k))
  if (base) return { ...base, nome }
  return { k: 'gen', nome, cat: 'Geral', curto: baixo, ...ramo.gen(nome, baixo) }
}

// Convites usados na estratégia "Crescer o perfil".
export const ENGAJA_CTA = [
  '"Salva este post para ver de novo quando precisar."',
  '"Manda para alguém que precisa ver isso."',
  '"Comenta aqui: você já passou por isso?"',
  '"Segue o perfil para mais conteúdo assim."',
  '"Qual parte você não sabia? Conta nos comentários."',
]
