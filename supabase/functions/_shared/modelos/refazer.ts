// Refazer os posts que faltam depois que os itens mudaram: regera o mês com os itens atuais
// e encaixa cada post no mesmo lugar do calendário.
import { gerarMes, type Ocasiao, type Pacote, type PostGerado } from './gerar.ts'

export type Lugar = Pick<PostGerado, 'data' | 'rede' | 'tipo' | 'formato' | 'horario' | 'ordem'>

const dias = (a: string, b: string) => Math.abs(Date.parse(a) - Date.parse(b)) / 86400000

// Um post novo para cada lugar, na mesma posição da lista (null = nenhum lugar parecido no mês).
// Lugar, formato e horário ficam os do post original, como no "Gerar outro".
// O mês é gerado completo (a partir do dia 1, todas as redes), também como no "Gerar outro".
export function refazerPosts(p: Pacote, lugares: Lugar[]): (PostGerado | null)[] {
  const mes = gerarMes({ ...p, inicio: `${p.anoMes}-01`, redes: undefined, deslocamento: 0 })
  return lugares.map((lugar) => {
    const candidatos = mes.filter((x) => x.rede === lugar.rede && x.tipo === lugar.tipo &&
      // vídeo de montagem e vídeo para gravar têm roteiros de natureza diferente
      (x.tipo !== 'video' || x.formato === lugar.formato))
    const novo = candidatos.find((x) => x.data === lugar.data) ??
      [...candidatos].sort((a, b) => dias(a.data, lugar.data) - dias(b.data, lugar.data) || a.ordem - b.ordem)[0]
    if (!novo) return null
    return { ...novo, data: lugar.data, rede: lugar.rede, tipo: lugar.tipo, formato: lugar.formato, horario: lugar.horario, ordem: lugar.ordem }
  })
}

// "Refazer este post": o mesmo lugar, com os itens atuais e a mesma estratégia, mantendo o que o post é:
// o mesmo item, o mesmo pilar e a mesma fase da data (aquecimento/dia/tema). Entre os candidatos do mês
// regerado, vence o que mais combina com o post; no empate, o de data mais perto.
export type PostAtual = Lugar & { produto_id: string | null, pilar: PostGerado['pilar'], ocasiao?: Ocasiao | null }
export function refazerUmPost(p: Pacote, post: PostAtual): PostGerado | null {
  const mes = gerarMes({ ...p, inicio: `${p.anoMes}-01`, redes: undefined, deslocamento: 0 })
  const candidatos = mes.filter((x) => x.rede === post.rede && x.tipo === post.tipo && (x.tipo !== 'video' || x.formato === post.formato))
  const pontos = (x: PostGerado) => ((x.produto_id ?? null) === (post.produto_id ?? null) ? 4 : 0) + (x.pilar === post.pilar ? 2 : 0) +
    ((x.ocasiao?.fase ?? null) === (post.ocasiao?.fase ?? null) && (x.ocasiao?.data ?? null) === (post.ocasiao?.data ?? null) ? 1 : 0)
  const novo = [...candidatos].sort((a, b) => pontos(b) - pontos(a) || dias(a.data, post.data) - dias(b.data, post.data) || a.ordem - b.ordem)[0]
  if (!novo) return null
  return { ...novo, data: post.data, rede: post.rede, tipo: post.tipo, formato: post.formato, horario: post.horario, ordem: post.ordem }
}
