// Refazer os posts que faltam depois que os itens mudaram: regera o mês com os itens atuais
// e encaixa cada post no mesmo lugar do calendário.
import { gerarMes, type Pacote, type PostGerado } from './gerar.ts'

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
