// Datas comemorativas e comerciais do mês (sem IA). Usadas pela geração (post no dia, promoção com data)
// e pelo app (tela da estratégia e caixinha da promoção no item). Datas como texto AAAA-MM-DD, em UTC.

export type DataEspecial = {
  data: string, nome: string,
  // boa para promoção (só nos ramos que podem falar de preço)
  promo: boolean,
  // só faz sentido com promoção (ex.: Black Friday): sem promoção ligada, não ganha post
  soPromo: boolean,
}

const iso = (ano: number, mes: number, dia: number) =>
  `${ano}-${String(mes).padStart(2, '0')}-${String(dia).padStart(2, '0')}`

// Domingo de Páscoa (algoritmo de Meeus/Jones/Butcher, calendário gregoriano).
export function pascoa(ano: number): string {
  const a = ano % 19, b = Math.floor(ano / 100), c = ano % 100
  const d = Math.floor(b / 4), e = b % 4, f = Math.floor((b + 8) / 25), g = Math.floor((b - f + 1) / 3)
  const h = (19 * a + b - d - g + 15) % 30, i = Math.floor(c / 4), k = c % 4
  const l = (32 + 2 * e + 2 * i - h - k) % 7, m = Math.floor((a + 11 * h + 22 * l) / 451)
  const mes = Math.floor((h + l - 7 * m + 114) / 31), dia = ((h + l - 7 * m + 114) % 31) + 1
  return iso(ano, mes, dia)
}

const somarDias = (data: string, n: number) => {
  const d = new Date(`${data}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() + n)
  return d.toISOString().slice(0, 10)
}

// n-ésimo dia da semana (0 = domingo) do mês.
function enesimo(ano: number, mes: number, semana: number, n: number) {
  const primeiro = new Date(Date.UTC(ano, mes - 1, 1)).getUTCDay()
  return iso(ano, mes, 1 + ((semana - primeiro + 7) % 7) + 7 * (n - 1))
}

type Regra = {
  nome: string, quando: (ano: number) => string,
  // ramos em que a data aparece; ausente = todos
  ramos?: string[],
  // false = data de conscientização/homenagem (nunca sugere promoção)
  promo?: boolean, soPromo?: boolean,
}
const fixa = (mes: number, dia: number) => (ano: number) => iso(ano, mes, dia)
const SAUDE_MENTAL = ['psicologia']

const REGRAS: Regra[] = [
  { nome: 'Ano Novo', quando: fixa(1, 1) },
  { nome: 'Janeiro Branco', quando: fixa(1, 10), ramos: SAUDE_MENTAL, promo: false },
  { nome: 'Carnaval', quando: (a) => somarDias(pascoa(a), -47) },
  { nome: 'Dia Internacional da Mulher', quando: fixa(3, 8) },
  { nome: 'Dia do Consumidor', quando: fixa(3, 15), soPromo: true },
  { nome: 'Páscoa', quando: pascoa },
  { nome: 'Dia das Mães', quando: (a) => enesimo(a, 5, 0, 2) },
  { nome: 'Dia dos Namorados', quando: fixa(6, 12) },
  { nome: 'São João', quando: fixa(6, 24) },
  { nome: 'Dia dos Pais', quando: (a) => enesimo(a, 8, 0, 2) },
  { nome: 'Dia do Advogado', quando: fixa(8, 11), ramos: ['advocacia'], promo: false },
  { nome: 'Dia do Psicólogo', quando: fixa(8, 27), ramos: SAUDE_MENTAL, promo: false },
  { nome: 'Dia da Beleza', quando: fixa(9, 9), ramos: ['beleza'] },
  { nome: 'Setembro Amarelo', quando: fixa(9, 10), ramos: SAUDE_MENTAL, promo: false },
  { nome: 'Dia do Cliente', quando: fixa(9, 15) },
  { nome: 'Dia Mundial do Turismo', quando: fixa(9, 27), ramos: ['turismo'] },
  { nome: 'Dia Mundial da Saúde Mental', quando: fixa(10, 10), ramos: SAUDE_MENTAL, promo: false },
  { nome: 'Dia das Crianças', quando: fixa(10, 12) },
  // sexta-feira depois da 4ª quinta de novembro
  { nome: 'Black Friday', quando: (a) => somarDias(enesimo(a, 11, 4, 4), 1), soPromo: true },
  { nome: 'Natal', quando: fixa(12, 25) },
  { nome: 'Réveillon', quando: fixa(12, 31) },
]

// Datas do mês para o ramo, em ordem. noPromo: sem datas só de promoção e sem sugestão de promoção.
export function datasDoMes(anoMes: string, ramo: { id: string, noPromo: boolean }): DataEspecial[] {
  const ano = Number(anoMes.slice(0, 4))
  return REGRAS
    .filter((r) => !r.ramos || r.ramos.includes(ramo.id))
    .filter((r) => !(ramo.noPromo && r.soPromo))
    .map((r) => ({ data: r.quando(ano), nome: r.nome, promo: !ramo.noPromo && r.promo !== false, soPromo: !!r.soPromo }))
    .filter((d) => d.data.startsWith(anoMes))
    .sort((a, b) => a.data.localeCompare(b.data))
}

// Datas boas para promoção de hoje até `dias` à frente (a caixinha do item).
export function datasParaPromocao(hoje: string, ramo: { id: string, noPromo: boolean }, dias = 120): DataEspecial[] {
  if (ramo.noPromo) return []
  const ate = somarDias(hoje, dias)
  const meses: string[] = []
  for (let d = `${hoje.slice(0, 7)}-01`; d <= ate; d = somarDias(`${d.slice(0, 7)}-28`, 4).slice(0, 7) + '-01') meses.push(d.slice(0, 7))
  return meses.flatMap((m) => datasDoMes(m, ramo)).filter((d) => d.promo && d.data >= hoje && d.data <= ate)
}

// Feriados nacionais do ano (o plano "dias úteis" não posta neles, a não ser numa data especial):
// Ano Novo, Carnaval (segunda e terça), Sexta-feira Santa, Tiradentes, Dia do Trabalho, Corpus Christi,
// Independência, Aparecida, Finados, Proclamação da República, Consciência Negra e Natal.
export function feriados(ano: number): string[] {
  const p = pascoa(ano)
  return [
    iso(ano, 1, 1), somarDias(p, -48), somarDias(p, -47), somarDias(p, -2), iso(ano, 4, 21), iso(ano, 5, 1),
    somarDias(p, 60), iso(ano, 9, 7), iso(ano, 10, 12), iso(ano, 11, 2), iso(ano, 11, 15), iso(ano, 11, 20), iso(ano, 12, 25),
  ].sort()
}

// '2026-12-25' -> '25/12'
export const diaMes = (data: string) => `${data.slice(8, 10)}/${data.slice(5, 7)}`
