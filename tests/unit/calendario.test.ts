import { agendaDoMes, mesAlvo, hojeEmSaoPaulo, nomeDoMes } from '../../supabase/functions/_shared/modelos/calendario.ts'

// Um conteúdo por dia de post em todas as redes: feed = stories = status; lista no 1º dia de post da semana;
// vídeo no 1º e no 3º dia de post da semana.
test('segunda a sexta (padrão): dezembro de 2026', () => {
  const a = agendaDoMes('2026-12', '2026-12-01', 'vender')
  expect(a.feed).toHaveLength(23)
  expect(a.feed.slice(0, 6)).toEqual(['2026-12-01', '2026-12-02', '2026-12-03', '2026-12-04', '2026-12-07', '2026-12-08'])
  expect(a.status).toEqual(a.feed)
  expect(a.lista).toEqual(['2026-12-01', '2026-12-07', '2026-12-14', '2026-12-21', '2026-12-28'])
  expect(a.videos.slice(0, 4)).toEqual(['2026-12-01', '2026-12-03', '2026-12-07', '2026-12-09'])
  // a estratégia não muda os dias
  expect(agendaDoMes('2026-12', '2026-12-01', 'crescer')).toEqual(a)
})

test('as quatro frequências', () => {
  const n = (f: 'todos' | 'seg_sab' | 'uteis' | 'seg_sex') => agendaDoMes('2026-11', '2026-11-01', 'tempo', [], f).feed
  expect(n('todos')).toHaveLength(30)
  expect(n('seg_sab')).toHaveLength(25)
  expect(n('seg_sex')).toHaveLength(21)
  // dias úteis: sem os feriados de 02/11 (Finados, segunda) e 20/11 (Consciência Negra, sexta)
  expect(n('uteis')).toHaveLength(19)
  expect(n('uteis')).not.toContain('2026-11-02')
  expect(n('uteis')).not.toContain('2026-11-20')
})

test('datas especiais entram mesmo fora da frequência (ex.: Natal num plano de dias úteis)', () => {
  expect(agendaDoMes('2026-12', '2026-12-01', 'tempo', [], 'uteis').feed).not.toContain('2026-12-25')
  expect(agendaDoMes('2026-12', '2026-12-01', 'tempo', ['2026-12-25', '2026-12-26'], 'uteis').feed).toEqual(expect.arrayContaining(['2026-12-25', '2026-12-26']))
})

test('começando no meio da semana: lista no 1º dia de post e vídeos nos que houver', () => {
  const a = agendaDoMes('2026-11', '2026-11-19', 'tempo')
  expect(a.feed).toEqual(['2026-11-19', '2026-11-20', '2026-11-23', '2026-11-24', '2026-11-25', '2026-11-26', '2026-11-27', '2026-11-30'])
  expect(a.lista).toEqual(['2026-11-19', '2026-11-23', '2026-11-30'])
  expect(a.videos).toEqual(['2026-11-19', '2026-11-20', '2026-11-23', '2026-11-25', '2026-11-30'])
})

test.each([
  ['2026-11-10', [], { anoMes: '2026-11', inicio: '2026-11-10' }],
  ['2026-11-20', [], { anoMes: '2026-11', inicio: '2026-11-20' }],
  ['2026-11-21', [], { anoMes: '2026-12', inicio: '2026-12-01' }],
  ['2026-11-10', ['2026-11'], null],
  ['2026-11-25', ['2026-11'], { anoMes: '2026-12', inicio: '2026-12-01' }],
  ['2026-12-22', ['2026-12'], { anoMes: '2027-01', inicio: '2027-01-01' }],
  ['2026-11-25', ['2026-11', '2026-12'], null],
])('mesAlvo(%s, %j)', (hoje, gerados, esperado) => {
  expect(mesAlvo(hoje, gerados)).toEqual(esperado)
})

test('hojeEmSaoPaulo usa o fuso de Brasília', () => {
  expect(hojeEmSaoPaulo(new Date('2026-11-11T02:30:00Z'))).toBe('2026-11-10')
  expect(hojeEmSaoPaulo(new Date('2026-11-11T03:30:00Z'))).toBe('2026-11-11')
})

test('nomeDoMes', () => {
  expect(nomeDoMes('2027-01')).toBe('janeiro de 2027')
  expect(nomeDoMes('2026-11')).toBe('novembro de 2026')
})
