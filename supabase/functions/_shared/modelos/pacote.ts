// Detalhes do pacote de viagem (ramo Turismo): hotel, datas, transporte, transfer, refeições e condições do preço.
// Puro (sem Deno): o app e as funções importam. O que vem do banco ou do formulário passa por lerPacote.

export type Refeicoes = { cafe: boolean, almoco: boolean, jantar: boolean }
export type Pacote = {
  ativo: boolean,
  hotel: string | null,
  ida: string | null,
  volta: string | null,
  transporte: 'aviao' | 'onibus' | null, // null = só hospedagem
  transfer: boolean,
  refeicoes: Refeicoes,
  preco_por: 'pessoa' | 'casal' | 'noite' | 'pacote' | null,
  parcelas: number | null,
  taxas: boolean,
  pix: number | null,
}
export type LinhaDoCartao = { icone: 'hotel' | 'aviao' | 'onibus' | 'transfer' | 'data' | 'refeicao', texto: string }

export const HOTEL_MAX = 80
export const PARCELAS = { min: 2, max: 24 }
export const PIX = { min: 1, max: 50 }
const TRANSPORTES = ['aviao', 'onibus'] as const
const PRECO_POR = ['pessoa', 'casal', 'noite', 'pacote'] as const
const DATA = /^\d{4}-\d{2}-\d{2}$/

const objeto = (x: unknown): x is Record<string, unknown> => Boolean(x) && typeof x === 'object' && !Array.isArray(x)
const inteiroEntre = (v: unknown, min: number, max: number) =>
  typeof v === 'number' && Number.isInteger(v) && v >= min && v <= max ? v : null
const data = (v: unknown) => (typeof v === 'string' && DATA.test(v) ? v : null)
const umDe = <T extends string>(v: unknown, lista: readonly T[]): T | null => (lista as readonly unknown[]).includes(v) ? v as T : null

// Limpa o que chegou: chaves desconhecidas saem, valores inválidos viram null/false.
export function lerPacote(x: unknown): Pacote | null {
  if (!objeto(x)) return null
  const hotel = typeof x.hotel === 'string' ? x.hotel.trim().slice(0, HOTEL_MAX) : ''
  const ida = data(x.ida)
  let volta = data(x.volta)
  if (ida && volta && volta < ida) volta = null
  const r = objeto(x.refeicoes) ? x.refeicoes : {}
  return {
    ativo: x.ativo === true,
    hotel: hotel || null,
    ida, volta,
    transporte: umDe(x.transporte, TRANSPORTES),
    transfer: x.transfer === true,
    refeicoes: { cafe: r.cafe === true, almoco: r.almoco === true, jantar: r.jantar === true },
    preco_por: umDe(x.preco_por, PRECO_POR),
    parcelas: inteiroEntre(x.parcelas, PARCELAS.min, PARCELAS.max),
    taxas: x.taxas === true,
    pix: inteiroEntre(x.pix, PIX.min, PIX.max),
  }
}

// O pacote só vale com a caixinha "Detalhes do pacote" marcada.
export function pacoteAtivo(x: unknown): Pacote | null {
  const p = lerPacote(x)
  return p?.ativo ? p : null
}

export function noitesDoPacote(p: Pick<Pacote, 'ida' | 'volta'>): number | null {
  if (!p.ida || !p.volta) return null
  return Math.round((Date.parse(`${p.volta}T00:00:00Z`) - Date.parse(`${p.ida}T00:00:00Z`)) / 86400000)
}

const juntar = (partes: string[]) => partes.length <= 1 ? partes.join('') : `${partes.slice(0, -1).join(', ')} e ${partes[partes.length - 1]}`

// "Café da manhã", "Café e jantar", "Pensão completa"; os outros: os nomes juntos ("Almoço e jantar").
export function textoDasRefeicoes(r: Refeicoes): string | null {
  if (r.cafe && r.almoco && r.jantar) return 'Pensão completa'
  if (r.cafe && r.jantar && !r.almoco) return 'Café e jantar'
  const nomes = [r.cafe ? 'café da manhã' : null, r.almoco ? 'almoço' : null, r.jantar ? 'jantar' : null].filter(Boolean) as string[]
  if (!nomes.length) return null
  const t = juntar(nomes)
  return t[0].toUpperCase() + t.slice(1)
}

const dataBR = (d: string) => `${d.slice(8, 10)}/${d.slice(5, 7)}/${d.slice(0, 4)}`
const diaMes = (d: string) => `${d.slice(8, 10)}/${d.slice(5, 7)}`
// nome que já diz o tipo de hospedagem ("Hotel Serra Azul", "Pousada do Sol") não ganha "Hotel" na frente
const JA_DIZ_O_TIPO = /^(hotel|pousada|resort|hostel|chal[ée]|flat|apart)/i
const noites = (n: number) => (n === 1 ? '1 noite' : `${n} noites`)

