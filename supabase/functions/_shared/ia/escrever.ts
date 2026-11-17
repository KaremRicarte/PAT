// Escreve um post com a IA (Etapa 4A, spec §3.3 e §4). Puro: a chamada de verdade ao Claude entra como `chamar`
// (o adaptador com o SDK fica na função Edge); aqui só montamos o pedido, juntamos a resposta e checamos.
import type { Estrategia, Pilar, Rede, Tom } from '../modelos/tipos.ts'
import { RAMOS } from '../modelos/ramos/index.ts'
import { brl, paragrafos, textoDoPreco, type PostGerado } from '../modelos/gerar.ts'
import { validarPost } from '../modelos/validar.ts'
import { INSTRUCOES_POST } from './instrucoes.ts'

export type ConteudoIA = { tipo: 'texto', texto: string } | { tipo: 'imagem', url: string }
export type PedidoIA = { sistema: string, conteudo: ConteudoIA[], esquema: object, maxTokens: number }
export type RespostaIA =
  | { ok: true, dados: unknown, tokensEntrada: number, tokensSaida: number }
  | { ok: false, motivo: 'recusa' | 'limite' | 'erro' | 'tempo', tokensEntrada?: number, tokensSaida?: number }
export type ChamarIA = (pedido: PedidoIA) => Promise<RespostaIA>
export type Tokens = { entrada: number, saida: number }

export type EntradaPost = {
  ramo: string,
  negocio: { nome: string, insta: string | null, tom: Tom },
  estrategia: Estrategia,
  lugar: {
    data: string, rede: Rede, tipo: PostGerado['tipo'], formato: PostGerado['formato'], pilar: Pilar,
    preco_de: number | null, preco_por: number | null,
  },
  produto: { nome: string, descricao: string | null } | null,
  foto: { url: string, descricao: string } | null,
  textoModelo: string,
  textosDoCliente: string[],
}
export type CamposDaIA = { titulo: string, legenda: string, hashtags: string[], roteiro: string | null }

// O que a IA devolve (resposta estruturada). A legenda é montada aqui, para o preço e a assinatura saírem exatos.
export const ESQUEMA_POST = {
  type: 'object',
  properties: {
    titulo: { type: 'string', description: 'Título da arte, até 90 caracteres.' },
    gancho: { type: 'string', description: 'Primeira linha da legenda, para parar a rolagem.' },
    meio: { type: 'string', description: 'Corpo da legenda; parágrafos separados por linha em branco. Pode ser vazio em stories, status e vídeo.' },
    convite: { type: 'string', description: 'Chamada final, clara.' },
    hashtags: { type: 'array', items: { type: 'string' }, description: 'Hashtags com #; vazio em stories e WhatsApp.' },
    roteiro: { anyOf: [{ type: 'string' }, { type: 'null' }], description: 'Roteiro do vídeo ou "Como montar:" da arte; null no WhatsApp.' },
  },
  required: ['titulo', 'gancho', 'meio', 'convite', 'hashtags', 'roteiro'],
  additionalProperties: false,
} as const

const MAX_TOKENS_POST = 4000

const ESTRATEGIAS: Record<Estrategia, string> = {
  vender: 'Vender mais', crescer: 'Crescer o perfil', credibilidade: 'Credibilidade', tempo: 'Economizar tempo',
}
const PILARES: Record<Pilar, string> = { demo: 'demonstração', aprox: 'aproximação', need: 'necessidade' }
const REDES: Record<Rede, string> = { instagram: 'Instagram', facebook: 'Facebook', tiktok: 'TikTok/Reels', whatsapp: 'WhatsApp' }
const TIPOS: Record<PostGerado['tipo'], string> = {
  feed: 'feed', stories: 'stories', video: 'vídeo', status: 'status', lista: 'mensagem para a lista',
}
const FORMATOS: Record<PostGerado['formato'], string> = {
  arte: 'arte com uma foto', carrossel: 'carrossel', montagem: 'vídeo de montagem com fotos',
  gravar: 'vídeo para gravar', texto: 'só texto',
}

