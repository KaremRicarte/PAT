// Escreve um post com a IA (Etapa 4A, spec §3.3 e §4). Puro: a chamada de verdade ao Claude entra como `chamar`
// (o adaptador com o SDK fica na função Edge); aqui só montamos o pedido, juntamos a resposta e checamos.
import type { Estrategia, Pilar, Rede, Tom } from '../modelos/tipos.ts'
import { RAMOS } from '../modelos/ramos/index.ts'
import { brl, daData, paragrafos, textoDoPreco, type Ocasiao, type PostGerado } from '../modelos/gerar.ts'
import { diaMes } from '../modelos/datas.ts'
import { MAX_HASHTAGS, ofertaDaData, semTextoDoCliente, temPromocao, validarPost } from '../modelos/validar.ts'
import { INSTRUCOES_POST } from './instrucoes.ts'

export type ConteudoIA = { tipo: 'texto', texto: string } | { tipo: 'imagem', url: string }
export type Esforco = 'low' | 'medium'
// esforco: o do pedido vence o da ChamarIA (descrever foto e escolher imagem pedem 'low')
export type PedidoIA = { sistema: string, conteudo: ConteudoIA[], esquema: object, maxTokens: number, esforco?: Esforco }
// ocupado = a API está sobrecarregada ou limitando (429, 529, 5xx): passageiro, dá para tentar mais tarde
export type RespostaIA =
  | { ok: true, dados: unknown, tokensEntrada: number, tokensSaida: number }
  | { ok: false, motivo: 'recusa' | 'limite' | 'erro' | 'tempo' | 'ocupado', tokensEntrada?: number, tokensSaida?: number }
export type ChamarIA = (pedido: PedidoIA) => Promise<RespostaIA>
export type Tokens = { entrada: number, saida: number }

// Erro HTTP da API -> motivo: 429 (limite de pedidos), 529 (sobrecarga) e 5xx são passageiros ('ocupado').
export const motivoDoErroHttp = (status: number | undefined): 'ocupado' | 'erro' =>
  status === 429 || (status != null && status >= 500) ? 'ocupado' : 'erro'

export type EntradaPost = {
  ramo: string,
  negocio: { nome: string, insta: string | null, tom: Tom },
  estrategia: Estrategia,
  lugar: {
    data: string, rede: Rede, tipo: PostGerado['tipo'], formato: PostGerado['formato'], pilar: Pilar,
    preco_de: number | null, preco_por: number | null,
    // data especial do post (tema, ou aquecimento/dia de uma promoção com data); ausente = post comum
    ocasiao?: Ocasiao | null,
  },
  produto: { nome: string, descricao: string | null } | null,
  foto: { url: string, descricao: string, ilustrativa?: boolean } | null,
  textoModelo: string,
  textosDoCliente: string[],
  // título que o post já teve ("Refazer"): a IA escreve outro, sem repetir o título nem a abertura
  evitar?: string | null,
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

// o Opus 5.5 sempre pensa antes de responder: max_tokens cobre o pensamento e a resposta
const MAX_TOKENS_POST = 16000

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

const DIAS = ['domingo', 'segunda-feira', 'terça-feira', 'quarta-feira', 'quinta-feira', 'sexta-feira', 'sábado']
const MESES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro']
// '2026-12-04' -> 'sexta-feira, 4 de dezembro' (data do calendário, sem fuso). Formato inesperado: a data como veio.
export function dataPorExtenso(data: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(data)
  if (!m) return data
  const d = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3]))
  if (Number.isNaN(d.getTime())) return data
  return `${DIAS[d.getUTCDay()]}, ${d.getUTCDate()} de ${MESES[d.getUTCMonth()]}`
}

const comArroba = (insta: string | null) => (insta ? (insta.startsWith('@') ? insta : `@${insta}`) : null)
const semHashtags = (l: EntradaPost['lugar']) => l.rede === 'whatsapp' || l.tipo === 'stories'

