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

// sem acento e em minúsculas, para "Reveillon" achar "réveillon"
const simples = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()

// Item da biblioteca cujo `k` aparece no nome, começando numa palavra; senão, os textos genéricos do ramo.
// O `k` pode ser o começo de uma palavra ("previdenci" acha "previdenciário"), mas não o meio de outra,
// e as chaves de lugar são o nome inteiro: "Porto Seguro" não vira "Porto de Galinhas" (antes a chave era "porto").
export function itemDoProduto(ramo: Ramo, nome: string): Item {
  const baixo = nome.toLowerCase(), limpo = ` ${simples(nome).replace(/[^a-z0-9]+/g, ' ')}`
  const base = ramo.lib.find((l) => limpo.includes(` ${simples(l.k).replace(/[^a-z0-9]+/g, ' ')}`))
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
