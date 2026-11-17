// A IA escrevendo enquanto o cliente espera ("Gerar outro" e "Trocar imagem", spec §3.5 e §7 item 6). Puro: a chamada
// de verdade, o banco e o Storage entram em `deps`. Qualquer falha (sem chave, limite, recusa, tempo, erro) -> null:
// quem chama segue sem a IA, nunca com erro por causa dela.
import { escreverPost, type CamposDaIA, type ChamarIA } from './escrever.ts'
import { comLimiteEUso, type RegistroUso } from './uso.ts'
import { montarEntradaPost, SEM_DESCRICAO, type DadosDoCliente, type LugarDoPost } from './entrada.ts'

// O cliente está esperando: todas as chamadas juntas (inclusive a nova tentativa de escreverPost) cabem neste tempo.
// (Cada chamada também é cortada em TEMPO_TROCA_MS pelo adaptador.)
export const TEMPO_NA_HORA_MS = 30_000
// menos que isto não vale começar outra chamada
export const MIN_NA_HORA_MS = 8_000

export type InfoFoto = { descricao: string | null, serve: boolean | null }

export type DepsNaHora = {
  // null = sem ANTHROPIC_API_KEY: nada de IA nem de uso registrado. Recebe o tempo máximo da chamada.
  chamar: ((timeoutMs: number) => ChamarIA) | null,
  // relógio (ms), para o prazo
  agora: () => number,
  contarNoMes: (clienteId: string) => Promise<number>,
  registrarUso: (r: RegistroUso) => Promise<void>,
  // linhas de fotos_ia destes caminhos (os que não estão lá ficam de fora)
  fotosInfo: (paths: string[]) => Promise<Record<string, InfoFoto>>,
  // URL assinada no bucket marcas; null se o arquivo não existe
  urlAssinada: (path: string) => Promise<string | null>,
}

// Escreve o post com a foto `foto` (caminho já conferido: da pasta do cliente). descricao null = sem descrição
// guardada (vai a imagem com SEM_DESCRICAO). Devolve o texto e a foto usada (null se ficou só texto).
export async function escreverNaHora(deps: DepsNaHora, a: {
  clienteId: string, dados: DadosDoCliente, post: LugarDoPost, foto: { path: string, descricao: string | null } | null,
}): Promise<{ campos: CamposDaIA, fotoPath: string | null } | null> {
  const criar = deps.chamar
  if (!criar) return null
  const prazo = deps.agora() + TEMPO_NA_HORA_MS
  // Prazo por fora do limite: chamada que nem começa (sem tempo) não conta no mês.
  const chamar: ChamarIA = async (pedido) => {
    const ms = prazo - deps.agora()
    if (ms < MIN_NA_HORA_MS) return { ok: false, motivo: 'tempo' }
    return comLimiteEUso(criar(ms), {
      clienteId: a.clienteId, tipo: 'troca', registrar: deps.registrarUso, contarNoMes: deps.contarNoMes,
    })(pedido)
  }
  try {
    const url = a.foto ? await deps.urlAssinada(a.foto.path) : null
    const foto = a.foto && url ? { url, descricao: a.foto.descricao || SEM_DESCRICAO } : null
    const escrito = await escreverPost(chamar, montarEntradaPost(a.dados, a.post, foto))
    return escrito ? { campos: escrito.post, fotoPath: foto ? a.foto!.path : null } : null
  } catch (e) {
    console.error('IA na hora: falhou', a.clienteId, e)
    return null
  }
}