// Preço do post, só quando o lugar já é de preço e o ramo permite.
function precoDoPost(e: EntradaPost, noPromo: boolean) {
  const { preco_de, preco_por } = e.lugar
  if (noPromo || preco_por == null) return null
  return { preco_de, preco_por, texto: textoDoPreco(preco_de, preco_por, e.lugar.ocasiao ?? null) }
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
    `Onde e quando: ${REDES[l.rede]}, ${TIPOS[l.tipo]}, formato ${FORMATOS[l.formato]}, dia ${l.data} (${dataPorExtenso(l.data)}). Pilar: ${PILARES[l.pilar]}.`,
    e.produto
      ? `Serviço ou produto do post: ${e.produto.nome}${e.produto.descricao ? `. Descrição do cliente: ${e.produto.descricao}` : ''}.`
      : 'Post de tema geral, sem um serviço específico.',
    e.produto
      ? `O post é sobre ${e.produto.nome}: se o texto de modelo abaixo citar outro lugar, produto ou serviço, ignore e fale só de ${e.produto.nome}.`
      : null,
    e.foto
      ? `Foto do post (anexada${e.foto.ilustrativa ? '; imagem ilustrativa, não é do negócio: não diga que é o espaço, a equipe, o produto ou o trabalho do cliente' : ''}): ${e.foto.descricao}`
      : 'Este post não tem foto: escreva sem mencionar imagem.',
  ]
  if (preco) {
    linhas.push(preco.preco_de != null
      ? `Post de promoção: de ${brl(preco.preco_de)} por ${brl(preco.preco_por)}. O app coloca, entre o meio e o convite, exatamente este parágrafo: "${preco.texto}"`
      : `Post de vitrine com valor: ${brl(preco.preco_por)}. O app coloca, entre o meio e o convite, exatamente este parágrafo: "${preco.texto}"`)
  }
  if (ofertaDaData(l) && !preco) {
    linhas.push('O cliente não informou preço para esta oferta: não cite valores; fale da oferta da data e chame para pedir as condições.')
  }
  if (preco?.preco_de != null || ofertaDaData(l)) {
    linhas.push('A oferta precisa ficar evidente: o título e o gancho falam da oferta (oferta, promoção ou valor especial). Não esconda a promoção no fim do texto.')
  }
  const o = l.ocasiao
  if (o) {
    const quando = `${diaMes(o.data)} (${dataPorExtenso(o.data)})`
    if (o.fase === 'tema' && o.nome) {
      linhas.push(`Este post é do dia ${o.nome}, ${quando}: ligue o tema do post a essa data de forma natural e respeitosa${noPromo ? '' : ', sem falar de preço, promoção ou desconto'}.`)
    } else if (o.fase === 'aquecimento') {
      linhas.push(`Este post é de aquecimento: a oferta ${o.nome ? `${daData(o.nome)} ` : ''}vale só no dia ${quando}. Anuncie que ela vem aí, crie expectativa e diga o dia; não diga que já está valendo.`)
    } else if (o.fase === 'dia') {
      linhas.push(`Este é o post do dia da oferta${o.nome ? ` ${daData(o.nome)}` : ''}: ela vale só hoje, ${quando}. Passe urgência (é hoje, só hoje) sem exagero.`)
    }
  }
  if (noPromo) {
    linhas.push('Este ramo tem conselho profissional: sem preço, promoção, desconto ou oferta, e sem promessa de resultado.')
  }
  if (l.rede === 'facebook') linhas.push('O app acrescenta a assinatura do negócio no fim da legenda.')
  if (l.tipo === 'stories') {
    linhas.push('Este story é uma ENQUETE sobre o assunto do dia (o mesmo dos outros posts do dia): o título e o gancho são a mesma pergunta, curta (até 80 caracteres) e terminando com "?"; o meio é exatamente "Enquete: opção 1 / opção 2", com duas opções curtas (até 20 caracteres cada) que respondem à pergunta; o convite fica vazio.')
  }
  linhas.push('', '# Texto de modelo que estava neste lugar (só referência de tema; não copie)', e.textoModelo)
  if (e.evitar) linhas.push('', '# Título que este post já teve (escreva outro: não repita este título nem a mesma abertura)', e.evitar)
  return linhas.filter((x) => x !== null).join('\n')
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

const VALOR = /R\$\s*\d[\d.]*(?:,\d{1,2})?/g
// compara os valores sem nenhum espaço: "R$ 49,90", "R$49,90" e com espaço não separável são o mesmo valor
const semEspacos = (s: string) => s.replace(/\s/g, '')

// Junta as partes no formato de parágrafos dos modelos (gerar.ts) e checa com as mesmas regras.
function montar(e: EntradaPost, p: Partes, noPromo: boolean): { post: CamposDaIA, problemas: string[] } {
  const ramo = RAMOS[e.ramo]
  const preco = precoDoPost(e, noPromo)
  const insta = comArroba(e.negocio.insta)
  const assinatura = e.lugar.rede === 'facebook' ? `${e.negocio.nome}${insta ? ` · Instagram ${insta}` : ''}` : null
  const hashtags = semHashtags(e.lugar) ? [] : p.hashtags
    .map((h) => h.replace(/\s+/g, '')).filter((h) => h.replace(/#/g, ''))
    .map((h) => (h.startsWith('#') ? h : `#${h}`))
    // hashtags a mais: corta no máximo da rede em vez de reprovar o post
    .slice(0, MAX_HASHTAGS[e.lugar.rede])
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
  // story: enquete (pergunta + duas opções curtas para o adesivo do Instagram)
  if (e.lugar.tipo === 'stories') {
    if (!p.titulo.trim().endsWith('?') || p.titulo.length > 90) problemas.push('o título do story não é uma pergunta curta')
    if (!/^Enquete: [^/\n]{1,24} \/ [^/\n]{1,24}$/.test(p.meio.trim())) problemas.push('o meio do story não é "Enquete: opção 1 / opção 2" com opções curtas')
  }
  // Fora dos posts de preço, nada de promoção/desconto/oferta (o validarPost só barra o R$ nesses ramos).
  // O que o cliente escreveu (nome do negócio, do serviço, descrição) não conta, como no validarPost.
  if (!preco && !ramo.noPromo && !ofertaDaData(e.lugar)) {
    const doCliente = [...new Set(e.textosDoCliente.map((c) => c.trim()).filter(Boolean))].sort((a, b) => b.length - a.length)
    const daIA = [p.titulo, p.gancho, p.meio, p.convite, p.roteiro ?? '', ...p.hashtags]
    if (daIA.some((t) => temPromocao(semTextoDoCliente(t, doCliente)))) {
      problemas.push('fala de promoção/desconto/oferta num post sem preço')
    }
  }
  // Promoção: a oferta aparece no título (a de hoje não parecia promoção: o título só descrevia a foto).
  if ((preco?.preco_de != null || ofertaDaData(e.lugar)) && !temPromocao(p.titulo) && !/especial|vem a[ií]|s[oó] hoje/i.test(p.titulo)) {
    problemas.push('título de promoção sem falar da oferta')
  }
  // Em post de preço o R$ é permitido, mas só com os valores informados.
  if (preco) {
    const permitidos = new Set([preco.preco_de, preco.preco_por].filter((v) => v != null).map((v) => semEspacos(brl(v!))))
    const escritos = [p.titulo, p.gancho, p.meio, p.convite, p.roteiro ?? '', ...p.hashtags].join('\n')
    if ((escritos.match(VALOR) ?? []).some((v) => !permitidos.has(semEspacos(v)))) {
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
