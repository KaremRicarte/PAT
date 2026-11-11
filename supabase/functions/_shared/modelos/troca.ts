// "Gerar outro": monta um post novo, com os modelos prontos, para o mesmo lugar do calendário.
import { gerarMes, type Pacote, type PostGerado } from './gerar.ts'

// O lugar do post original. `formato` e `horario` (quando vierem) são mantidos;
// `legenda` é a atual, que a troca nunca devolve.
export type Alvo = Pick<PostGerado, 'data' | 'rede' | 'tipo' | 'ordem'> &
  Partial<Pick<PostGerado, 'formato' | 'horario' | 'legenda'>>

// Quantos deslocamentos a mais procurar antes de desistir.
const ALEM = 8

const dias = (a: string, b: string) => Math.abs(Date.parse(a) - Date.parse(b)) / 86400000

// Uma troca, dado o que o cliente já viu. A geração é determinística, então o histórico
// (trocas 1..n-1) é refeito aqui mesmo, sem precisar guardar nada no banco.
export function gerarTroca(p: Pacote, alvo: Alvo, n: number): PostGerado | null {
  const meses = new Map<number, PostGerado[]>()
  const doMes = (d: number) => {
    if (!meses.has(d)) {
      meses.set(d, gerarMes({ ...p, deslocamento: d }).filter((x) => x.rede === alvo.rede && x.tipo === alvo.tipo &&
        // vídeo de montagem e vídeo para gravar têm roteiros de natureza diferente
        (x.tipo !== 'video' || !alvo.formato || x.formato === alvo.formato)))
    }
    return meses.get(d)!
  }
  // O post que ocupa o lugar do alvo no mês deslocado em `d`: a mesma data ou, num mês gerado a partir
  // do meio (agenda um pouco diferente), a ordem mais próxima.
  const doLugar = (d: number) => {
    const c = doMes(d)
    return c.find((x) => x.data === alvo.data) ??
      c.reduce<PostGerado | undefined>((a, b) => (!a || Math.abs(b.ordem - alvo.ordem) < Math.abs(a.ordem - alvo.ordem) ? b : a), undefined)
  }

  const procurar = (m: number, vistos: Set<string>): PostGerado | undefined => {
    // 1º o mesmo lugar, girando produtos e temas; 2º outra data do mês, a mais próxima
    for (let d = m; d <= m + ALEM; d++) {
      const x = doLugar(d)
      if (x && !vistos.has(x.legenda)) return x
    }
    for (let d = m; d <= m + ALEM; d++) {
      const x = [...doMes(d)].sort((a, b) => dias(a.data, alvo.data) - dias(b.data, alvo.data) || a.ordem - b.ordem)
        .find((y) => !vistos.has(y.legenda))
      if (x) return x
    }
  }

  const vistos = new Set<string>()
  if (alvo.legenda !== undefined) vistos.add(alvo.legenda)
  const original = doLugar(0)
  if (original) vistos.add(original.legenda)
  for (let m = 1; m < n; m++) {
    const antes = procurar(m, vistos)
    if (antes) vistos.add(antes.legenda)
  }

  const novo = procurar(n, vistos)
  if (!novo) return null
  return {
    data: alvo.data, rede: alvo.rede, tipo: alvo.tipo, ordem: alvo.ordem,
    formato: alvo.formato ?? novo.formato, horario: alvo.horario ?? novo.horario,
    titulo: novo.titulo, legenda: novo.legenda, hashtags: novo.hashtags, roteiro: novo.roteiro,
    pilar: novo.pilar, produto_id: novo.produto_id,
  }
}
