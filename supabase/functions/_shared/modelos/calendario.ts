// Agenda do mês (quais dias recebem post em cada rede) e escolha do mês a gerar.
// Datas sempre como texto AAAA-MM-DD, calculadas em UTC para não depender do fuso.
import type { Estrategia, Frequencia } from './tipos.ts'
import { feriados } from './datas.ts'

export type Agenda = { feed: string[], videos: string[], status: string[], lista: string[] }

const SEG = 1, SEX = 5
const MESES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto',
  'setembro', 'outubro', 'novembro', 'dezembro']

const iso = (ano: number, mes: number, dia: number) =>
  `${ano}-${String(mes).padStart(2, '0')}-${String(dia).padStart(2, '0')}`

// Dias do mês a partir de `inicio`, com o dia da semana (0 = domingo).
function diasDoMes(anoMes: string, inicio: string) {
  const [ano, mes] = anoMes.split('-').map(Number)
  const total = new Date(Date.UTC(ano, mes, 0)).getUTCDate()
  const dias: { data: string, dia: number, semana: number }[] = []
  for (let d = 1; d <= total; d++) {
    const data = iso(ano, mes, d)
    if (data >= inicio) dias.push({ data, dia: d, semana: new Date(Date.UTC(ano, mes - 1, d)).getUTCDay() })
  }
  return dias
}

// Um conteúdo por dia de post, adaptado para todas as redes do cliente (spec 2026-11-19-dia-unico-todas-as-redes):
// feed (Instagram + Facebook), stories e status em todo dia de post; a lista do WhatsApp no 1º dia de post de cada
// semana; o vídeo em 2 dias de post por semana (o 1º e o 3º; o 2º se a semana tiver só 2).
// Dias de post: os da frequência do cliente, mais os `extras` (datas especiais e promoções com data, mesmo fora dela).
// A estratégia não muda os dias (o parâmetro fica para quem já chama assim).
export function agendaDoMes(anoMes: string, inicio: string, _estrategia: Estrategia, extras: readonly string[] = [],
  frequencia: Frequencia = 'seg_sex'): Agenda {
  const dias = diasDoMes(anoMes, inicio)
  const folgas = new Set(frequencia === 'uteis' ? feriados(Number(anoMes.slice(0, 4))) : [])
  const vale = (d: { data: string, semana: number }) =>
    frequencia === 'todos' ? true
      : frequencia === 'seg_sab' ? d.semana !== 0
        : d.semana >= SEG && d.semana <= SEX && !folgas.has(d.data)
  const feed = [...new Set([...dias.filter(vale).map((d) => d.data),
    ...extras.filter((d) => d.startsWith(anoMes) && d >= inicio)])].sort()
  // semanas de segunda a domingo
  const semanaDe = (data: string) => {
    const d = new Date(`${data}T00:00:00Z`)
    d.setUTCDate(d.getUTCDate() - (d.getUTCDay() + 6) % 7)
    return d.toISOString().slice(0, 10)
  }
  const porSemana = new Map<string, string[]>()
  for (const d of feed) porSemana.set(semanaDe(d), [...(porSemana.get(semanaDe(d)) ?? []), d])
  const semanas = [...porSemana.values()]
  return {
    feed,
    status: feed,
    lista: semanas.map((s) => s[0]),
    videos: semanas.flatMap((s) => (s.length >= 3 ? [s[0], s[2]] : s.slice(0, 2))),
  }
}

// Até o dia 20 gera o mês atual a partir de hoje; depois (ou se o atual já existe), o mês seguinte inteiro.
export function mesAlvo(hoje: string, gerados: string[]): { anoMes: string, inicio: string } | null {
  const [ano, mes, dia] = hoje.split('-').map(Number)
  const atual = iso(ano, mes, 1).slice(0, 7)
  if (dia <= 20 && !gerados.includes(atual)) return { anoMes: atual, inicio: hoje }
  if (dia <= 20) return null
  const proximo = mes === 12 ? iso(ano + 1, 1, 1) : iso(ano, mes + 1, 1)
  if (gerados.includes(proximo.slice(0, 7))) return null
  return { anoMes: proximo.slice(0, 7), inicio: proximo }
}

export function hojeEmSaoPaulo(agora: Date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(agora)
}

export function nomeDoMes(anoMes: string): string {
  const [ano, mes] = anoMes.split('-').map(Number)
  return `${MESES[mes - 1]} de ${ano}`
}