// Resumo em uma linha (para a IA e para o texto de modelo). comPreco: false tira unidade, taxas, parcelas e Pix.
export function resumoDoPacote(p: Pacote, { comPreco = true }: { comPreco?: boolean } = {}): string {
  const n = noitesDoPacote(p)
  const refeicoes = textoDasRefeicoes(p.refeicoes)
  const partes = [
    p.hotel ? (JA_DIZ_O_TIPO.test(p.hotel) ? p.hotel : `Hotel ${p.hotel}`) : null,
    p.ida && p.volta ? (n === 0 ? `ida e volta ${dataBR(p.ida)}` : `ida ${dataBR(p.ida)}, volta ${dataBR(p.volta)} (${noites(n!)})`)
      : p.ida ? `ida ${dataBR(p.ida)}` : null,
    p.transporte === 'aviao' ? 'aéreo' : p.transporte === 'onibus' ? 'rodoviário' : null,
    p.transfer ? 'transfer aeroporto–hotel incluso' : null,
    refeicoes ? `${refeicoes === 'Pensão completa' ? 'pensão completa' : refeicoes.toLowerCase()} incluso` : null,
  ]
  if (comPreco) {
    partes.push(
      p.preco_por === 'pacote' ? 'preço do pacote completo' : p.preco_por ? `preço por ${p.preco_por}` : null,
      p.taxas ? 'taxas inclusas' : null,
      p.parcelas ? `em até ${p.parcelas}x` : null,
      p.pix ? `${p.pix}% a menos no Pix` : null,
    )
  }
  return partes.filter(Boolean).join('; ')
}

// Linhas com ícone do cartão da arte, só com o que foi preenchido.
export function linhasDoCartao(p: Pacote): LinhaDoCartao[] {
  const n = noitesDoPacote(p)
  const refeicoes = textoDasRefeicoes(p.refeicoes)
  const linhas: (LinhaDoCartao | null)[] = [
    p.hotel ? { icone: 'hotel', texto: p.hotel } : null,
    p.transporte === 'aviao' ? { icone: 'aviao', texto: 'Aéreo' } : p.transporte === 'onibus' ? { icone: 'onibus', texto: 'Rodoviário' } : null,
    p.transfer ? { icone: 'transfer', texto: 'Transfer incluso' } : null,
    p.ida && p.volta ? { icone: 'data', texto: n === 0 ? `${diaMes(p.ida)} · bate-volta` : `${diaMes(p.ida)} a ${diaMes(p.volta)} · ${noites(n!)}` }
      : p.ida ? { icone: 'data', texto: `Ida ${diaMes(p.ida)}` } : null,
    refeicoes ? { icone: 'refeicao', texto: refeicoes } : null,
  ]
  return linhas.filter(Boolean) as LinhaDoCartao[]
}

// Valores digitados no formulário: a chave do erro, ou null. Pacote desmarcado não é validado.
export function validarPacote(p: unknown): string | null {
  if (!objeto(p) || p.ativo !== true) return null
  const ida = data(p.ida), volta = data(p.volta)
  if (ida && volta && volta < ida) return 'quiz.item.pacote.erro.volta'
  if (p.parcelas != null && inteiroEntre(p.parcelas, PARCELAS.min, PARCELAS.max) == null) return 'quiz.item.pacote.erro.parcelas'
  if (p.pix != null && inteiroEntre(p.pix, PIX.min, PIX.max) == null) return 'quiz.item.pacote.erro.pix'
  return null
}

// O resumo como frase da legenda: "Hotel Serra Azul; ida ...; aéreo." (primeira letra maiúscula, ponto no fim).
export const fraseDoPacote = (resumo: string) => (resumo ? `${resumo[0].toUpperCase()}${resumo.slice(1)}.` : '')

// O resumo do pacote de um item, se o ramo é Turismo e o pacote está ativo; null nos outros casos.
export function resumoDoItem(ramo: string, pacote: unknown, comPreco: boolean): string | null {
  const p = ramo === 'turismo' ? pacoteAtivo(pacote) : null
  return p ? resumoDoPacote(p, { comPreco }) || null : null
}

// O que gravar no banco: null quando a caixinha está desmarcada e nada foi preenchido (abrir o formulário não muda o item).
export function pacoteParaGravar(x: unknown): Pacote | null {
  const p = lerPacote(x)
  if (!p) return null
  const r = p.refeicoes
  const temValor = Boolean(p.hotel || p.ida || p.volta || p.transporte || p.transfer || r.cafe || r.almoco || r.jantar ||
    p.preco_por || p.parcelas || p.taxas || p.pix)
  return p.ativo || temValor ? p : null
}

// Textos do cliente num item (nome, descrição e o hotel do pacote): as checagens de palavras não valem para eles.
export const textosDoItem = (p: { nome: string, descricao?: string | null, pacote?: unknown }): string[] =>
  [p.nome, p.descricao ?? '', lerPacote(p.pacote)?.hotel ?? '']
