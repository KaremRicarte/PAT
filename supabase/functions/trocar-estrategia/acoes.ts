// Regras da função trocar-estrategia, sem nenhuma API do Deno (o Vitest importa este arquivo).
// Troca a estratégia de um mês já gerado: refaz os posts ainda não postados de hoje em diante.
import type { Resposta } from '../admin-clientes/acoes.ts'
import type { Estrategia, Rede, Tom } from '../_shared/modelos/tipos.ts'
import { lerFrequencia } from '../_shared/modelos/tipos.ts'
import { RAMOS, ramoValido } from '../_shared/modelos/ramos/index.ts'
import { agendaDoPacote, gerarMes, type Pacote, type PostGerado } from '../_shared/modelos/gerar.ts'
import { validarMes, validarPost } from '../_shared/modelos/validar.ts'
import { lerRedes } from '../gerar-mes/acoes.ts'

export type MesParaTrocar = { id: string, cliente_id: string, ano_mes: string, estrategia: string, redes: string[] | null }

export type DepsTrocaEstrategia = {
  cliente: () => Promise<{ id: string, situacao: string, senha_provisoria: boolean, ramo: string | null, frequencia?: string | null } | null>,
  mes: (id: string) => Promise<MesParaTrocar | null>,
  negocio: () => Promise<{ nome: string, insta: string | null, tom: Tom, horario: string } | null>,
  produtos: () => Promise<Pacote['produtos']>,
  hoje: () => string,
  gravar: (mesId: string, estrategia: Estrategia, desde: string, posts: PostGerado[]) => Promise<number>,
}

const ESTRATEGIAS: readonly string[] = ['vender', 'crescer', 'credibilidade', 'tempo']
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const r = (status: number, erro: string): Resposta => ({ status, corpo: { erro } })

export async function trocarEstrategiaDoMes(entrada: unknown, deps: DepsTrocaEstrategia): Promise<Resposta> {
  const cliente = await deps.cliente()
  if (!cliente || cliente.situacao !== 'ativo' || cliente.senha_provisoria) {
    return r(403, 'Seu acesso não permite trocar a estratégia.')
  }
  if (!ramoValido(cliente.ramo)) return r(400, 'Seu ramo ainda não foi definido. Fale com a administração.')

  const e = (entrada && typeof entrada === 'object' ? entrada : {}) as Record<string, unknown>
  const estrategia = e.estrategia
  if (typeof estrategia !== 'string' || !ESTRATEGIAS.includes(estrategia)) return r(400, 'Escolha uma estratégia.')

  const naoAchou = r(404, 'Mês não encontrado.')
  if (typeof e.mes_id !== 'string' || !UUID.test(e.mes_id)) return naoAchou
  const mes = await deps.mes(e.mes_id)
  if (!mes || mes.cliente_id !== cliente.id) return naoAchou

  const hoje = deps.hoje()
  if (mes.ano_mes < hoje.slice(0, 7)) return r(409, 'Este mês já terminou.')

  const [negocio, produtos] = await Promise.all([deps.negocio(), deps.produtos()])
  if (!negocio || !produtos.length) return r(400, 'Complete o cadastro do seu negócio antes.')

  // Mês atual: só de hoje em diante. Mês futuro: o mês inteiro.
  const desde = mes.ano_mes === hoje.slice(0, 7) ? hoje : `${mes.ano_mes}-01`
  const redes: Rede[] = lerRedes(mes.redes)
  const est = estrategia as Estrategia
  const ramo = RAMOS[cliente.ramo]
  const doCliente = [negocio.nome, ...produtos.flatMap((p) => [p.nome, p.descricao ?? ''])]
  const frequencia = lerFrequencia(cliente.frequencia)
  const posts = gerarMes({ ramo: cliente.ramo, estrategia: est, anoMes: mes.ano_mes, inicio: desde, negocio, produtos, redes, frequencia })
  const problemas = [
    ...validarMes(posts, agendaDoPacote({ ramo: cliente.ramo, estrategia: est, anoMes: mes.ano_mes, inicio: desde, produtos, frequencia }), redes),
    ...posts.flatMap((p) => validarPost(p, ramo, doCliente).map((x) => `${p.data} ${p.rede}/${p.tipo}: ${x}`)),
  ]
  if (problemas.length) {
    console.error('trocar-estrategia: validação recusou o mês', cliente.id, mes.id, problemas)
    return r(500, 'Não foi possível montar o mês.')
  }

  const refeitos = await deps.gravar(mes.id, est, desde, posts)
  return { status: 200, corpo: { refeitos } }
}
