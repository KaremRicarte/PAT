// Agenda do mês (quais dias recebem post em cada rede) e escolha do mês a gerar.
// Datas sempre como texto AAAA-MM-DD, calculadas em UTC para não depender do fuso.
import type { Estrategia } from './tipos.ts'

export type Agenda = { feed: string[], videos: string[], status: string[], lista: string[] }

const SEG = 1, TER = 2, QUA = 3, QUI = 4, SEX = 5
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

export function agendaDoMes(anoMes: string, inicio: string, estrategia: Estrategia): Agenda {
  const dias = diasDoMes(anoMes, inicio)
  const em = (semanas: number[], max: number) =>
    dias.filter((d) => semanas.includes(d.semana)).slice(0, max).map((d) => d.data)
  const crescer = estrategia === 'crescer'
  const primeiraQuinta = (de: number, ate: number) =>
    dias.find((d) => d.semana === QUI && d.dia >= de && d.dia <= ate)?.data
  return {
    feed: em([SEG, QUA, SEX], 12),
    videos: crescer ? em([TER, QUI], 6) : em([TER], 4),
    status: em([TER, QUI], 8),
    lista: [primeiraQuinta(1, 15), primeiraQuinta(16, 31)].filter((d): d is string => !!d),
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
