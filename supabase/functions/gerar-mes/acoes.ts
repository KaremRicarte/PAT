// Regras da função gerar-mes, sem nenhuma API do Deno (o Vitest importa este arquivo).
// Etapa 2: só modelos prontos. Etapa 3: a IA entra antes, e os modelos viram a reserva.
import type { Resposta } from '../admin-clientes/acoes.ts'
import type { Estrategia, Tom } from '../_shared/modelos/tipos.ts'
import { RAMOS, ramoValido } from '../_shared/modelos/ramos/index.ts'
import { agendaDoMes, mesAlvo } from '../_shared/modelos/calendario.ts'
import { gerarMes, type Pacote, type PostGerado } from '../_shared/modelos/gerar.ts'
import { validarMes, validarPost } from '../_shared/modelos/validar.ts'

export type DepsMes = {
  cliente: () => Promise<{ id: string, situacao: string, senha_provisoria: boolean, ramo: string | null } | null>,
  negocio: () => Promise<{ nome: string, insta: string | null, tom: Tom, horario: string } | null>,
  produtos: () => Promise<Pacote['produtos']>,
  mesesGerados: () => Promise<string[]>,
  hoje: () => string,
  salvar: (anoMes: string, estrategia: Estrategia, posts: PostGerado[]) => Promise<{ id: string } | 'repetido'>,
}

const ESTRATEGIAS: readonly string[] = ['vender', 'crescer', 'credibilidade', 'tempo']
const r = (status: number, erro: string): Resposta => ({ status, corpo: { erro } })

export async function gerarMesDoCliente(entrada: unknown, deps: DepsMes): Promise<Resposta> {
  const cliente = await deps.cliente()
  if (!cliente || cliente.situacao !== 'ativo' || cliente.senha_provisoria) {
    return r(403, 'Seu acesso não permite gerar o mês.')
  }
  if (!ramoValido(cliente.ramo)) return r(400, 'Seu ramo ainda não foi definido. Fale com a administração.')

  const e = (entrada && typeof entrada === 'object' ? entrada : {}) as Record<string, unknown>
  const estrategia = e.estrategia
  if (typeof estrategia !== 'string' || !ESTRATEGIAS.includes(estrategia)) return r(400, 'Escolha uma estratégia.')

  const [negocio, produtos, gerados] = await Promise.all([deps.negocio(), deps.produtos(), deps.mesesGerados()])
  if (!negocio || !produtos.length) return r(400, 'Complete o cadastro do seu negócio antes.')

  const alvo = mesAlvo(deps.hoje(), gerados)
  if (!alvo) return r(409, 'O próximo mês fica disponível a partir do dia 21.')

  const est = estrategia as Estrategia
  const posts = gerarMes({ ramo: cliente.ramo, estrategia: est, ...alvo, negocio, produtos })
  const problemas = [
    ...validarMes(posts, agendaDoMes(alvo.anoMes, alvo.inicio, est)),
    ...posts.flatMap((p) => validarPost(p, RAMOS[cliente.ramo as string]).map((x) => `${p.data} ${p.rede}/${p.tipo}: ${x}`)),
  ]
  if (problemas.length) {
    console.error('gerar-mes: validação recusou o mês', cliente.id, problemas)
    return r(500, 'Não foi possível montar o mês.')
  }

  const salvo = await deps.salvar(alvo.anoMes, est, posts)
  if (salvo === 'repetido') return r(409, 'Este mês já foi gerado.')
  return { status: 201, corpo: { id: salvo.id, anoMes: alvo.anoMes, total: posts.length } }
}
