// Descreve uma foto e diz se ela serve para post (Etapa 4A, spec §3.1 e §7.10-11). Puro, como escrever.ts.
import type { ChamarIA, Tokens } from './escrever.ts'
import { INSTRUCOES_FOTO } from './instrucoes.ts'

export const ESQUEMA_FOTO = {
  type: 'object',
  properties: {
    descricao: { type: 'string', description: 'O que a foto mostra, em 2 a 4 frases.' },
    serve: { type: 'boolean', description: 'Nítida, iluminada, sem desconhecidos em destaque, sem marca de terceiros dominando.' },
    motivo: { anyOf: [{ type: 'string' }, { type: 'null' }], description: 'Por que não serve (para o dono do negócio); null se serve.' },
  },
  required: ['descricao', 'serve', 'motivo'],
  additionalProperties: false,
} as const

const MAX_TOKENS_FOTO = 2000
const MOTIVO_PADRAO = 'A foto não ficou boa para um post. Tente outra, nítida e bem iluminada.'

export async function descreverFoto(
  chamar: ChamarIA, foto: { url: string, contexto: string },
): Promise<{ descricao: string, serve: boolean, motivo: string | null, tokens: Tokens } | null> {
  const r = await chamar({
    sistema: INSTRUCOES_FOTO,
    conteudo: [
      { tipo: 'imagem', url: foto.url },
      { tipo: 'texto', texto: foto.contexto.trim() ? `Contexto: ${foto.contexto.trim()}` : 'Sem contexto adicional.' },
    ],
    esquema: ESQUEMA_FOTO,
    maxTokens: MAX_TOKENS_FOTO,
  })
  if (!r.ok || !r.dados || typeof r.dados !== 'object') return null
  const d = r.dados as Record<string, unknown>
  if (typeof d.descricao !== 'string' || !d.descricao.trim() || typeof d.serve !== 'boolean') return null
  const motivo = typeof d.motivo === 'string' && d.motivo.trim() ? d.motivo.trim() : null
  return {
    descricao: d.descricao.trim(),
    serve: d.serve,
    motivo: d.serve ? null : motivo ?? MOTIVO_PADRAO,
    tokens: { entrada: r.tokensEntrada, saida: r.tokensSaida },
  }
}