const comArroba = (insta: string | null) => (insta ? (insta.startsWith('@') ? insta : `@${insta}`) : null)
const semHashtags = (l: EntradaPost['lugar']) => l.rede === 'whatsapp' || l.tipo === 'stories'

// Preço do post, só quando o lugar já é de preço e o ramo permite.
function precoDoPost(e: EntradaPost, noPromo: boolean) {
  const { preco_de, preco_por } = e.lugar
  if (noPromo || preco_por == null) return null
  return { preco_de, preco_por, texto: textoDoPreco(preco_de, preco_por) }
}

// Os dados deste post, em texto: tudo o que muda de um post para outro fica aqui, fora das instruções fixas.
function dadosDoPost(e: EntradaPost, noPromo: boolean): string {
  const ramo = RAMOS[e.ramo]
  const tom = ramo.tons.find(([t]) => t === e.negocio.tom)
  const insta = comArroba(e.negocio.insta)
  const preco = precoDoPost(e, noPromo)
  const l = e.lugar
  const linhas = [
    '# Dados deste post',
    `Ramo: ${ramo.nome} (${ramo.desc}). Assunto do perfil: ${ramo.assunto}.`,
    `Negócio: ${e.negocio.nome}${insta ? ` (Instagram ${insta})` : ''}.`,
    `Tom de voz: ${tom ? `${tom[1]} (${tom[2]})` : e.negocio.tom}.`,
    `Estratégia do mês: ${ESTRATEGIAS[e.estrategia]}.`,
    `Onde e quando: ${REDES[l.rede]}, ${TIPOS[l.tipo]}, formato ${FORMATOS[l.formato]}, dia ${l.data}. Pilar: ${PILARES[l.pilar]}.`,
    e.produto
      ? `Serviço ou produto do post: ${e.produto.nome}${e.produto.descricao ? `. Descrição do cliente: ${e.produto.descricao}` : ''}.`
      : 'Post de tema geral, sem um serviço específico.',
    e.foto
      ? `Foto do post (anexada): ${e.foto.descricao}`
      : 'Este post não tem foto: escreva sem mencionar imagem.',
  ]
  if (preco) {
    linhas.push(preco.preco_de != null
      ? `Post de promoção: de ${brl(preco.preco_de)} por ${brl(preco.preco_por)}. O app coloca, entre o meio e o convite, exatamente este parágrafo: "${preco.texto}"`
      : `Post de vitrine com valor: ${brl(preco.preco_por)}. O app coloca, entre o meio e o convite, exatamente este parágrafo: "${preco.texto}"`)
  }
  if (noPromo) {
    linhas.push('Este ramo tem conselho profissional: sem preço, promoção, desconto ou oferta, e sem promessa de resultado.')
  }
  if (l.rede === 'facebook') linhas.push('O app acrescenta a assinatura do negócio no fim da legenda.')
  linhas.push('', '# Texto de modelo que estava neste lugar (só referência de tema; não copie)', e.textoModelo)
  return linhas.join('\n')
}

type Partes = { titulo: string, gancho: string, meio: string, convite: string, hashtags: string[], roteiro: string | null }

function lerPartes(d: unknown): Partes | null {
  if (!d || typeof d !== 'object') return null
  const o = d as Record<string, unknown>
  const textos = ['titulo', 'gancho', 'meio', 'convite'] as const
  if (textos.some((k) => typeof o[k] !== 'string')) return null
  if (!Array.isArray(o.hashtags) || o.hashtags.some((h) => typeof h !== 'string')) return null
  if (o.roteiro !== null && typeof o.roteiro !== 'string') return null
  return {
    titulo: (o.titulo as string).trim(), gancho: (o.gancho as string).trim(), meio: (o.meio as string).trim(),
    convite: (o.convite as string).trim(), hashtags: o.hashtags as string[],
    roteiro: typeof o.roteiro === 'string' && o.roteiro.trim() ? o.roteiro.trim() : null,
  }
}

