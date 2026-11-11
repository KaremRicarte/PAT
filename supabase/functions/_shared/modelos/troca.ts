// "Gerar outro": monta um post novo, com os modelos prontos, para o mesmo lugar do calendário.
import { gerarMes, type Pacote, type PostGerado } from './gerar.ts'

// O lugar do post original. `formato` e `horario` (quando vierem) são mantidos;
// `legenda` é a atual, para a troca nunca devolver o mesmo texto.
export type Alvo = Pick<PostGerado, 'data' | 'rede' | 'tipo' | 'ordem'> &
  Partial<Pick<PostGerado, 'formato' | 'horario' | 'legenda'>>

const TENTATIVAS = 5

// Post do mês deslocado em `n` que ocupa o lugar do alvo: mesma rede e tipo, de preferência na
// mesma data (um mês gerado a partir do meio tem a agenda um pouco diferente), depois o mesmo
// formato de vídeo (montagem/gravar) e, por fim, a ordem mais próxima.
function escolher(p: Pacote, alvo: Alvo, n: number): PostGerado {
  const nota = (x: PostGerado) => [
    x.data === alvo.data ? 0 : 1,
    x.tipo === 'video' && alvo.formato && x.formato !== alvo.formato ? 1 : 0,
    Math.abs(x.ordem - alvo.ordem),
  ]
  const candidatos = gerarMes({ ...p, deslocamento: n }).filter((x) => x.rede === alvo.rede && x.tipo === alvo.tipo)
  if (!candidatos.length) throw new Error(`sem ${alvo.rede}/${alvo.tipo} no mês`)
  const melhor = candidatos.reduce((a, b) => {
    const [na, nb] = [nota(a), nota(b)]
    const i = na.findIndex((v, k) => v !== nb[k])
    return i >= 0 && nb[i] < na[i] ? b : a
  })
  return {
    ...melhor, data: alvo.data, ordem: alvo.ordem,
    formato: alvo.formato ?? melhor.formato, horario: alvo.horario ?? melhor.horario,
  }
}

export function gerarTroca(p: Pacote, alvo: Alvo, n: number): PostGerado {
  const atual = alvo.legenda ?? escolher(p, alvo, n - 1).legenda
  let post = escolher(p, alvo, n)
  for (let k = 1; post.legenda === atual && k <= TENTATIVAS; k++) post = escolher(p, alvo, n + k)
  return post
}
