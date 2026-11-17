// Limite mensal e registro de uso da IA (Etapa 4A, spec §5 e §7 item 13). Puro: o banco entra por `contarNoMes` e `registrar`.
// Fica em volta da ChamarIA porque escreverPost/descreverFoto devolvem null sem os tokens quando a IA falha:
// assim TODA chamada feita (inclusive as novas tentativas e as que falham) é registrada e conta no limite.
import type { ChamarIA, RespostaIA } from './escrever.ts'
import { custoUsd } from './custo.ts'

export const LIMITE_MENSAL = 400

export type TipoUso = 'foto' | 'post' | 'troca' | 'imagem'
export type RegistroUso = {
  clienteId: string | null, tipo: TipoUso, tokensEntrada: number, tokensSaida: number, custoUsd: number,
}

export function comLimiteEUso(chamar: ChamarIA, o: {
  // null = banco de imagens da administradora: registra, mas sem limite
  clienteId: string | null,
  tipo: TipoUso,
  registrar: (r: RegistroUso) => Promise<void>,
  // chamadas do cliente no mês do calendário (uso_ia_no_mes)
  contarNoMes: (clienteId: string) => Promise<number>,
  limite?: number,
}): ChamarIA {
  const limite = o.limite ?? LIMITE_MENSAL
  // chamadas deste invólucro já liberadas e ainda não registradas: entram na conta, para chamadas
  // em paralelo não passarem do limite juntas (entre execuções diferentes da função ainda pode passar por poucas)
  let emAndamento = 0
  return async (pedido) => {
    if (o.clienteId !== null) {
      let usadas: number
      try {
        usadas = await o.contarNoMes(o.clienteId)
      } catch (e) {
        // sem saber o uso, não arrisca gastar: segue com modelos
        console.error('uso da IA: não consegui contar o mês', o.clienteId, e)
        return { ok: false, motivo: 'erro' }
      }
      if (usadas + emAndamento >= limite) return { ok: false, motivo: 'limite' }
    }

    emAndamento++
    try {
      let r: RespostaIA
      try {
        r = await chamar(pedido)
      } catch (e) {
        console.error('uso da IA: a chamada falhou', e)
        r = { ok: false, motivo: 'erro' }
      }

      const tokensEntrada = r.tokensEntrada ?? 0
      const tokensSaida = r.tokensSaida ?? 0
      try {
        await o.registrar({ clienteId: o.clienteId, tipo: o.tipo, tokensEntrada, tokensSaida, custoUsd: custoUsd(tokensEntrada, tokensSaida) })
      } catch (e) {
        console.error('uso da IA: não consegui registrar', o.clienteId, o.tipo, e)
      }
      return r
    } finally {
      emAndamento--
    }
  }
}