const VALOR = /R\$\s?\d[\d.]*(?:,\d{1,2})?/g
const soEspacos = (s: string) => s.replace(/\s/g, ' ')

// Junta as partes no formato de parágrafos dos modelos (gerar.ts) e checa com as mesmas regras.
function montar(e: EntradaPost, p: Partes, noPromo: boolean): { post: CamposDaIA, problemas: string[] } {
  const ramo = RAMOS[e.ramo]
  const preco = precoDoPost(e, noPromo)
  const insta = comArroba(e.negocio.insta)
  const assinatura = e.lugar.rede === 'facebook' ? `${e.negocio.nome}${insta ? ` · Instagram ${insta}` : ''}` : null
  const hashtags = semHashtags(e.lugar) ? [] : p.hashtags
    .map((h) => h.replace(/\s+/g, '')).filter((h) => h.replace(/#/g, ''))
    .map((h) => (h.startsWith('#') ? h : `#${h}`))
  const post: CamposDaIA = {
    titulo: p.titulo,
    legenda: paragrafos(p.gancho, p.meio, preco?.texto, p.convite, assinatura),
    hashtags,
    roteiro: e.lugar.rede === 'whatsapp' ? null : p.roteiro,
  }
  const completo: PostGerado = {
    ...e.lugar, ...post, horario: '', produto_id: null, ordem: 0,
    preco_de: preco?.preco_de ?? null, preco_por: preco?.preco_por ?? null,
  }
  const problemas = validarPost(completo, ramo, e.textosDoCliente)
  // Em post de preço o R$ é permitido, mas só com os valores informados.
  if (preco) {
    const permitidos = new Set([preco.preco_de, preco.preco_por].filter((v) => v != null).map((v) => soEspacos(brl(v!))))
    const escritos = [p.titulo, p.gancho, p.meio, p.convite, p.roteiro ?? '', ...p.hashtags].join('\n')
    if ((escritos.match(VALOR) ?? []).some((v) => !permitidos.has(soEspacos(v)))) {
      problemas.push('valor em reais diferente do informado')
    }
  }
  return { post, problemas }
}

// Escreve o post; reprovado nas checagens → mais uma tentativa com os problemas; reprovado de novo ou falha → null.
export async function escreverPost(
  chamar: ChamarIA, entrada: EntradaPost,
): Promise<{ post: CamposDaIA, tentativas: number, tokens: Tokens } | null> {
  const ramo = RAMOS[entrada.ramo]
  if (!ramo) return null
  const noPromo = ramo.noPromo
  const base: ConteudoIA[] = [
    ...(entrada.foto ? [{ tipo: 'imagem' as const, url: entrada.foto.url }] : []),
    { tipo: 'texto', texto: dadosDoPost(entrada, noPromo) },
  ]
  const tokens: Tokens = { entrada: 0, saida: 0 }
  let conteudo = base

  for (let tentativa = 1; tentativa <= 2; tentativa++) {
    const r = await chamar({ sistema: INSTRUCOES_POST, conteudo, esquema: ESQUEMA_POST, maxTokens: MAX_TOKENS_POST })
    tokens.entrada += r.tokensEntrada ?? 0
    tokens.saida += r.tokensSaida ?? 0
    if (!r.ok) return null
    const partes = lerPartes(r.dados)
    const { post, problemas } = partes ? montar(entrada, partes, noPromo) : { post: null, problemas: ['resposta fora do formato pedido'] }
    if (post && !problemas.length) return { post, tentativas: tentativa, tokens }
    conteudo = [...base, {
      tipo: 'texto',
      texto: [
        '# Sua resposta anterior foi recusada pelas checagens',
        JSON.stringify(r.dados),
        'Problemas encontrados:',
        ...problemas.map((x) => `- ${x}`),
        'Escreva o post de novo, corrigindo esses problemas e seguindo todas as regras.',
      ].join('\n'),
    }]
  }
  return null
}
