// Palavras-chave para achar a imagem de um post de tema geral (Pexels/Pixabay buscam por palavras, não por frase)
// e o prompt para gerar uma imagem quando nada serve. Puro: a chamada à IA entra por `chamar`.
import type { ChamarIA } from './escrever.ts'
import { INSTRUCOES_PALAVRAS } from './instrucoes.ts'

export type Palavras = { busca_pt: string, busca_en: string, prompt_imagem: string }

export const ESQUEMA_PALAVRAS = {
  type: 'object',
  properties: {
    busca_pt: { type: 'string', description: '2 a 3 palavras em português para buscar a foto.' },
    busca_en: { type: 'string', description: 'As mesmas 2 a 3 palavras em inglês.' },
    prompt_imagem: { type: 'string', description: 'Descrição em inglês de uma cena ou objeto fotografável, sem pessoas, rostos, texto ou logotipos.' },
  },
  required: ['busca_pt', 'busca_en', 'prompt_imagem'],
  additionalProperties: false,
} as const

export function criarPalavras(chamar: ChamarIA): (tema: string, ramo: string) => Promise<Palavras | null> {
  return async (tema, ramo) => {
    const r = await chamar({
      sistema: INSTRUCOES_PALAVRAS,
      conteudo: [{ tipo: 'texto', texto: `Ramo do negócio: ${ramo}.\nTema do post: ${tema || 'post do negócio'}.` }],
      esquema: ESQUEMA_PALAVRAS, maxTokens: 8000, esforco: 'low',
    })
    if (!r.ok || !r.dados || typeof r.dados !== 'object') return null
    const d = r.dados as Record<string, unknown>
    const campo = (k: string) => (typeof d[k] === 'string' ? (d[k] as string).trim() : '')
    const p = { busca_pt: campo('busca_pt'), busca_en: campo('busca_en'), prompt_imagem: campo('prompt_imagem') }
    return p.busca_pt && p.busca_en && p.prompt_imagem ? p : null
  }
}
